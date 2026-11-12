use super::*;
use std::fs;
use tempfile::TempDir;

#[test]
fn c06_loading_fixtures_cover_global_defaults_and_plugin_filenames() {
    let directory =
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../../contract/fixtures/c06-dotenv");
    let mut checked = 0;
    for entry in fs::read_dir(directory).unwrap() {
        let path = entry.unwrap().path();
        let name = path.to_str().unwrap();
        if !name.ends_with("-pos.json") && !name.ends_with("-neg.json") {
            continue;
        }
        let case: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap();
        if case["kind"] == "parse" {
            continue;
        }
        let directory = tempfile::tempdir().unwrap();
        let (config, config_path) = if case["kind"] == "global" {
            let path = write_global(&directory, case["src"].as_str().unwrap());
            let environment = serde_json::from_value(case["environment"].clone()).unwrap();
            (
                load_config_with_environment(&path, environment).unwrap(),
                path,
            )
        } else {
            assert_eq!(case["kind"], "plugin");
            let plugin_directory = directory.path().join("Plugin/Example");
            fs::create_dir_all(&plugin_directory).unwrap();
            for (name, contents) in case["files"].as_object().unwrap() {
                fs::write(plugin_directory.join(name), contents.as_str().unwrap()).unwrap();
            }
            (
                load_plugin_config(&plugin_directory).unwrap(),
                plugin_directory.join("config.env"),
            )
        };
        for (key, expected) in case["expected"].as_object().unwrap() {
            assert_eq!(config.get(key), expected.as_str(), "{} / {key}", case["id"]);
        }
        for (key, expected) in case["expected_sources"].as_object().unwrap() {
            let source = match expected.as_str() {
                Some("file") => Some(ConfigSource::File(config_path.clone())),
                Some("environment") => Some(ConfigSource::Environment),
                Some("default") => Some(ConfigSource::Default),
                None => None,
                other => panic!("unknown fixture source {other:?}"),
            };
            assert_eq!(
                config.source(key),
                source.as_ref(),
                "{} / {key}",
                case["id"]
            );
        }
        checked += 1;
    }
    assert_eq!(checked, 6);
}

#[cfg(windows)]
#[test]
fn windows_environment_keys_and_file_population_are_case_insensitive() {
    let directory = tempfile::tempdir().unwrap();
    let path = write_global(&directory, "Key=file\nport=7123");
    let config =
        load_config_with_environment(&path, HashMap::from([("kEy".into(), "environment".into())]))
            .unwrap();
    for key in ["Key", "KEY", "key"] {
        assert_eq!(config.get(key), Some("environment"));
        assert_eq!(config.source(key), Some(&ConfigSource::Environment));
    }
    assert_eq!(config.get("PORT"), Some("7123"));
    assert_eq!(config.source("PORT"), Some(&ConfigSource::File(path)));
}

#[cfg(windows)]
#[test]
fn windows_case_collisions_follow_original_property_insertion_order() {
    let directory = tempfile::tempdir().unwrap();
    let path = write_global(
        &directory,
        "Key=first\nKEY=second\nKey=last\nKEY=final-upper",
    );
    let config = load_config_with_environment(&path, HashMap::new()).unwrap();
    assert_eq!(config.get("Key"), Some("last"));
    assert_eq!(config.get("KEY"), Some("last"));
    assert_eq!(config.get("key"), Some("last"));
}

#[cfg(not(windows))]
#[test]
fn unix_global_key_lookup_keeps_case_distinct() {
    let directory = tempfile::tempdir().unwrap();
    let path = write_global(&directory, "Key=file\nKEY=upper-file");
    let config =
        load_config_with_environment(&path, HashMap::from([("KEY".into(), "environment".into())]))
            .unwrap();
    assert_eq!(config.get("Key"), Some("file"));
    assert_eq!(config.get("KEY"), Some("environment"));
    assert_eq!(config.get("key"), None);
}

#[test]
fn plugin_keys_keep_their_exact_case_on_every_platform() {
    let directory = tempfile::tempdir().unwrap();
    write_global(&directory, "Key=first\nKEY=second");
    let config = load_plugin_config(directory.path()).unwrap();
    assert_eq!(config.get("Key"), Some("first"));
    assert_eq!(config.get("KEY"), Some("second"));
    assert_eq!(config.get("key"), None);
}

