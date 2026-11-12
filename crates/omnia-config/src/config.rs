use std::borrow::Cow;
use std::collections::HashMap;
use std::fmt;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use crate::dotenv::parse_entries;

// M0M1 PRD §3.5: defaults apply only when a key is absent. Runtime parsing
// and any per-consumer treatment of empty values remain with that consumer.
const DEFAULTS: &[(&str, &str)] = &[
    ("PORT", "6005"),
    ("ApiRetries", "3"),
    ("ApiRetryDelay", "1000"),
    ("MaxVCPLoopStream", "5"),
    ("MaxVCPLoopNonStream", "5"),
    ("DEFAULT_TIMEZONE", "Asia/Shanghai"),
];

/// Origin of a resolved configuration value.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConfigSource {
    /// A key present in the process environment snapshot, even if its value is empty.
    Environment,
    /// An assignment in this exact configuration file.
    File(PathBuf),
    /// A documented M0/M1 default for an absent key.
    Default,
}

/// Configuration keys with their resolved values and provenance.
///
/// Unknown keys are retained. Missing credentials remain absent, and present
/// empty strings are distinct from missing keys. Debug output omits values.
pub struct Config {
    values: HashMap<String, (String, ConfigSource)>,
    lookup: KeyLookup,
}

enum KeyLookup {
    Exact,
    ProcessEnvironment,
}

impl KeyLookup {
    fn key<'a>(&self, key: &'a str) -> Cow<'a, str> {
        match self {
            // All C-06 assignment keys are ASCII. Windows environment lookup
            // compares their case, while plugin-specific JS objects do not.
            Self::ProcessEnvironment if cfg!(windows) => Cow::Owned(key.to_ascii_uppercase()),
            _ => Cow::Borrowed(key),
        }
    }
}

impl fmt::Debug for Config {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("Config")
            .field("keys", &self.values.keys())
            .finish_non_exhaustive()
    }
}

impl Config {
    /// Return a resolved value, preserving an explicit empty string.
    pub fn get(&self, key: &str) -> Option<&str> {
        self.values
            .get(self.lookup.key(key).as_ref())
            .map(|(value, _)| value.as_str())
    }

    /// Return the origin of a resolved key; absent keys have no source.
    pub fn source(&self, key: &str) -> Option<&ConfigSource> {
        self.values
            .get(self.lookup.key(key).as_ref())
            .map(|(_, source)| source)
    }
}

/// A configuration file could not be read.
#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    /// File I/O failed; the path and underlying OS error are retained.
    #[error("could not read configuration file {path}")]
    Read {
        /// Path used for the attempted read.
        path: PathBuf,
        /// Original I/O error.
        #[source]
        source: io::Error,
    },
}

/// Read a global configuration file, applying environment priority and defaults.
///
/// `path` is the exact file path (normally the root `config.env`).
/// Does not mutate the process environment. Returns a `ConfigError` when the
/// file is missing or unreadable. Global ASCII key lookup is case-insensitive
/// on Windows, matching `process.env`; plugin-specific keys stay case-sensitive.
pub fn load_config(path: &Path) -> Result<Config, ConfigError> {
    // vars_os avoids the panic vars() permits for non-Unicode environment
    // entries. Node's UTF-8 string boundary also replaces invalid bytes.
    let environment = std::env::vars_os()
        .map(|(key, value)| {
            (
                key.to_string_lossy().into_owned(),
                value.to_string_lossy().into_owned(),
            )
        })
        .collect();
    load_config_with_environment(path, environment)
}

/// Read only `plugin_directory/config.env`.
///
/// Missing plugin configuration is empty, as in Plugin.js:905–908. Other read
/// failures are returned so the plugin host can report them. No `.env` alias,
/// process environment overlay, or global defaults are applied: C-02 schema
/// selection and type conversion belong to the plugin host.
pub fn load_plugin_config(plugin_directory: &Path) -> Result<Config, ConfigError> {
    let path = plugin_directory.join("config.env");
    let parsed = match read_config_file(&path) {
        Err(ConfigError::Read { source, .. }) if source.kind() == io::ErrorKind::NotFound => {
            Vec::new()
        }
        result => result?,
    };
    let values = parsed
        .into_iter()
        .map(|(key, value)| (key, (value, ConfigSource::File(path.clone()))))
        .collect();
    Ok(Config {
        values,
        lookup: KeyLookup::Exact,
    })
}

fn load_config_with_environment(
    path: &Path,
    environment: HashMap<String, String>,
) -> Result<Config, ConfigError> {
    let parsed = read_config_file(path)?;
    let mut config = Config {
        values: HashMap::new(),
        lookup: KeyLookup::ProcessEnvironment,
    };
    for (key, value) in environment {
        config.values.insert(
            config.lookup.key(&key).into_owned(),
            (value, ConfigSource::Environment),
        );
    }
    for (key, mut value) in parsed {
        // dotenv populates Node's process.env, whose native string setter stops
        // at NUL. Plugin configuration remains a plain object and keeps NULs.
        if let Some(end) = value.find('\0') {
            value.truncate(end);
        }
        config
            .values
            .entry(config.lookup.key(&key).into_owned())
            .or_insert_with(|| (value, ConfigSource::File(path.to_owned())));
    }
    for &(key, value) in DEFAULTS {
        config
            .values
            .entry(config.lookup.key(key).into_owned())
            .or_insert_with(|| (value.to_owned(), ConfigSource::Default));
    }
    Ok(config)
}

fn read_config_file(path: &Path) -> Result<Vec<(String, String)>, ConfigError> {
    let bytes = fs::read(path).map_err(|source| ConfigError::Read {
        path: path.to_owned(),
        source,
    })?;
    Ok(parse_entries(&String::from_utf8_lossy(&bytes)))
}

#[cfg(test)]
#[path = "config_tests.rs"]
mod tests;
