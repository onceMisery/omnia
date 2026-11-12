use crate::markers::{BLOCK_END, BLOCK_START, ESCAPE_END, ESCAPE_START, find_escape};

/// Encloses a field value in the C-12 ESCAPE domain.
///
/// Standard field and tool markers may occur in `raw` unchanged. The frozen
/// grammar does not nest ESCAPE domains: a literal ESCAPE end marker in `raw`
/// will terminate the encoded field, and escaped-literal spellings are restored
/// by the parser. This helper does not invent an additional encoding layer.
pub fn escape_value(raw: &str) -> String {
    format!("{ESCAPE_START}{raw}{ESCAPE_END}")
}

/// Restores escaped literal spellings in a field's content (C-12 §13.3).
///
/// Pass the content inside the ESCAPE domain, excluding its outer delimiters.
/// Canonical spellings are replaced globally; only the first noncanonical start
/// and end variant are replaced, as in the frozen JavaScript implementation.
pub fn unescape_value(raw: &str) -> String {
    let mut restored = raw
        .replace("<<<[TOOL_REQUEST_ESCAPE]>>>", BLOCK_START)
        .replace("<<<[END_TOOL_REQUEST_ESCAPE]>>>", BLOCK_END)
        .replace(ESCAPE_START, "「始」")
        .replace(ESCAPE_END, "「末」");
    for (label, canonical) in [('始', "「始」"), ('末', "「末」")] {
        if let Some(marker) = find_escape(&restored, 0, label) {
            restored.replace_range(marker, canonical);
        }
    }
    restored
}
