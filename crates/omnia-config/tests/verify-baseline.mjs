import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";

const directory = new URL("../../../contract/fixtures/c06-dotenv/", import.meta.url);
const fixtures = readdirSync(directory)
  .filter((name) => /-(pos|neg)\.json$/.test(name))
  .sort()
  .map((name) => JSON.parse(readFileSync(new URL(name, directory), "utf8")));
const fixture = {
  baseline: { commit: "a8560b0ae4e7b1a7803a88093a9ebee391e21a7c" },
  cases: fixtures.filter(({ kind }) => kind === "parse"),
};
const repository = process.argv[2];
if (!repository) {
  throw new Error("Usage: node crates/omnia-config/tests/verify-baseline.mjs <VCPToolBox checkout>");
}
const source = execFileSync("git", ["-C", repository, "show",
  `${fixture.baseline.commit}:modules/dotenvPatch.js`], { encoding: "utf8" });
const dotenv = {};
// Execute the frozen source. Only its require boundary and startup log are isolated;
// the parser and regex are the actual implementation from the recorded commit.
vm.runInNewContext(source, {
  require(name) {
    assert.equal(name, "dotenv");
    return dotenv;
  },
  console: { log() {} },
}, { filename: "frozen/modules/dotenvPatch.js" });
let failed = 0;
for (const { id, src, expected } of fixture.cases) {
  const actual = JSON.parse(JSON.stringify(dotenv.parse(src)));
  try {
    assert.deepEqual(actual, expected, id);
  } catch (error) {
    failed++;
    process.stderr.write(`${error.message}\n`);
  }
}
if (failed) {
  throw new Error(`${failed} of ${fixture.cases.length} frozen C-06 cases differ`);
}
process.stdout.write(`${fixture.cases.length} frozen C-06 parser cases match (${fixture.baseline.commit}).\n`);

const rustParser = process.argv[3];
if (rustParser) {
  const cases = fixture.cases.map(({ id, src }) => ({ id, src }));
  const atoms = ["A", "B", "export ", "", "=", ":", " ", "\t", "\n", "\r\n", "#", "'", '"', "`", "\\n", "\\r", "\\'", '\\"', "\\`", "𐀀", "\u0085", "\uFEFF", "\u2028", "\u2029", "__proto__", ".@+", "one"];
  let state = 0xC06;
  for (let index = 0; index < 4000; index++) {
    let src = index % 2 ? "A=" : "";
    for (let token = 0; token < 20; token++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      src += atoms[state % atoms.length];
    }
    cases.push({ id: `generated-${index}`, src });
  }
  const output = execFileSync(rustParser, [], {
    input: JSON.stringify(cases.map(({ src }) => src)),
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  const actual = JSON.parse(output);
  assert.equal(actual.length, cases.length);
  for (let index = 0; index < cases.length; index++) {
    const { id, src } = cases[index];
    const expected = JSON.parse(JSON.stringify(dotenv.parse(src)));
    assert.deepEqual(actual[index], expected, `${id}: ${JSON.stringify(src)}`);
  }
  process.stdout.write(`${cases.length} Rust/frozen Node differential cases match (seed 0xC06).\n`);
}



