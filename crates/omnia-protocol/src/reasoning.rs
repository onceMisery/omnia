//! Depth-aware reasoning removal from toolCallParser.js:23-422 (a8560b0).
mod literals;

use crate::markers::{JS_WHITESPACE, Markers};
use regex::Regex;
use std::{borrow::Cow, ops::Range, sync::LazyLock};

static TAG: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"<[ \t]*(/?)[ \t]*(?i-u:think(?:ing)?|thought|antthinking)(?-u:\b)(?:[ \t]+[^>\r\n<]*?)?[ \t]*>")
        .expect("constant reasoning-tag regex")
});
static META_START: LazyLock<Regex> = LazyLock::new(|| {
    // JavaScript \s excludes NEL and includes BOM. Both title and separator may
    // span lines in the baseline, despite the usual standalone-line spelling.
    let space = format!("[{}]", regex::escape(JS_WHITESPACE));
    Regex::new(&format!(r#"[ \t]*\[--- VCP元思考链(?::{space}*"[^"]*")?{space}*---\][ \t]*(?<ending>\r?\n|[\r\u{{2028}}\u{{2029}}]|\z)"#))
        .expect("constant meta-reasoning start regex")
});
static META_END: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"[ \t]*\[--- 元思考链结束 ---\][ \t]*(?<ending>\r?\n|[\r\u{2028}\u{2029}]|\z)")
        .expect("constant meta-reasoning end regex")
});

/// Removes C-12 reasoning blocks while preserving top-level literal domains.
///
/// Nested reasoning, headless closing tags, incomplete streams and VCP meta
/// thought blocks follow the frozen parser. Complete canonical tool requests,
/// Markdown code and tool results protect their contents only at depth zero.
/// The standalone helper uses canonical tool markers; `parse_tool_calls` applies
/// its `ParseOptions` to the same reasoning scanner.
pub fn strip_reasoning_blocks(text: &str) -> String {
    strip_with_markers(text, Markers { fuzzy: false })
}

pub(crate) fn strip_with_markers(text: &str, markers: Markers) -> String {
    let cleaned = strip_meta(text);
    if !cleaned.contains('<') {
        return cleaned.into_owned();
    }
    let text = cleaned.as_ref();
    let literals = literals::collect(text);
    let tools = tool_candidates(text, markers, &literals);
    let mut output = String::new();
    let mut cursor = 0;
    let mut scan = 0;
    let mut depth = 0;
    let mut closed_any = false;
    while let Some(captures) = TAG.captures_at(text, scan) {
        // Capture zero and the slash group occur in every match of TAG.
        let tag = captures.get(0).expect("reasoning tag has a full match");
        let closing = &captures[1] == "/";
        scan = tag.end();
        if depth == 0 {
            if let Some(range) =
                containing(&literals, tag.start()).or_else(|| containing(&tools, tag.start()))
            {
                scan = range.end;
                continue;
            }
            if closing {
                if !closed_any && at_line_end_or_start(text, tag.start(), tag.end()) {
                    output.clear();
                    closed_any = true;
                    cursor = tag.end();
                    continue;
                }
                output.push_str(&text[cursor..tag.start()]);
                cursor = tag.end();
                continue;
            }
            if !at_line_start(text, tag.start())
                && !matching_close_ahead(text, tag.end(), &literals, &tools)
            {
                continue;
            }
            output.push_str(&text[cursor..tag.start()]);
            depth = 1;
        } else if closing {
            depth -= 1;
            if depth == 0 {
                closed_any = true;
            }
        } else {
            depth += 1;
        }
        cursor = tag.end();
    }
    if depth == 0 {
        output.push_str(&text[cursor..]);
    }
    output
}

fn containing(ranges: &[Range<usize>], index: usize) -> Option<&Range<usize>> {
    let candidate = ranges.partition_point(|range| range.end <= index);
    ranges.get(candidate).filter(|range| range.contains(&index))
}

fn tool_candidates(text: &str, markers: Markers, literals: &[Range<usize>]) -> Vec<Range<usize>> {
    let mut candidates = Vec::new();
    let mut cursor = 0;
    while let Some(start) = markers.block_start(text, cursor) {
        if containing(literals, start.start).is_some() {
            cursor = start.end;
            continue;
        }
        let Some(end) = markers.block_end(text, start.end) else {
            break;
        };
        candidates.push(start.start..end.end);
        cursor = end.end;
    }
    candidates
}

fn at_line_start(text: &str, index: usize) -> bool {
    literals::horizontal_space(&text[literals::line_start(text, index)..index])
}

fn at_line_end_or_start(text: &str, start: usize, end: usize) -> bool {
    at_line_start(text, start)
        || literals::trailing_space(&text[end..literals::line_end(text, end)])
}

fn matching_close_ahead(
    text: &str,
    from: usize,
    literals: &[Range<usize>],
    tools: &[Range<usize>],
) -> bool {
    let mut depth = 1;
    for captures in TAG.captures_iter(&text[from..]) {
        let start = from
            + captures
                .get(0)
                .expect("reasoning tag has a full match")
                .start();
        if containing(literals, start).is_some() || containing(tools, start).is_some() {
            continue;
        }
        if &captures[1] == "/" {
            depth -= 1;
            if depth == 0 {
                return true;
            }
        } else {
            depth += 1;
        }
    }
    false
}

fn strip_meta(text: &str) -> Cow<'_, str> {
    if !text.contains("[--- VCP元思考链") {
        return Cow::Borrowed(text);
    }
    let literals = literals::collect(text);
    let mut output = String::new();
    let mut cursor = 0;
    let mut scan = 0;
    while let Some(start) = find_meta(&META_START, text, scan) {
        scan = start.end;
        if containing(&literals, start.start).is_some() {
            continue;
        }
        output.push_str(&text[cursor..start.start]);
        let mut end = find_meta(&META_END, text, start.end);
        while let Some(marker) = &end {
            if containing(&literals, marker.start).is_none() {
                break;
            }
            end = find_meta(&META_END, text, marker.end);
        }
        let Some(end) = end else {
            return Cow::Owned(output);
        };
        cursor = end.end;
        scan = cursor;
    }
    output.push_str(&text[cursor..]);
    Cow::Owned(output)
}

/// Reproduces JS /gm anchors, including standalone CR, U+2028 and U+2029.
/// The latter line terminators satisfy `$` without being consumed by `\r?\n`.
fn find_meta(regex: &Regex, text: &str, mut from: usize) -> Option<Range<usize>> {
    while let Some(captures) = regex.captures_at(text, from) {
        let matched = captures.get(0).expect("meta regex has a full match");
        let start = matched.start();
        let line_start = start == 0
            || text[..start]
                .chars()
                .next_back()
                .is_some_and(|ch| matches!(ch, '\r' | '\n' | '\u{2028}' | '\u{2029}'));
        if line_start {
            let ending = captures
                .name("ending")
                .expect("meta regex includes its line ending");
            let end = if ending.as_str().ends_with('\n') {
                matched.end()
            } else {
                ending.start()
            };
            return Some(start..end);
        }
        // META_START and META_END each contain a nonempty literal token.
        from = start
            + text[start..]
                .chars()
                .next()
                .expect("meta match is nonempty")
                .len_utf8();
    }
    None
}
