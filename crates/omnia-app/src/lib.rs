//! Native desktop application. GPUI integration is owned by ui_adapter (US-007).

mod ui_adapter;

pub use ui_adapter::{run, run_validation};
