use std::{cell::RefCell, rc::Rc};

use gpui_kit::test::TestWindowExt;
use gpui_kit::{AppContext, TestAppContext, WindowOptions};
use gpui_shell::{HostModule, HostValue, ShellRuntime, policy::Policy};

#[gpui_kit::test]
fn host_calls_round_trip_plain_data_in_insertion_order(cx: &mut TestAppContext) {
    let directory = tempfile::tempdir().unwrap();
    let script = r#"
import { View, div } from 'gpui-kit';
import { inspect } from 'omnia-probe';
export default class Probe extends View {
  init() {
    try {
      const value = inspect({ zh: '中文', n: 42.5, b: true, nil: null, arr: [1, '二', { k: 'v' }] });
      this.result = JSON.stringify(value);
    } catch (error) {
      this.result = `failure:${error.message}`;
    }
  }
  render() { return div().child(this.result); }
}
"#;
    std::fs::write(directory.path().join("main.js"), script).unwrap();
    let seen = Rc::new(RefCell::new(None));
    let capture = seen.clone();
    cx.update(gpui_kit::init);
    cx.update(gpui_shell::init);
    gpui_shell::policy::set_default(
        Policy::new()
            .with_host_module(
                HostModule::new("omnia-probe").function("inspect", move |args| {
                    let value = args.value(0)?.clone();
                    *capture.borrow_mut() = Some(value.clone());
                    Ok(HostValue::Object(vec![
                        ("z".into(), HostValue::Str("末".into())),
                        ("a".into(), HostValue::Number(1.0)),
                        ("echo".into(), value),
                    ]))
                }),
            )
            .unwrap(),
    );
    let runtime = cx.update(|cx| ShellRuntime::new(cx).unwrap());
    let loaded = runtime
        .load_application(directory.path(), "main.js")
        .unwrap();
    let (handle, view) = cx.update(|cx| {
        gpui_kit::open_window(WindowOptions::default(), cx, |window, cx| {
            runtime.mount_application(&loaded, window, cx).unwrap()
        })
        .unwrap()
    });
    cx.run_until_parked();
    cx.update_window(handle, |_, window, cx| {
        window.render_frame(cx);
        let view = view.read(cx);
        assert_eq!(view.build_error(), None);
        let tree = view.snapshot().expect("script render").debug_tree();
        let expected_json = r#"{"z":"末","a":1,"echo":{"zh":"中文","n":42.5,"b":true,"nil":null,"arr":[1,"二",{"k":"v"}]}}"#;
        // debug_tree escapes quotes inside text nodes.
        let escaped = expected_json.replace('"', "\\\"");
        assert!(tree.contains(&escaped), "{tree}");
    })
    .unwrap();
    let expected = HostValue::Object(vec![
        ("zh".into(), HostValue::Str("中文".into())),
        ("n".into(), HostValue::Number(42.5)),
        ("b".into(), HostValue::Bool(true)),
        ("nil".into(), HostValue::Null),
        (
            "arr".into(),
            HostValue::Array(vec![
                HostValue::Number(1.0),
                HostValue::Str("二".into()),
                HostValue::Object(vec![("k".into(), HostValue::Str("v".into()))]),
            ]),
        ),
    ]);
    assert_eq!(seen.borrow().as_ref(), Some(&expected));
}

#[gpui_kit::test]
fn host_calls_reject_callbacks_without_breaking_the_view(cx: &mut TestAppContext) {
    let directory = tempfile::tempdir().unwrap();
    let script = r#"
import { View, div } from 'gpui-kit';
import { inspect } from 'omnia-probe';
export default class Probe extends View {
  init() {
    try {
      inspect(() => {});
      this.result = 'allowed';
    } catch (error) {
      this.result = `rejected:${error.message}`;
    }
  }
  render() { return div().child(this.result); }
}
"#;
    std::fs::write(directory.path().join("main.js"), script).unwrap();
    let seen = Rc::new(RefCell::new(None));
    let capture = seen.clone();
    cx.update(gpui_kit::init);
    cx.update(gpui_shell::init);
    gpui_shell::policy::set_default(
        Policy::new()
            .with_host_module(
                HostModule::new("omnia-probe").function("inspect", move |args| {
                    *capture.borrow_mut() = Some(args.value(0)?.clone());
                    Ok(HostValue::Null)
                }),
            )
            .unwrap(),
    );
    let runtime = cx.update(|cx| ShellRuntime::new(cx).unwrap());
    let loaded = runtime
        .load_application(directory.path(), "main.js")
        .unwrap();
    let (handle, view) = cx.update(|cx| {
        gpui_kit::open_window(WindowOptions::default(), cx, |window, cx| {
            runtime.mount_application(&loaded, window, cx).unwrap()
        })
        .unwrap()
    });
    cx.run_until_parked();
    cx.update_window(handle, |_, window, cx| {
        window.render_frame(cx);
        let view = view.read(cx);
        assert_eq!(view.build_error(), None);
        let tree = view.snapshot().expect("rejection render").debug_tree();
        assert!(tree.contains("rejected:"), "{tree}");
        assert!(tree.contains("plain data only"), "{tree}");
    })
    .unwrap();
    assert!(
        seen.borrow().is_none(),
        "host body must not run for a callback"
    );
}
