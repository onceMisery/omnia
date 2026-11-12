//! Marker matching ported from VCPToolBox toolMarkerFuzzyMatcher.js at a8560b0.
//! All offsets are UTF-8 byte offsets at character boundaries.

use regex::Regex;
use std::{ops::Range, sync::LazyLock};

pub(crate) const BLOCK_START: &str = "<<<[TOOL_REQUEST]>>>";
pub(crate) const BLOCK_END: &str = "<<<[END_TOOL_REQUEST]>>>";
pub(crate) const ESCAPE_START: &str = "「始ESCAPE」";
pub(crate) const ESCAPE_END: &str = "「末ESCAPE」";
pub(crate) const JS_WHITESPACE: &str = "\u{0009}\u{000A}\u{000B}\u{000C}\u{000D}\u{0020}\u{00A0}\u{1680}\u{2000}\u{2001}\u{2002}\u{2003}\u{2004}\u{2005}\u{2006}\u{2007}\u{2008}\u{2009}\u{200A}\u{2028}\u{2029}\u{202F}\u{205F}\u{3000}\u{FEFF}";

// These patterns are static program invariants. Invalid syntax is a programming
// error, never a failure caused by a model response.
static FUZZY_START: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"<{2,4}\[(?i-u:TOOL_REQUEST)\]>{2,4}").expect("constant block-start regex")
});
static FUZZY_END: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"<{2,4}\[(?i-u:END_TOOL_REQUEST)\]>{2,4}").expect("constant block-end regex")
});

#[derive(Clone, Copy)]
pub(crate) struct Markers {
    pub(crate) fuzzy: bool,
}

impl Markers {
    pub(crate) fn block_start(self, text: &str, from: usize) -> Option<Range<usize>> {
        self.block_marker(text, from, BLOCK_START, &FUZZY_START)
    }

    fn block_marker(
        self,
        text: &str,
        from: usize,
        canonical: &str,
        fuzzy: &Regex,
    ) -> Option<Range<usize>> {
        if self.fuzzy {
            fuzzy.find_at(text, from).map(|marker| marker.range())
        } else {
            text[from..].find(canonical).map(|relative| {
                let start = from + relative;
                start..start + canonical.len()
            })
        }
    }

    /// A closed ESCAPE region shields block ends, regardless of fuzzy mode.
    /// The baseline has no nested ESCAPE depth and rejects an unclosed region.
    pub(crate) fn block_end(self, text: &str, from: usize) -> Option<Range<usize>> {
        let mut cursor = from;
        while cursor < text.len() {
            let end = self.block_marker(text, cursor, BLOCK_END, &FUZZY_END)?;
            let Some(escape) = find_escape(text, cursor, '始') else {
                return Some(end);
            };
            if end.start < escape.start {
                return Some(end);
            }
            cursor = find_escape(text, escape.end, '末')?.end;
        }
        None
    }

    pub(crate) fn field_start(self, text: &str, from: usize) -> Option<Range<usize>> {
        self.field_marker_at(text, from, '始')
    }

    pub(crate) fn field_end(self, text: &str, from: usize) -> Option<Range<usize>> {
        text[from..].char_indices().find_map(|(offset, ch)| {
            matches!(ch, '「' | '{')
                .then(|| self.field_marker_at(text, from + offset, '末'))
                .flatten()
        })
    }

    fn field_marker_at(self, text: &str, from: usize, label: char) -> Option<Range<usize>> {
        let suffix = &text[from..];
        let mut chars = suffix.char_indices();
        let (_, open) = chars.next()?;
        if open != '「' && !(self.fuzzy && open == '{') {
            return None;
        }
        if chars.next()?.1 != label {
            return None;
        }
        let label_end = open.len_utf8() + label.len_utf8();
        let remainder = &suffix[label_end..];
        if remainder.starts_with('」') || (self.fuzzy && remainder.starts_with('}')) {
            let close_len = remainder.chars().next()?.len_utf8();
            return Some(from..from + label_end + close_len);
        }
        // Unlike the ESCAPE regex, this negative lookahead is case sensitive.
        if !self.fuzzy || remainder.starts_with("ESCAPE") {
            return None;
        }
        for (offset, ch) in remainder.char_indices() {
            if matches!(ch, '\r' | '\n' | '「' | '{') {
                return None;
            }
            if matches!(ch, '」' | '}') {
                return Some(from..from + label_end + offset + ch.len_utf8());
            }
        }
        None
    }
}

pub(crate) fn escape_at(text: &str, from: usize, label: char) -> Option<Range<usize>> {
    let suffix = &text[from..];
    let mut chars = suffix.chars();
    let open = chars.next()?;
    if !matches!(open, '「' | '{') || chars.next()? != label {
        return None;
    }
    let label_end = open.len_utf8() + label.len_utf8();
    let escape_word = suffix.get(label_end..label_end + 6)?;
    if !escape_word.eq_ignore_ascii_case("ESCAPE") {
        return None;
    }
    let close = suffix[label_end + 6..].chars().next()?;
    matches!(close, '」' | '}').then_some(from..from + label_end + 6 + close.len_utf8())
}

pub(crate) fn find_escape(text: &str, from: usize, label: char) -> Option<Range<usize>> {
    text[from..].char_indices().find_map(|(offset, ch)| {
        matches!(ch, '「' | '{')
            .then(|| escape_at(text, from + offset, label))
            .flatten()
    })
}

/// ECMAScript WhiteSpace + LineTerminator; Rust's Unicode White_Space differs.
pub(crate) fn js_whitespace(ch: char) -> bool {
    JS_WHITESPACE.contains(ch)
}
