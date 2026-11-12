#!/usr/bin/env node
// Observational recorder: creates new candidate files and never overwrites an
// accepted fixture. Review candidate outputs independently before accepting.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { cases } from './source-fixture-cases.mjs';
import { evidenceOrigin, runSourceFixture } from './source-fixture-runners.mjs';

const outputRoot = resolve(process.argv[2] ?? 'target/source-fixture-candidates');
for (const definition of cases) {
  const result = await runSourceFixture(definition.runner, definition.input);
  const directory = join(outputRoot, definition.directory);
  await mkdir(directory, { recursive: true });
  const fixture = { schema: 'omnia-source-fixture-v1', runner: definition.runner,
    input: definition.input, expected: result.output };
  const origin = evidenceOrigin(definition.runner);
  const meta = { schema: 'omnia-source-fixture-meta-v1', origin,
    rules: definition.rules, sources: result.sources,
    normalization: ['Synthetic inputs only.', 'Date.now is fixed to 1730000000000 when used.',
      ...(definition.runner === 'frontend-assistant-origin' ? ['Math.random is fixed to 0.125 for assistant ID creation.'] : []),
      'Temporary history root is rendered as <APPDATA>; path separators are normalized in error text.'],
    limitations: [origin === 'source-derived-static'
      ? 'Source or approved design evidence only; not a runtime trace.'
      : 'Frozen original functions or statement ranges run in a Node VM. Declared IO seams are supplied by the runner; this is not a full server or Electron end-to-end run.',
    ...(definition.runner === 'history-file' ? ['Uses real files with a narrow Node fs adapter at the fs-extra IO boundary; rename failure is injected.'] : []),
    ...definition.limitations] };
  await writeFile(join(directory, `${definition.name}.json`), JSON.stringify(fixture, null, 2) + '\n', { flag: 'wx' });
  await writeFile(join(directory, `${definition.name}.meta.json`), JSON.stringify(meta, null, 2) + '\n', { flag: 'wx' });
}
console.log(`Recorded ${cases.length} fixed source fixtures into ${outputRoot}.`);
