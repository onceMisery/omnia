//! VCP text protocol (C-12; US-003 through US-005).
//!
//! Adapted from VCPToolBox's toolCallParser.js and toolMarkerFuzzyMatcher.js,
//! commit a8560b0ae4e7b1a7803a88093a9ebee391e21a7c (CC-BY-NC-SA-4.0).

mod escape;
mod markers;
mod parser;
mod reasoning;

pub use escape::{escape_value, unescape_value};
pub use parser::{parse_tool_calls, separate};
pub use reasoning::strip_reasoning_blocks;

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
/// A parsed C-12 tool request. Argument values produced by the parser are strings.
/// Serialization retains the frozen JavaScript field names and argument order.
pub struct ToolCall {
    /// Tool name, with surrounding ECMAScript whitespace removed.
    pub name: String,
    /// Ordinary fields, preserving code indentation and last-write values.
    pub args: Map<String, Value>,
    /// Whether the call belongs to the archery group.
    pub archery: bool,
    /// Whether `archery` was exactly `no_reply`.
    pub archery_no_reply: bool,
    /// Whether `ink` was exactly `mark_history`.
    pub mark_history: bool,
    /// Optional memory addressing value, including an explicit empty string.
    pub river: Option<String>,
    /// Optional reference addressing value, including an explicit empty string.
    pub vref: Option<String>,
}

/// Parsing options; canonical case-sensitive markers are the default.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct ParseOptions {
    /// Enables the frozen fuzzy block and field marker grammar.
    pub fuzzy_markers: bool,
}
