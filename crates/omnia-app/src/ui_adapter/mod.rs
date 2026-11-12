use std::{cell::RefCell, rc::Rc};

use gpui_kit::base::TestSupportExt;
use gpui_kit::component::{
    ActiveTheme, Selectable, Theme, ThemeMode,
    button::{Button, ButtonVariants},
    form::{Field, Form},
    input::{Input, InputEvent, InputState},
    switch::Switch,
};
use gpui_kit::{
    AppContext, Bounds, Context, Entity, InteractiveElement, IntoElement, ParentElement, Render,
    StatefulInteractiveElement, Styled, Subscription, Window, WindowBounds, WindowOptions, div, px,
    size,
};

/// Runs the native M0 preview until its last window closes.
///
/// Returns a startup error if the platform cannot open the application window.
/// Settings are retained only for this run; AppData persistence belongs to US-018.
pub fn run() -> anyhow::Result<()> {
    run_window(false)
}

/// Opens the synthetic US-007 probe; it does not connect to a chat server.
pub fn run_validation() -> anyhow::Result<()> {
    run_window(true)
}

fn run_window(validation: bool) -> anyhow::Result<()> {
    let startup_error = Rc::new(RefCell::new(None));
    let error_sink = Rc::clone(&startup_error);
    gpui_kit::application()
        .with_assets(gpui_kit::assets::Assets)
        .run(move |cx| {
            gpui_kit::init(cx);
            cx.on_window_closed(|cx, _| {
                if cx.windows().is_empty() {
                    cx.quit();
                }
            })
            .detach();
            // Initial/minimum OS window bounds are physical platform geometry.
            let options = WindowOptions {
                window_bounds: Some(WindowBounds::Windowed(Bounds::centered(
                    None,
                    size(px(960.), px(680.)),
                    cx,
                ))),
                window_min_size: Some(size(px(560.), px(420.))),
                ..Default::default()
            };
            match gpui_kit::open_window(options, cx, move |window, cx| {
                window.set_window_title("Omnia");
                cx.new(|cx| Workspace::with_validation(validation, window, cx))
            }) {
                Ok(_) => cx.activate(true),
                Err(error) => {
                    *error_sink.borrow_mut() = Some(error.context("打开 Omnia 窗口失败"));
                    cx.quit();
                }
            }
        });
    let error = startup_error.borrow_mut().take();
    match error {
        Some(error) => Err(error),
        None => Ok(()),
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Page {
    Chat,
    Settings,
}

struct Workspace {
    page: Page,
    name: Entity<InputState>,
    _name_subscription: Subscription,
    validation: Option<Entity<validation::ValidationView>>,
}

impl Workspace {
    #[cfg(test)]
    fn new(window: &mut Window, cx: &mut Context<Self>) -> Self {
        Self::with_validation(false, window, cx)
    }

    fn with_validation(validation: bool, window: &mut Window, cx: &mut Context<Self>) -> Self {
        let name = cx.new(|cx| InputState::new(window, cx).default_value("用户"));
        let subscription = cx.subscribe_in(&name, window, |_, _, event, _, cx| {
            if matches!(event, InputEvent::Change) {
                cx.notify();
            }
        });
        Self {
            page: Page::Chat,
            name,
            _name_subscription: subscription,
            validation: validation
                .then(|| cx.new(|cx| validation::ValidationView::new(window, cx))),
        }
    }

    fn show_page(&mut self, page: Page, cx: &mut Context<Self>) {
        self.page = page;
        cx.notify();
    }
}

impl Render for Workspace {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        if let Some(validation) = &self.validation {
            return div().size_full().child(validation.clone());
        }
        let content = match self.page {
            Page::Chat => {
                let greeting = format!("你好，{}", self.name.read(cx).value());
                div()
                    .flex()
                    .flex_col()
                    .gap_3()
                    .child(
                        div()
                            .id("chat-greeting")
                            .text_2xl()
                            .aria_label(greeting.clone())
                            .test_support()
                            .child(greeting),
                    )
                    .child(
                        div()
                            .text_color(cx.theme().muted_foreground)
                            .child("欢迎使用 Omnia 开发预览。聊天功能尚未开放。"),
                    )
            }
            Page::Settings => div()
                .flex()
                .flex_col()
                .gap_6()
                .child(div().text_xl().child("设置"))
                .child(
                    Form::new()
                        .child(
                            Field::new()
                                .label("显示名称")
                                .child(Input::new(&self.name).id("display-name")),
                        )
                        .child(
                            Field::new().label_indent(false).child(
                                Switch::new("dark-mode")
                                    .label("深色外观")
                                    .checked(cx.theme().is_dark())
                                    .on_change(|dark, window, cx| {
                                        Theme::change(
                                            if *dark {
                                                ThemeMode::Dark
                                            } else {
                                                ThemeMode::Light
                                            },
                                            Some(window),
                                            cx,
                                        );
                                    }),
                            ),
                        ),
                )
                .child(
                    div()
                        .text_sm()
                        .text_color(cx.theme().muted_foreground)
                        .child("设置仅在本次运行中生效。"),
                ),
        };
        div()
            .flex()
            .flex_col()
            .size_full()
            .bg(cx.theme().background)
            .text_color(cx.theme().foreground)
            .child(
                div()
                    .flex()
                    .items_center()
                    .gap_2()
                    .p_4()
                    .border_b_1()
                    .border_color(cx.theme().border)
                    .child(div().flex_1().text_lg().child("Omnia"))
                    .child(
                        Button::new("chat")
                            .label("聊天")
                            .ghost()
                            .selected(self.page == Page::Chat)
                            .on_click(cx.listener(|this, _, _, cx| this.show_page(Page::Chat, cx))),
                    )
                    .child(
                        Button::new("settings")
                            .label("设置")
                            .ghost()
                            .selected(self.page == Page::Settings)
                            .on_click(
                                cx.listener(|this, _, _, cx| this.show_page(Page::Settings, cx)),
                            ),
                    ),
            )
            .child(
                div()
                    .id("content")
                    .flex_1()
                    .min_h_0()
                    .min_w_0()
                    .overflow_y_scroll()
                    .child(div().p_8().child(content)),
            )
    }
}

#[cfg(test)]
mod tests;

mod stream_probe;
mod validation;
