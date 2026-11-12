use super::*;
use gpui_kit::test::{TestQueryExt, TestWindowExt};
use gpui_kit::{
    AppContext, Bounds, ScrollDelta, TestAppContext, WindowBounds, WindowOptions, point,
};
use std::time::Instant;

#[gpui_kit::test]
fn thousand_messages_virtualize_scroll_and_append_markdown(cx: &mut TestAppContext) {
    cx.update(gpui_kit::init);
    let (handle, view) = cx.update(|cx| {
        gpui_kit::open_window(
            WindowOptions {
                window_bounds: Some(WindowBounds::Windowed(Bounds::new(
                    Default::default(),
                    size(px(960.), px(680.)),
                ))),
                ..Default::default()
            },
            cx,
            |window, cx| cx.new(|cx| ValidationView::new(window, cx)),
        )
        .unwrap()
    });
    cx.update_window(handle, |_, window, cx| {
        window.render_frame(cx);
        let rows = window.find_all_by_role(Role::ListItem);
        assert!(
            (1..30).contains(&rows.len()),
            "only visible rows should be built: {}",
            rows.len()
        );
        assert!(window.find("message-0").visible());
        window.scroll(
            "message-0",
            ScrollDelta::Pixels(point(px(0.), px(-250.))),
            cx,
        );
        assert!(view.read(cx).scroll.offset().y < px(0.));
        window.click("last-message", cx);
        assert!(window.find("message-999").visible());
        assert!(window.try_find("message-0").is_none());
        window.click("first-message", cx);
        assert!(window.find("message-0").visible());
        for _ in 0..4 {
            window.click("append-chunk", cx);
        }
        assert_eq!(window.find("append-chunk").disabled(), Some(true));
    })
    .unwrap();
    cx.run_until_parked();
    cx.update(|cx| {
        let rendered = view.read(cx).stream.text.read(cx).rendered_text();
        assert!(rendered.as_str().contains("正文 中文"));
        assert!(rendered.as_str().contains("let answer = 42;"));
        assert!(rendered.as_str().contains("已完成"));
    });
    cx.simulate_window_resize(handle, size(px(720.), px(540.)));
    cx.simulate_window_scale_factor_change(handle, 1.5);
    cx.update_window(handle, |_, window, cx| {
        window.render_frame(cx);
        assert!(window.find("last-message").visible());
        window.click("last-message", cx);
        assert!(window.find("message-999").visible());
        window.click("restart-stream", cx);
        assert_eq!(view.read(cx).next_chunk, 0);
    })
    .unwrap();
}

/// Reports CPU headless layout/input work; it does not measure GPU presentation.
#[gpui_kit::test]
fn measure_virtualized_scroll_cpu(cx: &mut TestAppContext) {
    cx.update(gpui_kit::init);
    let (handle, _) = cx.update(|cx| {
        gpui_kit::open_window(
            WindowOptions {
                window_bounds: Some(WindowBounds::Windowed(Bounds::new(
                    Default::default(),
                    size(px(960.), px(680.)),
                ))),
                ..Default::default()
            },
            cx,
            |window, cx| cx.new(|cx| ValidationView::new(window, cx)),
        )
        .unwrap()
    });
    cx.update_window(handle, |_, window, cx| {
        window.render_frame(cx);
        let mut durations = Vec::with_capacity(120);
        let mut max_rows = 0;
        for step in 0..130 {
            let started = Instant::now();
            window.click(if step % 2 == 0 { "last-message" } else { "first-message" }, cx);
            if step >= 10 { durations.push(started.elapsed().as_secs_f64() * 1000.); }
            max_rows = max_rows.max(window.find_all_by_role(Role::ListItem).len());
            assert!(window.find(if step % 2 == 0 { "message-999" } else { "message-0" }).visible());
        }
        durations.sort_by(f64::total_cmp);
        println!("M0_SCROLL_CPU backend={} samples={} p50_ms={:.3} p95_ms={:.3} max_ms={:.3} max_rows={max_rows}",
            if cfg!(feature="gpui-fast") { "gpui-fast" } else { "gpui-pre" }, durations.len(), durations[60], durations[114], durations[119]);
    }).unwrap();
}
