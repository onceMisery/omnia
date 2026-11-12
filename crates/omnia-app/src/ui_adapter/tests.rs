use super::Workspace;
use gpui_kit::component::{ActiveTheme, Theme, ThemeMode};
use gpui_kit::test::TestWindowExt;
use gpui_kit::{AppContext, Bounds, TestAppContext, WindowBounds, WindowOptions, px, size};

#[gpui_kit::test]
fn settings_change_the_theme_and_return_to_chat(cx: &mut TestAppContext) {
    cx.update(gpui_kit::init);
    let (handle, _) = cx.update(|cx| {
        Theme::change(ThemeMode::Light, None, cx);
        gpui_kit::open_window(
            WindowOptions {
                window_bounds: Some(WindowBounds::Windowed(Bounds::new(
                    Default::default(),
                    size(px(800.), px(600.)),
                ))),
                ..Default::default()
            },
            cx,
            |window, cx| cx.new(|cx| Workspace::new(window, cx)),
        )
        .expect("open headless application")
    });

    cx.update_window(handle, |_, window, cx| {
        window.render_frame(cx);
        window.click("settings", cx);
        assert_eq!(window.find("dark-mode").checked(), Some(false));
        window.click("dark-mode", cx);
        assert!(cx.theme().is_dark());
        assert_eq!(window.find("dark-mode").checked(), Some(true));
        window.press("space", cx);
        assert!(!cx.theme().is_dark());
        window.click("chat", cx);
        assert!(window.try_find("dark-mode").is_none());
    })
    .expect("settings interaction");
}

#[gpui_kit::test]
fn cjk_input_reaches_the_display_name_and_chat_greeting(cx: &mut TestAppContext) {
    cx.update(gpui_kit::init);
    let (handle, view) = cx.update(|cx| {
        gpui_kit::open_window(
            WindowOptions {
                window_bounds: Some(WindowBounds::Windowed(Bounds::new(
                    Default::default(),
                    size(px(800.), px(600.)),
                ))),
                ..Default::default()
            },
            cx,
            |window, cx| cx.new(|cx| Workspace::new(window, cx)),
        )
        .expect("open headless application")
    });
    cx.update_window(handle, |_, window, cx| {
        window.render_frame(cx);
        window.click("settings", cx);
        window.click("display-name", cx);
        window.input("星野测试", cx);
        let value = view.read(cx).name.read(cx).value();
        assert!(value.contains("星野测试"), "{value}");
        assert!(
            value.contains("用户"),
            "input inserts at the cursor and must not replace the whole value: {value}"
        );
        window.click("chat", cx);
        window.render_frame(cx);
        let greeting = window
            .find("chat-greeting")
            .label()
            .expect("greeting accessibility label")
            .to_owned();
        assert!(greeting.starts_with("你好，"), "{greeting}");
        assert!(greeting.contains("星野测试"), "{greeting}");
    })
    .expect("CJK input interaction");
}
