//! JSON stdin/stdout adapter for the frozen-Node differential test harness.
use omnia_protocol::{
    ParseOptions, ToolCall, parse_tool_calls, separate, strip_reasoning_blocks, unescape_value,
};
use serde::Deserialize;
use serde_json::{Value, json};
use std::io;

#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
enum Case {
    Parse {
        src: String,
        #[serde(default)]
        fuzzy_markers: bool,
    },
    Reasoning {
        src: String,
    },
    Unescape {
        src: String,
    },
    Separate {
        calls: Vec<ToolCall>,
    },
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cases: Vec<Case> = serde_json::from_reader(io::stdin().lock())?;
    let results: Vec<Value> = cases
        .into_iter()
        .map(|case| match case {
            Case::Parse { src, fuzzy_markers } => {
                json!(parse_tool_calls(&src, &ParseOptions { fuzzy_markers }))
            }
            Case::Reasoning { src } => json!(strip_reasoning_blocks(&src)),
            Case::Unescape { src } => json!(unescape_value(&src)),
            Case::Separate { calls } => {
                let (normal, archery) = separate(calls);
                json!({ "normal": normal, "archery": archery })
            }
        })
        .collect();
    serde_json::to_writer(io::stdout().lock(), &results)?;
    Ok(())
}
