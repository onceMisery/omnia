use gpui_kit::test::TestWindowExt;
use gpui_kit::{AppContext, TestAppContext, WindowOptions};
use gpui_shell::{Capabilities, HostModule, HostValue, ShellRuntime, policy::Policy};

#[gpui_kit::test]
fn native_shell_round_trips_binary_files_zlib_and_host_values(cx: &mut TestAppContext) {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("probe.bin");
    let script = include_str!("shell_probe.js")
        .replace("__FILE_PATH__", &serde_json::to_string(&path).unwrap());
    std::fs::write(directory.path().join("main.js"), script).unwrap();
    cx.update(gpui_kit::init);
    cx.update(gpui_shell::init);
    gpui_shell::policy::set_default(
        Policy::new()
            .with_capabilities(
                Capabilities::new()
                    .read_roots([directory.path().to_owned()])
                    .write_roots([directory.path().to_owned()]),
            )
            .with_host_module(HostModule::new("omnia-probe").function("echo", |args| {
                Ok(HostValue::from(format!("host:{}", args.string(0)?)))
            }))
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
        assert!(tree.contains("host:中文|0,255,42,128"), "{tree}");
    })
    .unwrap();
    assert_eq!(std::fs::read(path).unwrap(), [0, 255, 42, 128]);
}

#[gpui_kit::test]
fn a_script_cannot_write_without_a_grant(cx: &mut TestAppContext) {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("denied.bin");
    let script = format!(
        r#"
import {{ View, div }} from 'gpui-kit';
import * as fs from 'fs/promises';
export default class Probe extends View {{
  init(_, cx) {{
    this.result = 'pending';
    cx.spawn(async cx => {{
      try {{ await fs.writeFile({}, 'forbidden'); this.result = 'allowed'; }}
      catch (_) {{ this.result = 'denied'; }}
      cx.notify();
    }});
  }}
  render() {{ return div().child(this.result); }}
}}
"#,
        serde_json::to_string(&path).unwrap()
    );
    std::fs::write(directory.path().join("main.js"), script).unwrap();
    cx.update(gpui_kit::init);
    cx.update(gpui_shell::init);
    gpui_shell::policy::set_default(Policy::new());
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
        let tree = view.snapshot().expect("denial render").debug_tree();
        assert!(tree.contains("denied"), "{tree}");
    })
    .unwrap();
    assert!(!path.exists());
}
