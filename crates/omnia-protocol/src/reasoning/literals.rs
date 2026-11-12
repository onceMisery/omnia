//! Literal protection ranges for the reasoning scanner, in UTF-8 bytes.
use regex::Regex;
use std::{ops::Range, sync::LazyLock};

const RESULT_OPEN: &str = "[[VCP调用结果信息汇总:";
const RESULT_CLOSE: &str = "VCP调用结果结束]]";
const EMOTICONS: [&str; 4] = ["(`・ω・´)ゞ", "(・`ω´・)", "(`・ω・´)", "(`･ω･´)"];
static PARAGRAPH: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\r?\n[ \t]*\r?\n").expect("constant paragraph-boundary regex"));

pub(super) fn collect(text: &str) -> Vec<Range<usize>> {
    let mut ranges = Vec::new();
    let mut cursor = 0;
    while cursor < text.len() {
        if text[cursor..].starts_with(RESULT_OPEN) {
            let end = result_end(text, cursor);
            ranges.push(cursor..end);
            cursor = end;
            continue;
        }
        let byte = text.as_bytes()[cursor];
        if matches!(byte, b'`' | b'~') {
            let run = count_run(text, cursor, byte);
            if let Some(end) = fence_end(text, cursor, byte, run) {
                ranges.push(cursor..end);
                cursor = end;
                continue;
            }
            if byte == b'`' {
                if run == 1 && is_emoticon(text, cursor) {
                    cursor += 1;
                    continue;
                }
                if let Some(end) = inline_end(text, cursor + run, run) {
                    ranges.push(cursor..end);
                    cursor = end;
                } else {
                    cursor += run;
                }
                continue;
            }
        }
        // Non-ASCII characters have no structural meaning in this branch.
        // Advancing by the scalar keeps every range endpoint valid UTF-8.
        cursor += text[cursor..]
            .chars()
            .next()
            .expect("cursor is before the end of text")
            .len_utf8();
    }
    ranges
}

fn result_end(text: &str, start: usize) -> usize {
    let mut depth = 1;
    let mut cursor = start + RESULT_OPEN.len();
    while let Some(close) = text[cursor..]
        .find(RESULT_CLOSE)
        .map(|offset| cursor + offset)
    {
        if let Some(open) = text[cursor..]
            .find(RESULT_OPEN)
            .map(|offset| cursor + offset)
            && open < close
        {
            depth += 1;
            cursor = open + RESULT_OPEN.len();
            continue;
        }
        depth -= 1;
        cursor = close + RESULT_CLOSE.len();
        if depth == 0 {
            return cursor;
        }
    }
    text.len()
}

fn count_run(text: &str, from: usize, byte: u8) -> usize {
    text.as_bytes()[from..]
        .iter()
        .take_while(|candidate| **candidate == byte)
        .count()
}

pub(super) fn line_end(text: &str, from: usize) -> usize {
    text[from..]
        .find('\n')
        .map_or(text.len(), |offset| from + offset)
}

pub(super) fn line_start(text: &str, from: usize) -> usize {
    text[..from].rfind('\n').map_or(0, |offset| offset + 1)
}

pub(super) fn horizontal_space(text: &str) -> bool {
    text.bytes().all(|byte| matches!(byte, b' ' | b'\t'))
}

pub(super) fn trailing_space(text: &str) -> bool {
    horizontal_space(text.strip_suffix('\r').unwrap_or(text))
}

fn fence_end(text: &str, start: usize, byte: u8, run: usize) -> Option<usize> {
    let prefix = &text[line_start(text, start)..start];
    let open_line_end = line_end(text, start + run);
    let info = &text[start + run..open_line_end];
    if run < 3
        || prefix.len() > 3
        || !horizontal_space(prefix)
        || (byte == b'`' && info.contains('`'))
    {
        return None;
    }
    let mut cursor = if open_line_end < text.len() {
        open_line_end + 1
    } else {
        text.len()
    };
    loop {
        let end = line_end(text, cursor);
        let indent = text.as_bytes()[cursor..end]
            .iter()
            .take(3)
            .take_while(|byte| matches!(byte, b' ' | b'\t'))
            .count();
        let marker_start = cursor + indent;
        if text.as_bytes().get(marker_start) == Some(&byte) {
            let close_run = count_run(text, marker_start, byte);
            if close_run >= run && trailing_space(&text[marker_start + close_run..end]) {
                return Some(if end < text.len() { end + 1 } else { end });
            }
        }
        if end == text.len() {
            return Some(end);
        }
        cursor = end + 1;
    }
}

fn is_emoticon(text: &str, backtick: usize) -> bool {
    EMOTICONS.iter().any(|emoticon| {
        // Every literal above contains one ASCII backtick.
        let offset = emoticon.find('`').expect("emoticon includes a backtick");
        backtick
            .checked_sub(offset)
            .and_then(|start| text.get(start..))
            .is_some_and(|suffix| suffix.starts_with(emoticon))
    })
}

fn inline_end(text: &str, from: usize, run: usize) -> Option<usize> {
    let limit = PARAGRAPH
        .find(&text[from..])
        .map_or(text.len(), |boundary| from + boundary.start());
    let mut cursor = from;
    while cursor < limit {
        let next = text[cursor..].find('`').map(|offset| cursor + offset)?;
        if next >= limit {
            break;
        }
        let close_run = count_run(text, next, b'`');
        if close_run == run {
            return Some(next + close_run);
        }
        cursor = next + close_run;
    }
    None
}