#[test]
fn public_loader_reads_real_environment_without_modifying_it() {
    let directory = tempfile::tempdir().unwrap();
    let path = write_global(&directory, "PATH=file-path");
    let before: HashMap<_, _> = std::env::vars_os().collect();
    let config = load_config(&path).unwrap();
    for (key, value) in &before {
        assert!(
            config.get(&key.to_string_lossy()) == Some(value.to_string_lossy().as_ref()),
            "a real environment value was not preserved"
        );
        assert_eq!(
            config.source(&key.to_string_lossy()),
            Some(&ConfigSource::Environment)
        );
    }
    assert!(
        std::env::vars_os().collect::<HashMap<_, _>>() == before,
        "the public loader modified the process environment"
    );
}

fn write_global(directory: &TempDir, contents: impl AsRef<[u8]>) -> PathBuf {
    let path = directory.path().join("config.env");
    fs::write(&path, contents).unwrap();
    path
}

#[test]
fn environment_wins_over_final_file_assignment_and_preserves_unknown_keys() {
    let directory = tempfile::tempdir().unwrap();
    let path = write_global(
        &directory,
        "Key=first\nKey=last\nAPI_URL=file-url\nCUSTOM=file",
    );
    let config = load_config_with_environment(
        &path,
        HashMap::from([
            ("Key".into(), "environment-key".into()),
            ("API_URL".into(), "".into()),
            ("ENV_ONLY".into(), "unknown-value".into()),
        ]),
    )
    .unwrap();
    assert_eq!(config.get("Key"), Some("environment-key"));
    assert_eq!(config.get("API_URL"), Some(""));
    assert_eq!(config.get("ENV_ONLY"), Some("unknown-value"));
    assert_eq!(config.get("CUSTOM"), Some("file"));
    assert_eq!(config.source("Key"), Some(&ConfigSource::Environment));
    assert_eq!(config.source("API_URL"), Some(&ConfigSource::Environment));
    assert_eq!(config.source("CUSTOM"), Some(&ConfigSource::File(path)));
}

#[test]
fn last_file_assignment_has_file_provenance() {
    let directory = tempfile::tempdir().unwrap();
    let path = write_global(&directory, "Key=first\nKey=last\nNew@Key=retained");
    let config = load_config_with_environment(&path, HashMap::new()).unwrap();
    assert_eq!(config.get("Key"), Some("last"));
    assert_eq!(config.source("Key"), Some(&ConfigSource::File(path)));
    assert_eq!(config.get("New@Key"), Some("retained"));
}

#[test]
fn missing_documented_keys_receive_defaults_but_credentials_remain_absent() {
    let directory = tempfile::tempdir().unwrap();
    let path = write_global(&directory, "");
    let config = load_config_with_environment(&path, HashMap::new()).unwrap();
    for (key, expected) in [
        ("PORT", "6005"),
        ("ApiRetries", "3"),
        ("ApiRetryDelay", "1000"),
        ("MaxVCPLoopStream", "5"),
        ("MaxVCPLoopNonStream", "5"),
        ("DEFAULT_TIMEZONE", "Asia/Shanghai"),
    ] {
        assert_eq!(config.get(key), Some(expected), "{key}");
        assert_eq!(config.source(key), Some(&ConfigSource::Default), "{key}");
    }
    for key in [
        "Key",
        "AdminUsername",
        "AdminPassword",
        "Image_Key",
        "File_Key",
        "VCP_Key",
        "API_URL",
        "API_Key",
    ] {
        assert_eq!(config.get(key), None, "{key}");
        assert_eq!(config.source(key), None, "{key}");
    }
}

#[test]
fn present_empty_values_are_not_replaced_with_defaults() {
    let directory = tempfile::tempdir().unwrap();
    let path = write_global(&directory, "PORT=\nApiRetries=0\nDEFAULT_TIMEZONE=");
    let config = load_config_with_environment(&path, HashMap::new()).unwrap();
    assert_eq!(config.get("PORT"), Some(""));
    assert_eq!(config.get("ApiRetries"), Some("0"));
    assert_eq!(config.get("DEFAULT_TIMEZONE"), Some(""));
    assert_eq!(config.source("PORT"), Some(&ConfigSource::File(path)));
}

