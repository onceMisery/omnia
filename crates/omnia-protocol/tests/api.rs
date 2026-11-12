use omnia_protocol::{ParseOptions, escape_value, parse_tool_calls, unescape_value};
use serde_json::json;

#[test]
fn escaped_field_round_trips_standard_tool_and_field_markers() {
    let raw = "<<<[TOOL_REQUEST]>>>\ntool_name:「始」Literal「末」\n<<<[END_TOOL_REQUEST]>>>";
    let encoded = escape_value(raw);
    assert_eq!(encoded, format!("「始ESCAPE」{raw}「末ESCAPE」"));
    let text = format!(
        "<<<[TOOL_REQUEST]>>>tool_name:「始」Echo「末」code:{encoded}<<<[END_TOOL_REQUEST]>>>"
    );
    let calls = parse_tool_calls(&text, &ParseOptions::default());
    assert_eq!(calls.len(), 1);
    assert_eq!(calls[0].name, "Echo");
    assert_eq!(
        calls[0].args,
        json!({ "code": raw }).as_object().unwrap().clone()
    );
    assert_eq!(unescape_value(raw), raw);
}

#[test]
fn escape_domain_is_not_an_arbitrary_literal_codec() {
    let encoded = escape_value("before「末ESCAPE」after");
    assert_eq!(encoded, "「始ESCAPE」before「末ESCAPE」after「末ESCAPE」");
    let text = format!(
        "<<<[TOOL_REQUEST]>>>tool_name:「始」Echo「末」x:{encoded}<<<[END_TOOL_REQUEST]>>>"
    );
    let calls = parse_tool_calls(&text, &ParseOptions::default());
    assert_eq!(calls[0].args["x"], "before");
}

#[test]
fn argument_iteration_matches_javascript_integer_key_order() {
    let text = "<<<[TOOL_REQUEST]>>>tool_name:「始」Echo「末」9:「始」a「末」x:「始」b「末」2:「始」c「末」02:「始」d「末」1:「始」e「末」x:「始」last「末」<<<[END_TOOL_REQUEST]>>>";
    let calls = parse_tool_calls(text, &ParseOptions::default());
    assert_eq!(
        calls[0].args.keys().map(String::as_str).collect::<Vec<_>>(),
        ["1", "2", "9", "x", "02"]
    );
    assert_eq!(calls[0].args["x"], "last");
}

#[test]
fn options_are_local_and_fuzzy_defaults_off() {
    let text = "<<[tool_request]>>tool_name:{始}Echo{末}<<[end_tool_request]>>";
    assert!(!ParseOptions::default().fuzzy_markers);
    assert_eq!(
        parse_tool_calls(
            text,
            &ParseOptions {
                fuzzy_markers: true
            }
        )
        .len(),
        1
    );
    assert!(parse_tool_calls(text, &ParseOptions::default()).is_empty());
}
