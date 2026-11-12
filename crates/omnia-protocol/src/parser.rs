use crate::{
    ParseOptions, ToolCall,
    markers::{Markers, escape_at, find_escape, js_whitespace},
    reasoning, unescape_value,
};
use serde_json::{Map, Value};
use std::borrow::Cow;

/// Parses tool calls in response order after removing reasoning content.
///
/// Malformed fields follow the frozen scanner's recovery rules; an incomplete
/// block stops scanning. Missing/empty tool names discard the block unless a
/// `jev` field supplies the virtual JEV call. Fuzzy matching is opt-in.
pub fn parse_tool_calls(text: &str, opts: &ParseOptions) -> Vec<ToolCall> {
    let markers = Markers {
        fuzzy: opts.fuzzy_markers,
    };
    let visible = reasoning::strip_with_markers(text, markers);
    let mut calls = Vec::new();
    let mut cursor = 0;
    while let Some(start) = markers.block_start(&visible, cursor) {
        let Some(end) = markers.block_end(&visible, start.end) else {
            break;
        };
        let body = visible[start.end..end.start].trim_matches(js_whitespace);
        if let Some(call) = parse_block(body, markers) {
            calls.push(call);
        }
        cursor = end.end;
    }
    calls
}

fn parse_block(body: &str, markers: Markers) -> Option<ToolCall> {
    let mut call = ToolCall {
        name: String::new(),
        args: Map::new(),
        archery: false,
        archery_no_reply: false,
        mark_history: false,
        river: None,
        vref: None,
    };
    let mut jev = None;
    for (key, value) in scan_fields(body, markers) {
        let trimmed = value.trim_matches(js_whitespace);
        match key {
            "tool_name" => call.name = trimmed.to_owned(),
            "archery" => {
                call.archery = matches!(trimmed, "true" | "no_reply");
                call.archery_no_reply = trimmed == "no_reply";
            }
            "ink" => call.mark_history = trimmed == "mark_history",
            "river" => call.river = Some(trimmed.to_owned()),
            "vref" => call.vref = Some(trimmed.to_owned()),
            key if key.eq_ignore_ascii_case("jev") => jev = Some((key, value)),
            // A JavaScript ordinary object ignores string assignments to its
            // inherited __proto__ setter; it is not an own argument property.
            "__proto__" => {}
            _ => {
                call.args.insert(
                    key.to_owned(),
                    Value::String(normalize_value(&value).to_owned()),
                );
            }
        }
    }
    if let Some((key, value)) = jev {
        if call.name.is_empty() {
            call.name = "JEV".to_owned();
            call.args.insert(
                "expression".to_owned(),
                Value::String(value.trim_matches(js_whitespace).to_owned()),
            );
        } else {
            call.args.insert(
                key.to_owned(),
                Value::String(normalize_value(&value).to_owned()),
            );
        }
    }
    if call.name.is_empty() {
        return None;
    }
    let maid_empty = call
        .args
        .get("maid")
        .and_then(Value::as_str)
        .is_none_or(str::is_empty);
    if maid_empty
        && let Some(valet) = call
            .args
            .get("valet")
            .and_then(Value::as_str)
            .filter(|value| !value.is_empty())
    {
        call.args
            .insert("maid".to_owned(), Value::String(valet.to_owned()));
    }
    // JS own-property enumeration places canonical array-index keys first.
    let mut args: Vec<_> = call.args.into_iter().collect();
    args.sort_by(
        |(left, _), (right, _)| match (array_index(left), array_index(right)) {
            (Some(left), Some(right)) => left.cmp(&right),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (None, None) => std::cmp::Ordering::Equal,
        },
    );
    call.args = args.into_iter().collect();
    Some(call)
}

fn array_index(key: &str) -> Option<u32> {
    let index = key.parse::<u32>().ok()?;
    (index != u32::MAX && index.to_string() == key).then_some(index)
}

fn scan_fields(body: &str, markers: Markers) -> Vec<(&str, Cow<'_, str>)> {
    let mut fields = Vec::new();
    let mut cursor = 0;
    while cursor < body.len() {
        cursor = skip(body, cursor, |ch| js_whitespace(ch) || ch == ',');
        let key_start = cursor;
        cursor = skip(body, cursor, |ch| ch.is_ascii_alphanumeric() || ch == '_');
        if cursor == key_start {
            if let Some(ch) = body[cursor..].chars().next() {
                cursor += ch.len_utf8();
            } else {
                break;
            }
            continue;
        }
        let key = &body[key_start..cursor];
        cursor = skip(body, cursor, js_whitespace);
        if !body[cursor..].starts_with(':') {
            continue;
        }
        cursor = skip(body, cursor + 1, js_whitespace);
        let escape = escape_at(body, cursor, '始');
        let is_escape = escape.is_some();
        let Some(start) = escape.or_else(|| markers.field_start(body, cursor)) else {
            continue;
        };
        cursor = start.end;
        let end = if is_escape {
            find_escape(body, cursor, '末')
        } else {
            markers.field_end(body, cursor)
        };
        let Some(end) = end else { break };
        let raw = &body[cursor..end.start];
        let value = if is_escape {
            Cow::Owned(unescape_value(raw))
        } else {
            Cow::Borrowed(raw)
        };
        fields.push((key, value));
        cursor = end.end;
    }
    fields
}

fn skip(text: &str, from: usize, predicate: impl Fn(char) -> bool) -> usize {
    from + text[from..]
        .chars()
        .take_while(|ch| predicate(*ch))
        .map(char::len_utf8)
        .sum::<usize>()
}

fn normalize_value(value: &str) -> &str {
    let value = value
        .strip_prefix("\r\n")
        .or_else(|| value.strip_prefix('\n'))
        .unwrap_or(value);
    let value = value.trim_end_matches([' ', '\t']);
    value
        .strip_suffix("\r\n")
        .or_else(|| value.strip_suffix('\n'))
        .unwrap_or(value)
}

/// Partitions calls into `(normal, archery)`, preserving order within each group.
pub fn separate(calls: Vec<ToolCall>) -> (Vec<ToolCall>, Vec<ToolCall>) {
    calls.into_iter().partition(|call| !call.archery)
}
