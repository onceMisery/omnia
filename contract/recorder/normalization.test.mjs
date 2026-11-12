import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRecording } from './normalization.mjs';

test('normalization preserves SSE framing and ordinary numeric user content', () => {
  const record = { headers: { date: 'Thu, 12 Nov 2026 09:00:00 GMT' },
    wire: 'data: {"id":"chatcmpl-vcp-batch-123","created":1794474000,"choices":[{"delta":{"content":"user 123 at 2026-11-12"}}]}\n\n\ndata: [DONE]\n\n', upstream: [] };
  const normalized = normalizeRecording(record);
  assert.equal(normalized.wire, 'data: {"id":"chatcmpl-vcp-batch-<TIME>","created":"<EPOCH_SECONDS>","choices":[{"delta":{"content":"user 123 at 2026-11-12"}}]}\n\n\ndata: [DONE]\n\n');
  assert.equal(record.headers.date, 'Thu, 12 Nov 2026 09:00:00 GMT');
});

test('normalization refuses broken batch pairing and nonmonotonic times', () => {
  const wire = text => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
  assert.throws(() => normalizeRecording({ headers: {}, upstream: [], wire: wire('<<<[VCP_TOOL_BATCH_START:2026-11-12T09:00:00.000+00:00]>>>') }), /batch/);
  const batch = '<<<[VCP_TOOL_BATCH_START:2026-11-12T09:00:00.000+00:00]>>><<<[VCP_TOOL_BATCH_END:2026-11-12T09:00:00.000+00:00]>>>';
  assert.throws(() => normalizeRecording({ headers: {}, upstream: [], wire: wire(batch + batch) }), /monotonic/);
  assert.throws(() => normalizeRecording({ headers: {}, upstream: [], wire: wire(batch.replaceAll('.000+00:00', 'Z')) }), /timestamp/);
});

test('normalization rejects malformed generated fields and changed JSON whitespace', () => {
  const record = { headers: {}, upstream: [], wire: 'data: {"id":"chatcmpl-vcp-batch-123","created":{},"choices":[]}\n\n' };
  assert.throws(() => normalizeRecording(record), /created/);
  record.wire = 'data: { "choices":[]}\n\n';
  assert.throws(() => normalizeRecording(record), /serialization/);
  record.wire = 'data: {"choices":[]}\n\n';
  record.upstream = [{ messages: [{ content: '<!-- VCP_TOOL_PAYLOAD -->\n' + JSON.stringify([{ type: 'text', text: '{"timestamp":"2026-11-12TINVALID"}' }]) }] }];
  assert.throws(() => normalizeRecording(record), /timestamp/);
});
