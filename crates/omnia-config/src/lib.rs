//! VCP configuration parsing and source precedence (C-06; US-002).

mod config;
mod dotenv;

pub use config::{Config, ConfigError, ConfigSource, load_config, load_plugin_config};

pub use dotenv::load_dotenv_patched;
