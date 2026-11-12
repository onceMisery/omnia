const tool = (name, mode = 'text', extra = '') => `<<<[TOOL_REQUEST]>>>\ntool_name:「始」${name}「末」\nmode:「始」${mode}「末」\n${extra}\n<<<[END_TOOL_REQUEST]>>>`;
const echo = (mode, extra) => tool('FixtureEcho', mode, extra);

// Fixed synthetic model outputs; no real model or user plugin is involved.
export const scenarios = [
  { id: 'text-nonstream', stream: false },
  { id: 'text-stream', stream: true },
  { id: 'tool-nonstream', stream: false, reply: echo() },
  { id: 'tool-stream-hidden', stream: true, reply: echo(), visible: false },
  { id: 'tool-stream-visible', stream: true, reply: echo(), forceVisible: true, visible: true },
  { id: 'multi-nonstream', stream: false, reply: echo() + '\n' + tool('FixtureSecond') },
  { id: 'multi-stream', stream: true, reply: echo() + '\n' + tool('FixtureSecond') },
  { id: 'tool-error-nonstream', stream: false, reply: echo('error') },
  { id: 'tool-error-stream', stream: true, reply: echo('error') },
  { id: 'tool-inner-error', stream: false, reply: echo('inner-error') },
  { id: 'tool-missing', stream: false, reply: tool('MissingFixture') },
  { id: 'json-result-string', stream: false, reply: echo('json-string') },
  { id: 'plain-result-string', stream: true, reply: echo('plain-string') },
  { id: 'json-success-nonzero-exit', stream: false, reply: echo('exit-one') },
  { id: 'rich-text', stream: false, reply: echo('rich-text') },
  { id: 'rich-image', stream: true, reply: echo('rich-image') },
  { id: 'image-only', stream: false, reply: echo('image-only') },
  { id: 'base64-value', stream: false, reply: echo('base64') },
  { id: 'mark-history', stream: true, reply: echo('text', 'ink:「始」mark_history「末」'), visible: true },
  { id: 'valet-mirror', stream: false, reply: echo('text', 'valet:「始」合成调用者「末」') },
  { id: 'archery-success', stream: false, reply: echo('text', 'archery:「始」true「末」'), archeryOnly: true },
  { id: 'archery-error', stream: true, reply: echo('error', 'archery:「始」true「末」'), archeryOnly: true },
  { id: 'mixed-archery', stream: true, reply: echo() + '\n' + tool('FixtureSecond', 'text', 'archery:「始」true「末」') },
  { id: 'loop-limit', stream: true, reply: echo(), repeat: true },
  { id: 'interrupt-nonstream', stream: false, interrupt: true },
  { id: 'interrupt-stream', stream: true, interrupt: true },
];

export const pluginSource = String.raw`
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const args = input ? JSON.parse(input) : {};
  let result;
  switch (args.mode) {
    case 'error': process.stdout.write(JSON.stringify({ status:'error', error:'synthetic-error' })); return;
    case 'inner-error': result = { success:false, error:'synthetic-inner-error' }; break;
    case 'json-string': result = JSON.stringify({ message:'synthetic-json-string' }); break;
    case 'plain-string': result = 'synthetic-plain-string'; break;
    case 'rich-text': result = { content:[{type:'text',text:'first'},{type:'text',text:'second'}] }; break;
    case 'rich-image': result = { content:[{type:'text',text:'caption'},{type:'image_url',image_url:{url:'data:image/png;base64,iVBORw0KGgo='}}] }; break;
    case 'image-only': result = { content:[{type:'image_url',image_url:{url:'data:image/png;base64,iVBORw0KGgo='}}] }; break;
    case 'base64': result = { value:'data:image/png;base64,iVBORw0KGgo=' }; break;
    default: result = { message:'synthetic-ok', args };
  }
  process.stdout.write(JSON.stringify({ status:'success', result }));
  if (args.mode === 'exit-one') process.exitCode = 1;
});
`;
