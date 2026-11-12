//! JSON bridge for the C-06 frozen-source differential checker.
use omnia_config::load_dotenv_patched;
use std::io::{self, Read};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input)?;
    let sources: Vec<String> = serde_json::from_str(&input)?;
    let parsed: Vec<_> = sources
        .iter()
        .map(|source| load_dotenv_patched(source))
        .collect();
    serde_json::to_writer(io::stdout().lock(), &parsed)?;
    Ok(())
}
