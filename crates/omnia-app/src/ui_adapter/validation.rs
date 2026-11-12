//! Synthetic component exercise for US-007, deliberately separate from the chat page.

use super::stream_probe::{StreamKey, StreamProbe};
use gpui_kit::base::{TestSupportExt, VirtualListScrollHandle, v_virtual_list};
use gpui_kit::component::{
    ActiveTheme, Disableable,
    bubble::{Bubble, BubbleVariant},
    button::Button,
    message::{Message, MessageContent},
    text::TextView,
};
use gpui_kit::{
    Context, InteractiveElement, IntoElement, ParentElement, Pixels, Render, Role, SharedString,
    Size, StatefulInteractiveElement, Styled, Window, div, px, rems, size,
};
use std::rc::Rc;

const MESSAGE_COUNT: usize = 1000;
const CHUNKS: [&str; 4] = [
    "# 增量 Markdown\n\n正文 **中",
    "文**\n\n```rust\nlet answer",
    " = 42;\n",
    "```\n\n已完成",
];

pub(super) struct ValidationView {
    messages: Vec<SharedString>,
    row_sizes: Rc<Vec<Size<Pixels>>>,
    measured_rem: Pixels,
    scroll: VirtualListScrollHandle,
    stream: StreamProbe,
    key: StreamKey,
    next_chunk: usize,
}

impl ValidationView {
    pub(super) fn new(window: &mut Window, cx: &mut Context<Self>) -> Self {
        let key = StreamKey {
            session: 1,
            generation: 1,
            message: 1,
        };
        Self {
            messages: (0..MESSAGE_COUNT)
                .map(|ix| {
                    format!(
                        "消息 {:04} · 合成中文内容\n验证滚动和虚拟化，不连接服务器。",
                        ix + 1
                    )
                    .into()
                })
                .collect(),
            row_sizes: Self::row_sizes(window.rem_size()),
            measured_rem: window.rem_size(),
            scroll: VirtualListScrollHandle::new(),
            stream: StreamProbe::new(key, cx),
            key,
            next_chunk: 0,
        }
    }

    fn row_rem(ix: usize) -> f32 {
        if ix.is_multiple_of(3) { 7.0 } else { 6.0 }
    }

    fn row_sizes(rem: Pixels) -> Rc<Vec<Size<Pixels>>> {
        Rc::new(
            (0..MESSAGE_COUNT)
                .map(|ix| size(px(0.), rem * Self::row_rem(ix)))
                .collect(),
        )
    }

    fn append_next(&mut self, cx: &mut Context<Self>) {
        if let Some(chunk) = CHUNKS.get(self.next_chunk) {
            self.stream.append(self.key, chunk, cx);
            self.next_chunk += 1;
            if self.next_chunk == CHUNKS.len() {
                self.stream.stop();
            }
            cx.notify();
        }
    }
}

impl Render for ValidationView {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        // VirtualList requires resolved row geometry. Invalidate the derived sizes on zoom.
        if self.measured_rem != window.rem_size() {
            self.measured_rem = window.rem_size();
            self.row_sizes = Self::row_sizes(self.measured_rem);
        }
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
                    .child(div().flex_1().child("M0 验证 · 1000 条合成消息"))
                    .child(
                        Button::new("first-message")
                            .label("首条")
                            .on_click(cx.listener(|this, _, _, cx| {
                                this.scroll.scroll_to_item(0, gpui_kit::ScrollStrategy::Top);
                                cx.notify();
                            })),
                    )
                    .child(
                        Button::new("last-message")
                            .label("末条")
                            .on_click(cx.listener(|this, _, _, cx| {
                                this.scroll.scroll_to_bottom();
                                cx.notify();
                            })),
                    ),
            )
            .child(
                div().flex_1().min_h_0().min_w_0().child(
                    v_virtual_list(
                        cx.entity(),
                        "probe-messages",
                        self.row_sizes.clone(),
                        |this, range, _, _| {
                            range
                                .map(|ix| {
                                    div()
                                        .id(SharedString::from(format!("message-{ix}")))
                                        .role(Role::ListItem)
                                        .test_support()
                                        .h(rems(Self::row_rem(ix)))
                                        .px_4()
                                        .py_2()
                                        .child(
                                            Message::new().content(
                                                MessageContent::new().child(
                                                    Bubble::new()
                                                        .with_variant(BubbleVariant::Secondary)
                                                        .child(this.messages[ix].clone()),
                                                ),
                                            ),
                                        )
                                })
                                .collect()
                        },
                    )
                    .track_scroll(&self.scroll),
                ),
            )
            .child(
                div()
                    .h_56()
                    .flex()
                    .flex_col()
                    .gap_2()
                    .p_4()
                    .border_t_1()
                    .border_color(cx.theme().border)
                    .child(
                        div()
                            .flex()
                            .gap_2()
                            .items_center()
                            .child(
                                Button::new("append-chunk")
                                    .label("追加片段")
                                    .disabled(self.next_chunk == CHUNKS.len())
                                    .on_click(cx.listener(|this, _, _, cx| this.append_next(cx))),
                            )
                            .child(Button::new("restart-stream").label("重试").on_click(
                                cx.listener(|this, _, _, cx| {
                                    // A finite synthetic run uses a fresh session after each retry.
                                    this.key.session += 1;
                                    this.key.generation += 1;
                                    this.stream.restart(this.key, cx);
                                    this.next_chunk = 0;
                                    cx.notify();
                                }),
                            ))
                            .child(
                                div()
                                    .text_sm()
                                    .text_color(cx.theme().muted_foreground)
                                    .child(format!("片段 {}/4", self.next_chunk)),
                            ),
                    )
                    .child(
                        div()
                            .flex_1()
                            .min_h_0()
                            .child(TextView::new(&self.stream.text)),
                    ),
            )
    }
}

#[cfg(test)]
mod tests;
