//! F4 frontend-framework probes for the native gpui-shell subset: WebSocket
//! binary transport, script-crash isolation, and source hot reload. These
//! exercise the public host API only (`load_application`/`mount_application`,
//! `try_load`/`watch`), the same surface `shell.rs` uses.

use std::{
    net::TcpListener,
    thread,
    time::{Duration, Instant},
};

use gpui_kit::test::TestWindowExt;
use gpui_kit::{AnyWindowHandle, AppContext, Entity, TestAppContext, WindowOptions};
use gpui_shell::{Capabilities, ScriptView, ShellRuntime, policy::Policy};
use tungstenite::Message;

/// Renders one frame and returns the script view's description, or an empty
/// string when the view has no snapshot (a failed first build).
fn rendered_tree(
    cx: &mut TestAppContext,
    handle: AnyWindowHandle,
    view: &Entity<ScriptView>,
) -> String {
    cx.update_window(handle, |_, window, cx| {
        window.render_frame(cx);
        view.read(cx)
            .snapshot()
            .map(|snapshot| snapshot.debug_tree())
            .unwrap_or_default()
    })
    .unwrap()
}

const WEBSOCKET_BINARY_PROBE: &str = r#"
import { View, div } from 'gpui-kit';
import { WebSocket } from 'websocket';

export default class Probe extends View {
  init(_, cx) {
    this.result = 'pending';
    cx.spawn(async cx => {
      try {
        const socket = await WebSocket.connect('__URL__');
        // Bytes that are not valid UTF-8, so a lossy text pass would corrupt them.
        const payload = new Uint8Array([0, 255, 42, 128, 7, 254]);
        await socket.write(payload);
        const echoed = await socket.read();
        await socket.close();
        this.result = `${echoed instanceof Uint8Array}|${Array.from(echoed).join(',')}`;
      } catch (error) {
        this.result = `failure:${error.message}`;
      }
      cx.notify();
    });
  }
  render() { return div().child(this.result); }
}
"#;

/// A binary WebSocket frame survives the script boundary byte for byte: the
/// shell's `websocket` module reaches a real loopback echo server, and the
/// bytes that come back are the bytes that went out.
#[gpui_kit::test]
fn websocket_binary_frames_round_trip_through_an_echo_server(cx: &mut TestAppContext) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    let server = thread::spawn(move || {
        let (stream, _) = listener.accept().unwrap();
        // A bounded read keeps the thread from lingering if the probe never
        // closes; the join below is the normal exit.
        stream
            .set_read_timeout(Some(Duration::from_secs(10)))
            .unwrap();
        let mut socket = tungstenite::accept(stream).unwrap();
        let payload = match socket.read().unwrap() {
            Message::Binary(bytes) => bytes,
            other => panic!("expected a binary frame, got {other:?}"),
        };
        socket.send(Message::Binary(payload)).unwrap();
        // Drain until the probe closes so the close handshake completes.
        loop {
            match socket.read() {
                Ok(message) if message.is_close() => break,
                Ok(_) => continue,
                Err(_) => break,
            }
        }
    });

    let directory = tempfile::tempdir().unwrap();
    let script = WEBSOCKET_BINARY_PROBE.replace("__URL__", &format!("ws://{address}/binary"));
    std::fs::write(directory.path().join("main.js"), script).unwrap();
    cx.update(gpui_kit::init);
    cx.update(gpui_shell::init);
    gpui_shell::policy::set_default(
        Policy::new()
            .with_capabilities(Capabilities::new().network_hosts(["127.0.0.1".to_owned()])),
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

    // The socket actor runs on its own OS thread and its completions ride a
    // 10ms foreground timer, so pump the executor clock with real time between
    // turns rather than expecting a single park to settle the round trip.
    cx.run_until_parked();
    let deadline = Instant::now() + Duration::from_secs(15);
    let tree = loop {
        let tree = rendered_tree(cx, handle, &view);
        if tree.contains("true|0,255,42,128,7,254") {
            break tree;
        }
        assert!(!tree.contains("failure:"), "websocket probe failed: {tree}");
        assert!(
            Instant::now() < deadline,
            "timed out waiting for the binary echo: {tree}"
        );
        thread::sleep(Duration::from_millis(10));
        cx.executor().advance_clock(Duration::from_millis(10));
        cx.run_until_parked();
    };
    cx.update_window(handle, |_, _, cx| {
        assert_eq!(view.read(cx).build_error(), None);
    })
    .unwrap();
    assert!(tree.contains("true|0,255,42,128,7,254"), "{tree}");
    server.join().unwrap();
}

const CRASHING_PROBE: &str = r#"
import { View } from 'gpui-kit';
export default class Crash extends View {
  render() { throw new Error('probe-render-boom'); }
}
"#;

