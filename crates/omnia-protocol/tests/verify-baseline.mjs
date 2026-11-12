import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { COMMIT, loadParser, evaluate } from "./frozen-source.mjs";

const [repository, rustProbe] = process.argv.slice(2);
if (!repository) {
  throw new Error("Usage: node crates/omnia-protocol/tests/verify-baseline.mjs <VCPToolBox checkout> [protocol_probe executable]");
}
const directory = new URL("../../../contract/fixtures/c12-parser/", import.meta.url);
const fixtures = readdirSync(directory).filter((name) => /-(pos|neg)\.json$/.test(name)).sort()
  .map((name) => JSON.parse(readFileSync(new URL(name, directory), "utf8")));
const oracle = loadParser(repository);
const plain = (value) => JSON.parse(JSON.stringify(value));
for (const testCase of fixtures) {
  assert.deepEqual(plain(evaluate(oracle, testCase)), testCase.expected, testCase.id);
}
process.stdout.write(`${fixtures.length} frozen C-12 fixtures match (${COMMIT}).\n`);

if (rustProbe) {
  const cases = [...fixtures];
  const atoms = ["a", " ", "\t", "\n", "\r", "\r\n", "\u0085", "\uFEFF", "\u2028", "\u2029", "🙂", "𐀀",
    "<think>", "</think>", "<ThOuGhT x='a'>", "</antthinking>", "<thinking>", "<think_>", "<thinké>", "<THINK>",
    "```", "````", "~~~", "`", "``", "(`・ω・´)ゞ", "(・`ω´・)", "[[VCP调用结果信息汇总:", "VCP调用结果结束]]",
    "[--- VCP元思考链 ---]\n", "[--- VCP元思考链: \"a\nb\" ---]\n", "[--- 元思考链结束 ---]\n",
    "<<<[TOOL_REQUEST]>>>", "<<<[END_TOOL_REQUEST]>>>", "<<[tool_request]>>>>", "<<<<[end_tool_request]>>",
    "tool_name:「始」Echo「末」", "x:「始ESCAPE」", "「末ESCAPE」", "{始escape}", "{末escape}",
    "<<<[TOOL_REQUEST_ESCAPE]>>>", "「始」", "「末」", "{始 junk}", "{末 junk}", "archery:「始」no_reply「末」", "jev:「始」x「末」"];
  let state = 0xC12;
  const random = (length) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % length;
  };
  const add = (id, src) => {
    cases.push({ id: `${id}-strict`, kind: "parse", src, fuzzy_markers: false });
    cases.push({ id: `${id}-fuzzy`, kind: "parse", src, fuzzy_markers: true });
    cases.push({ id: `${id}-reasoning`, kind: "reasoning", src });
  };
  for (let index = 0; index < 6000; index++) {
    let src = "";
    for (let token = 0, count = 3 + random(25); token < count; token++) src += atoms[random(atoms.length)];
    add(`atoms-${index}`, src);
  }
  const parseFixtures = fixtures.filter(({ kind }) => kind === "parse");
  for (let index = 0; index < 4000; index++) {
    const original = Array.from(parseFixtures[random(parseFixtures.length)].src);
    const offset = random(original.length + 1);
    original.splice(offset, random(5), atoms[random(atoms.length)]);
    add(`mutation-${index}`, original.join(""));
  }
  const keys = ["tool_name", "x", "jev", "JEV", "archery", "ink", "river", "vref", "valet", "maid", "__proto__", "constructor", "9", "2", "01", "éname", "名称", "a-b"];
  const values = ["", "Echo", "  x  ", "\n  code\n", "true", "no_reply", "false", "mark_history", "\uFEFF", "\u0085", "<think>keep</think>", "a\n \n", "🙂", "x\u2028", "\r\n\r\n"];
  const spaces = [" ", "\n", "\r", "\uFEFF", "\u0085", "\u2028", "\u00A0", ",", ""];
  for (let index = 0; index < 2000; index++) {
    let body = "tool_name:「始」Echo「末」";
    for (let field = 0; field < 8; field++) {
      body += spaces[random(spaces.length)] + keys[random(keys.length)] + spaces[random(spaces.length)] + ":" + spaces[random(spaces.length)] + "「始」" + values[random(values.length)] + "「末」";
    }
    add(`fields-${index}`, `<<<[TOOL_REQUEST]>>>${body}<<<[END_TOOL_REQUEST]>>>`);
  }
  const output = execFileSync(rustProbe, [], { input: JSON.stringify(cases), encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
  const actual = JSON.parse(output);
  assert.equal(actual.length, cases.length);
  for (const [index, testCase] of cases.entries()) {
    const expected = plain(evaluate(oracle, testCase));
    assert.deepEqual(actual[index], expected, `${testCase.id}: ${JSON.stringify(testCase.src)}`);
    if (testCase.kind === "parse") {
      for (let call = 0; call < expected.length; call++) {
        assert.deepEqual(Object.keys(actual[index][call].args), Object.keys(expected[call].args), `${testCase.id} argument order`);
      }
    }
  }
  process.stdout.write(`${cases.length} Rust/frozen Node differential cases match (seed 0xC12).\n`);
}
