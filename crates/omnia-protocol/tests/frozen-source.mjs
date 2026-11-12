import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import vm from "node:vm";

export const COMMIT = "a8560b0ae4e7b1a7803a88093a9ebee391e21a7c";

export function loadParser(repository) {
  const read = (path) => execFileSync("git", ["-C", repository, "show", `${COMMIT}:${path}`], { encoding: "utf8" });
  const matcherModule = { exports: {} };
  vm.runInNewContext(read("modules/vcpLoop/toolMarkerFuzzyMatcher.js"), {
    module: matcherModule,
    console: { log() {} },
  }, { filename: "frozen/toolMarkerFuzzyMatcher.js", timeout: 1000 });
  const parserModule = { exports: {} };
  vm.runInNewContext(read("modules/vcpLoop/toolCallParser.js"), {
    module: parserModule,
    require(name) {
      assert.equal(name, "./toolMarkerFuzzyMatcher");
      return matcherModule.exports;
    },
  }, { filename: "frozen/toolCallParser.js", timeout: 1000 });
  return { parser: parserModule.exports, matcher: matcherModule.exports };
}

export function evaluate({ parser, matcher }, testCase) {
  matcher.configure({ enabled: testCase.fuzzy_markers === true });
  switch (testCase.kind) {
    case "parse": return parser.parse(testCase.src);
    case "reasoning": return parser.stripReasoningBlocks(testCase.src);
    case "unescape": return parser._restoreEscapedLiterals(testCase.src);
    case "separate": return parser.separate(testCase.calls);
    default: throw new Error(`Unknown C-12 fixture kind: ${testCase.kind}`);
  }
}