const HEALTHY_PROBE: &str = r#"
import { View, div } from 'gpui-kit';
export default class Healthy extends View {
  render() { return div().child('recovered'); }
}
"#;

/// A script that throws while rendering records an observable build error and
/// takes neither the window nor the runtime down with it: the same runtime
/// still loads and renders a healthy application afterwards.
#[gpui_kit::test]
fn a_render_error_is_observable_and_the_runtime_keeps_loading(cx: &mut TestAppContext) {
    let directory = tempfile::tempdir().unwrap();
    std::fs::write(directory.path().join("crash.js"), CRASHING_PROBE).unwrap();
    cx.update(gpui_kit::init);
    cx.update(gpui_shell::init);
    gpui_shell::policy::set_default(Policy::new());
    let runtime = cx.update(|cx| ShellRuntime::new(cx).unwrap());
    let loaded = runtime
        .load_application(directory.path(), "crash.js")
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
        let error = view.build_error().expect("the render error is recorded");
        assert!(error.contains("probe-render-boom"), "{error}");
        assert!(
            view.snapshot().is_none(),
            "a failed first build publishes no snapshot"
        );
    })
    .unwrap();
    // The crashed window still draws frames without panicking.
    cx.update_window(handle, |_, window, cx| {
        window.render_frame(cx);
    })
    .unwrap();

    // The runtime survived the script crash: a healthy application loads and
    // renders in it afterwards.
    std::fs::write(directory.path().join("healthy.js"), HEALTHY_PROBE).unwrap();
    let recovered = runtime
        .load_application(directory.path(), "healthy.js")
        .unwrap();
    let (healthy_handle, healthy_view) = cx.update(|cx| {
        gpui_kit::open_window(WindowOptions::default(), cx, |window, cx| {
            runtime.mount_application(&recovered, window, cx).unwrap()
        })
        .unwrap()
    });
    cx.run_until_parked();
    let tree = rendered_tree(cx, healthy_handle, &healthy_view);
    cx.update_window(healthy_handle, |_, _, cx| {
        assert_eq!(healthy_view.read(cx).build_error(), None);
    })
    .unwrap();
    assert!(tree.contains("recovered"), "{tree}");
}

/// Hot reload through the public `watch` API: saving new `main.js` content
/// replaces the script behind the live view, and the window shows the new
/// description without anyone re-mounting it.
#[gpui_kit::test]
fn hot_reload_replaces_the_view_when_main_js_changes(cx: &mut TestAppContext) {
    let directory = tempfile::tempdir().unwrap();
    let source = |caption: &str| {
        format!(
            "import {{ View, div }} from 'gpui-kit';\n\
             export default class Panel extends View {{\n\
               render() {{ return div().child('{caption}'); }}\n\
             }}\n"
        )
    };
    std::fs::write(directory.path().join("main.js"), source("before-reload")).unwrap();
    cx.update(gpui_kit::init);
    cx.update(gpui_shell::init);
    gpui_shell::policy::set_default(Policy::new());
    let runtime = cx.update(|cx| ShellRuntime::new(cx).unwrap());
    let (handle, root) = cx.update(|cx| {
        gpui_kit::open_window(WindowOptions::default(), cx, |window, cx| {
            runtime.try_load(directory.path(), window, cx).unwrap()
        })
        .unwrap()
    });
    let view = cx.update(|cx| {
        root.read(cx)
            .content()
            .clone()
            .downcast::<ScriptView>()
            .unwrap()
    });
    // Holding the watcher keeps its poll loop alive; dropping it at the end of
    // the test stops the loop, so the watch has an explicit owner and exit.
    let watcher = cx
        .update_window(handle, |_, window, cx| {
            runtime.watch(&root, window, cx).unwrap()
        })
        .unwrap();
    cx.run_until_parked();
    let tree = rendered_tree(cx, handle, &view);
    assert!(tree.contains("before-reload"), "{tree}");

    // Let the modification stamp move past the baseline, then save new content.
    thread::sleep(Duration::from_millis(20));
    std::fs::write(directory.path().join("main.js"), source("after-reload")).unwrap();

    // The poll interval rides the executor clock; the debounce rides the wall
    // clock, so advance the clock and let real time pass between turns.
    let deadline = Instant::now() + Duration::from_secs(15);
    let tree = loop {
        cx.executor().advance_clock(Duration::from_millis(500));
        cx.run_until_parked();
        let tree = rendered_tree(cx, handle, &view);
        if tree.contains("after-reload") {
            break tree;
        }
        assert!(
            Instant::now() < deadline,
            "hot reload did not reach the view: {tree}"
        );
        thread::sleep(Duration::from_millis(60));
    };
    cx.update_window(handle, |_, _, cx| {
        assert_eq!(view.read(cx).build_error(), None);
    })
    .unwrap();
    assert!(tree.contains("after-reload"), "{tree}");
    drop(watcher);
}
