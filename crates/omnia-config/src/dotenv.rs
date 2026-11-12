use regex::Regex;
use std::collections::HashMap;
use std::sync::LazyLock;

// ECMAScript \s excludes U+0085 and includes U+FEFF; Rust's Unicode \s differs.
const JS_WHITESPACE: &str = r"[\t\n\x0B\x0C\r \u{00A0}\u{1680}\u{2000}-\u{200A}\u{2028}\u{2029}\u{202F}\u{205F}\u{3000}\u{FEFF}]";

static LINE: LazyLock<Regex> = LazyLock::new(|| {
    js_regex(
        r#"(\A|[\n\u{2028}\u{2029}])\s*(?:export\s+)?(?P<key>[A-Za-z0-9_.@#%&^+\-]+)(?:\s*=\s*?|:\s+?)(?P<value>\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#[^\n\u{2028}\u{2029}]*)?(?P<end>[\n\u{2028}\u{2029}]|\z)"#,
    )
});
static TRIM: LazyLock<Regex> = LazyLock::new(|| js_regex(r"\A\s+|\s+\z"));
static QUOTES: LazyLock<Regex> = LazyLock::new(|| {
    js_regex(
        r#"(?P<before>\A|[\n\u{2028}\u{2029}])(?:'(?P<single>(?s:.*))'|"(?P<double>(?s:.*))"|`(?P<backtick>(?s:.*))`)(?P<end>[\n\u{2028}\u{2029}]|\z)"#,
    )
});

fn js_regex(pattern: &str) -> Regex {
    // These are fixed, tested expressions; invalid syntax is a programming error,
    // never a failure caused by a configuration document.
    Regex::new(&pattern.replace(r"\s", JS_WHITESPACE))
        .expect("fixed C-06 compatibility regex must compile")
}

/// Parse a VCP dotenv document using the frozen C-06 patch.
///
/// Keeps unknown keys, accepts multiline single/double/backtick quotes, expands
/// only double-quoted `\n`/`\r`, and keeps the final assignment to each key.
/// This pure function neither reads nor changes the process environment.
///
/// The frozen JavaScript object setter discards `__proto__` assignments; that
/// behavior is retained. Malformed lines are ignored as in the original regex.
pub fn load_dotenv_patched(src: &str) -> HashMap<String, String> {
    parse_entries(src).into_iter().collect()
}

// The first insertion position survives exact duplicate assignments in the JS
// object. Windows dotenv population then keeps the first case-insensitive key.
pub(crate) fn parse_entries(src: &str) -> Vec<(String, String)> {
    let normalized = src.replace("\r\n", "\n").replace('\r', "\n");
    let mut values: Vec<(String, String)> = Vec::new();
    let mut positions: HashMap<String, usize> = HashMap::new();
    let mut cursor = 0;
    while let Some(captures) = LINE.captures_at(&normalized, cursor) {
        let key = &captures["key"];
        let raw = captures.name("value").map_or("", |value| value.as_str());
        let trimmed = TRIM.replace_all(raw, "");
        let double_quoted = trimmed.starts_with('"');
        let mut value = strip_quotes(&trimmed);
        if double_quoted {
            value = value.replace(r"\n", "\n").replace(r"\r", "\r");
        }
        if key != "__proto__" {
            if let Some(&position) = positions.get(key) {
                values[position].1 = value;
            } else {
                positions.insert(key.to_owned(), values.len());
                values.push((key.to_owned(), value));
            }
        }

        // Consuming the boundary emulates JS multiline anchors, including
        // U+2028/U+2029. Reuse it for the next match because JS $ is zero-width.
        cursor = captures
            .name("end")
            .expect("end group always matches")
            .start();
        if cursor == normalized.len() {
            break;
        }
    }
    values
}

fn strip_quotes(value: &str) -> String {
    // The original /^(['"`])([\s\S]*)\1$/mg replacement can also remove a
    // quote pair on a later logical line of an otherwise unquoted value.
    let mut result = String::new();
    let mut copied = 0;
    let mut cursor = 0;
    while let Some(captures) = QUOTES.captures_at(value, cursor) {
        let before = captures
            .name("before")
            .expect("before group always matches");
        let end = captures
            .name("end")
            .expect("end group always matches")
            .start();
        result.push_str(&value[copied..before.end()]);
        let inner = captures
            .name("single")
            .or_else(|| captures.name("double"))
            .or_else(|| captures.name("backtick"))
            .expect("one quote alternative always matches");
        result.push_str(inner.as_str());
        copied = end;
        cursor = end;
        if cursor == value.len() {
            break;
        }
    }
    result.push_str(&value[copied..]);
    result
}
