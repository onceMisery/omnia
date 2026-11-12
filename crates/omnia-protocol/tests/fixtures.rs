use omnia_protocol::{
    ParseOptions, ToolCall, parse_tool_calls, separate, strip_reasoning_blocks, unescape_value,
};
use serde_json::{Value, json};
use std::{fs, path::Path};

#[test]
fn frozen_c12_cases() {
    let directory =
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../../contract/fixtures/c12-parser");
    let mut paths: Vec<_> = fs::read_dir(directory)
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .filter(|path| {
            path.to_str().unwrap().ends_with("-pos.json")
                || path.to_str().unwrap().ends_with("-neg.json")
        })
        .collect();
    paths.sort();
    assert!(paths.len() >= 80, "C-12 fixtures must be present");
    let mut failures = Vec::new();
    for path in paths {
        let case: Value = serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        let src = case["src"].as_str().unwrap_or("");
        let actual = match case["kind"].as_str().unwrap() {
            "parse" => serde_json::to_value(parse_tool_calls(
                src,
                &ParseOptions {
                    fuzzy_markers: case["fuzzy_markers"] == true,
                },
            ))
            .unwrap(),
            "reasoning" => json!(strip_reasoning_blocks(src)),
            "unescape" => json!(unescape_value(src)),
            "separate" => {
                let calls: Vec<ToolCall> = serde_json::from_value(case["calls"].clone()).unwrap();
                let (normal, archery) = separate(calls);
                json!({ "normal": normal, "archery": archery })
            }
            kind => panic!("unknown C-12 fixture kind {kind}"),
        };
        if actual != case["expected"] {
            failures.push(format!(
                "{}: expected {}, got {}",
                path.display(),
                case["expected"],
                actual
            ));
        }
    }
    assert!(failures.is_empty(), "{}", failures.join("\n"));
}
