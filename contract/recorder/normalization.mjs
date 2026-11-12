import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const batchPattern = /<<<\[VCP_TOOL_BATCH_(START|END):([^\]]+)\]>>>/g;
const payloadPrefix = '<!-- VCP_TOOL_PAYLOAD -->\n';
const offsetTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/;

function parseWire(text) {
  const value = JSON.parse(text);
  assert.equal(JSON.stringify(value), text, 'Wire JSON serialization changed');
  return value;
}

function normalizePluginText(text) {
  // Only these synthetic scenarios' object results receive a root timestamp.
  if (!text.startsWith('{')) return text;
  const result = JSON.parse(text);
  if (!Object.hasOwn(result, 'timestamp')) return text;
  const stamp = result.timestamp;
  assert(typeof stamp === 'string' && offsetTimestamp.test(stamp)
    && Number.isFinite(Date.parse(stamp)), 'Invalid plugin timestamp');
  // Preserve every other byte, including indentation and non-root timestamps.
  const token = JSON.stringify(stamp);
  const offset = text.lastIndexOf('"timestamp"');
  const tail = text.slice(offset);
  assert(tail.includes(token), 'Ambiguous plugin timestamp');
  return text.slice(0, offset) + tail.replace(token, '"<PLUGIN_TIME>"');
}

function validateBatches(content) {
  let open;
  let previous = -Infinity;
  for (const [, kind, stamp] of content.matchAll(batchPattern)) {
    const time = Date.parse(stamp);
    assert(offsetTimestamp.test(stamp) && Number.isFinite(time), 'Invalid batch timestamp');
    if (kind === 'START') {
      assert.equal(open, undefined, 'Nested batch START');
      assert(time > previous, 'Batch timestamps must be strictly monotonic');
      open = stamp;
      previous = time;
    } else {
      assert.equal(stamp, open, 'Unpaired batch END');
      open = undefined;
    }
  }
  assert.equal(open, undefined, 'Unpaired batch START');
}

function normalizeChunk(chunk) {
  if (/^chatcmpl-.+-\d+$/.test(chunk.id ?? '')) {
    chunk.id = chunk.id.replace(/\d+$/, '<TIME>');
    if (Object.hasOwn(chunk, 'created')) {
      assert(Number.isSafeInteger(chunk.created) && chunk.created > 0, 'Invalid generated created');
      chunk.created = '<EPOCH_SECONDS>';
    }
  }
  for (const choice of chunk.choices ?? []) {
    const message = choice.delta ?? choice.message;
    if (typeof message?.content === 'string') {
      message.content = message.content.replace(batchPattern, '<<<[VCP_TOOL_BATCH_$1:<BATCH_TIME>]>>>');
    }
  }
  return chunk;
}

/** Normalize only generated fields of the synthetic baseline scenarios.
 * Framing, field order, ordinary text and the upstream request sequence remain exact.
 * Batch pairing/timing and HTTP body-derived headers are validated before masking.
 */
export function normalizeRecording(record) {
  const normalized = structuredClone(record);
  if (normalized.headers.date !== undefined) {
    assert(Number.isFinite(Date.parse(normalized.headers.date)), 'Invalid HTTP Date');
    normalized.headers.date = '<HTTP_DATE>';
  }
  if (normalized.headers['content-length'] !== undefined) {
    assert.equal(Number(normalized.headers['content-length']), Buffer.byteLength(record.wire), 'Content-Length mismatch');
    normalized.headers['content-length'] = '<BODY_BYTES>';
  }
  if (normalized.headers.etag !== undefined) {
    const bytes = Buffer.from(record.wire);
    const hash = createHash('sha1').update(bytes).digest('base64').substring(0, 27);
    assert.equal(normalized.headers.etag, `W/"${bytes.length.toString(16)}-${hash}"`, 'ETag mismatch');
    normalized.headers.etag = '<BODY_ETAG>';
  }
  if (record.wire.startsWith('data: ') || record.headers['content-type']?.startsWith('text/event-stream')) {
    const chunks = [...record.wire.matchAll(/^data: (.+)$/gm)]
      .filter(([, data]) => data !== '[DONE]').map(([, data]) => parseWire(data));
    validateBatches(chunks.flatMap(chunk => chunk.choices ?? [])
      .map(choice => choice.delta?.content ?? '').join(''));
    normalized.wire = record.wire.replace(/^data: (.+)$/gm, (line, data) =>
      data === '[DONE]' ? line : `data: ${JSON.stringify(normalizeChunk(JSON.parse(data)))}`);
  } else if (record.headers['content-type']?.includes('application/json')) {
    const chunk = parseWire(record.wire);
    validateBatches((chunk.choices ?? []).map(choice => choice.message?.content ?? '').join(''));
    normalized.wire = JSON.stringify(normalizeChunk(chunk));
  }
  for (const request of normalized.upstream) {
    for (const message of request.messages) {
      if (typeof message.content !== 'string' || !message.content.startsWith(payloadPrefix)) continue;
      const payload = parseWire(message.content.slice(payloadPrefix.length));
      for (const block of payload) {
        if (block.type === 'text') block.text = normalizePluginText(block.text);
      }
      message.content = payloadPrefix + JSON.stringify(payload);
    }
  }
  return normalized;
}
