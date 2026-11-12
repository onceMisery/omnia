//! M0 feasibility probe only; the production stream lifecycle belongs to US-019.

use gpui_kit::base::text::TextViewState;
use gpui_kit::{App, AppContext, Entity};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) struct StreamKey {
    pub session: u64,
    pub generation: u64,
    pub message: u64,
}

pub(super) struct StreamProbe {
    pub text: Entity<TextViewState>,
    active: Option<StreamKey>,
}

impl StreamProbe {
    pub fn new(key: StreamKey, cx: &mut App) -> Self {
        Self {
            text: cx.new(|cx| TextViewState::markdown("", cx)),
            active: Some(key),
        }
    }

    pub fn append(&mut self, key: StreamKey, chunk: &str, cx: &mut App) -> bool {
        if self.active != Some(key) {
            return false;
        }
        self.text.update(cx, |text, cx| text.push_str(chunk, cx));
        true
    }

    pub fn restart(&mut self, key: StreamKey, cx: &mut App) {
        self.active = Some(key);
        self.text.update(cx, |text, cx| text.set_text("", cx));
    }

    pub fn stop(&mut self) {
        self.active = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use gpui_kit::TestAppContext;

    #[gpui_kit::test]
    fn stale_triples_and_cancelled_streams_cannot_change_rendered_markdown(
        cx: &mut TestAppContext,
    ) {
        cx.update(gpui_kit::init);
        let key = StreamKey {
            session: 1,
            generation: 1,
            message: 1,
        };
        let mut stream = cx.update(|cx| StreamProbe::new(key, cx));
        cx.update(|cx| {
            assert!(stream.append(key, "# 原段落\n\n尾部 **中", cx));
            assert!(!stream.append(StreamKey { session: 2, ..key }, "BAD_SESSION", cx));
            assert!(!stream.append(
                StreamKey {
                    generation: 2,
                    ..key
                },
                "BAD_GENERATION",
                cx
            ));
            assert!(!stream.append(StreamKey { message: 2, ..key }, "BAD_MESSAGE", cx));
            assert!(stream.append(key, "文**\n\n```rust\nlet n = 1;", cx));
        });
        cx.run_until_parked();
        cx.update(|cx| {
            let rendered = stream.text.read(cx).rendered_text();
            assert!(rendered.as_str().contains("原段落"));
            assert!(rendered.as_str().contains("尾部 中文"));
            assert!(rendered.as_str().contains("let n = 1;"));
            assert!(!rendered.as_str().contains("BAD"));
            assert!(stream.append(key, "\n```\n\n结束", cx));
            stream.stop();
            assert!(!stream.append(key, "AFTER_STOP", cx));
        });
        cx.run_until_parked();
        cx.update(|cx| {
            let rendered = stream.text.read(cx).rendered_text();
            assert!(rendered.as_str().contains("结束"));
            assert!(!rendered.as_str().contains("AFTER_STOP"));
            let retry = StreamKey {
                generation: 2,
                ..key
            };
            stream.restart(retry, cx);
            assert!(!stream.append(key, "LATE_RETRY", cx));
            assert!(stream.append(retry, "新话题", cx));
        });
        cx.run_until_parked();
        cx.update(|cx| assert_eq!(stream.text.read(cx).rendered_text().as_str(), "新话题\n"));
    }
}