#[test]
fn global_environment_population_truncates_nul_but_plugin_values_do_not() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("config.env");
    fs::write(&path, "KEY=\"left\0right\"").unwrap();
    let global = load_config_with_environment(&path, HashMap::new()).unwrap();
    assert_eq!(global.get("KEY"), Some("left"));
    let plugin = load_plugin_config(directory.path()).unwrap();
    assert_eq!(plugin.get("KEY"), Some("left\0right"));
}

#[test]
fn global_missing_file_reports_path_and_source_without_using_dotenv_alias() {
    let directory = tempfile::tempdir().unwrap();
    fs::write(directory.path().join(".env"), "Key=wrong-file").unwrap();
    let path = directory.path().join("config.env");
    let error = load_config(&path).unwrap_err();
    let ConfigError::Read {
        path: actual_path,
        source,
    } = error;
    assert_eq!(actual_path, path);
    assert_eq!(source.kind(), io::ErrorKind::NotFound);
}

#[test]
fn plugin_loads_exact_filename_without_global_defaults() {
    let directory = tempfile::tempdir().unwrap();
    let plugin_directory = directory.path().join("Plugin").join("Example");
    fs::create_dir_all(&plugin_directory).unwrap();
    fs::write(plugin_directory.join(".env"), "Key=wrong-file").unwrap();
    let path = plugin_directory.join("config.env");
    fs::write(&path, "Key=plugin-first\nKey=plugin-last\nDebugMode=TrUe").unwrap();
    let config = load_plugin_config(&plugin_directory).unwrap();
    assert_eq!(config.get("Key"), Some("plugin-last"));
    assert_eq!(config.source("Key"), Some(&ConfigSource::File(path)));
    assert_eq!(config.get("DebugMode"), Some("TrUe"));
    assert_eq!(config.get("PORT"), None);
}

#[test]
fn missing_plugin_file_is_empty_and_dotenv_alias_is_ignored() {
    let directory = tempfile::tempdir().unwrap();
    fs::write(directory.path().join(".env"), "Key=wrong-file").unwrap();
    let config = load_plugin_config(directory.path()).unwrap();
    assert_eq!(config.get("Key"), None);
    assert_eq!(config.get("PORT"), None);
    assert_eq!(config.source("Key"), None);
}

#[test]
fn unreadable_plugin_file_reports_failure_instead_of_empty_success() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("config.env");
    fs::create_dir(&path).unwrap();
    let ConfigError::Read {
        path: actual_path,
        source,
    } = load_plugin_config(directory.path()).unwrap_err();
    assert_eq!(actual_path, path);
    assert_ne!(source.kind(), io::ErrorKind::NotFound);
    assert!(directory.path().join("config.env").is_dir());
}

#[test]
fn files_decode_invalid_utf8_with_node_replacement_semantics() {
    let directory = tempfile::tempdir().unwrap();
    let path = write_global(&directory, b"VALUE=left\xFFright");
    let config = load_config_with_environment(&path, HashMap::new()).unwrap();
    assert_eq!(config.get("VALUE"), Some("left\u{FFFD}right"));
}

#[test]
fn failed_read_does_not_prevent_loading_after_file_is_created() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("config.env");
    assert!(load_config_with_environment(&path, HashMap::new()).is_err());
    fs::write(&path, "Key=recovered").unwrap();
    let config = load_config_with_environment(&path, HashMap::new()).unwrap();
    assert_eq!(config.get("Key"), Some("recovered"));
}

#[test]
fn debug_output_does_not_expose_configuration_values() {
    let directory = tempfile::tempdir().unwrap();
    let path = write_global(&directory, "API_Key=fixture-secret");
    let config = load_config_with_environment(&path, HashMap::new()).unwrap();
    assert_eq!(config.get("API_Key"), Some("fixture-secret"));
    assert!(!format!("{config:?}").contains("fixture-secret"));
}
