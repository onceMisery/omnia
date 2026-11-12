use omnia_config::load_dotenv_patched;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::Path;

#[test]
fn frozen_c06_parser_cases() {
    let directory =
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../../contract/fixtures/c06-dotenv");
    let mut paths: Vec<_> = fs::read_dir(directory)
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .filter(|path| {
            path.to_str().unwrap().ends_with("-pos.json")
                || path.to_str().unwrap().ends_with("-neg.json")
        })
        .collect();
    paths.sort();
    let cases: Vec<Value> = paths
        .into_iter()
        .map(|path| serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap())
        .filter(|case: &Value| case["kind"] == "parse")
        .collect();
    assert!(cases.len() >= 32);
    let failures: Vec<_> = cases
        .iter()
        .filter_map(|case| {
            let expected: HashMap<String, String> =
                serde_json::from_value(case["expected"].clone()).unwrap();
            let actual = load_dotenv_patched(case["src"].as_str().unwrap());
            (actual != expected)
                .then(|| format!("{}: expected {expected:?}, got {actual:?}", case["id"]))
        })
        .collect();
    assert!(failures.is_empty(), "{}", failures.join("\n"));
}
