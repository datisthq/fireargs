#![allow(clippy::unwrap_used, clippy::expect_used)]

mod support {
    pub mod fixture;
}

use std::fs;
use std::path::{Path, PathBuf};
use std::process::{self, ExitCode};

use serde_json::Value;
use support::fixture::{create_fixture, create_solo};

const SUITE: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../conformance");
// Set on the child this binary spawns for each test: setting a case's `env` on
// the runner's own process would need `unsafe` and race the other tests
const FIXTURE: &str = "FIREARGS_CONFORMANCE_FIXTURE";

fn main() -> ExitCode {
    match std::env::var(FIXTURE).as_deref() {
        Ok("program") => create_fixture().run(),
        Ok("command") => create_solo().run(),
        _ => run_suite(),
    }
}

fn run_suite() -> ExitCode {
    let suite = Path::new(SUITE);
    let schema: Value = read_json(&suite.join("test-schema.json"));
    let validator = jsonschema::validator_for(&schema).unwrap();
    let mut files = vec![];
    collect_files(&suite.join("tests"), &mut files);
    assert!(!files.is_empty(), "no conformance files under {SUITE}");

    let (mut count, mut failures) = (0, vec![]);
    for file in files {
        let groups = read_json(&file);
        assert!(
            validator.is_valid(&groups),
            "{} breaks test-schema.json",
            file.display()
        );
        for group in groups.as_array().unwrap() {
            for case in group["tests"].as_array().unwrap() {
                let name = format!("{} › {}", group["description"], case["description"]);
                count += 1;
                if let Err(reason) = run_case(case) {
                    failures.push(format!("{name}: {reason}"));
                }
            }
        }
    }
    if failures.is_empty() {
        println!("conformance: {count} cases passed");
        return ExitCode::SUCCESS;
    }
    eprintln!("failing cases:\n{}", failures.join("\n"));
    ExitCode::FAILURE
}

fn run_case(case: &Value) -> Result<(), String> {
    let fixture = case
        .get("fixture")
        .and_then(Value::as_str)
        .unwrap_or("program");
    let mut command = process::Command::new(std::env::current_exe().unwrap());
    command.env(FIXTURE, fixture);
    for arg in case["argv"].as_array().unwrap() {
        command.arg(arg.as_str().unwrap());
    }
    for (key, value) in case
        .get("env")
        .and_then(Value::as_object)
        .into_iter()
        .flatten()
    {
        command.env(key, value.as_str().unwrap());
    }
    let run = command.output().map_err(|error| error.to_string())?;
    let out = String::from_utf8(run.stdout).unwrap();
    let err = String::from_utf8(run.stderr).unwrap();
    let code = run.status.code().ok_or("killed by a signal")?;

    if Some(i64::from(code)) != case["exitCode"].as_i64() {
        return Err(format!("exit code {code}, stdout {out:?}, stderr {err:?}"));
    }
    if let Some(expected) = case.get("stdout") {
        let actual: Value =
            serde_json::from_str(&out).map_err(|e| format!("stdout {out:?}: {e}"))?;
        if !equal_json(&actual, expected) {
            return Err(format!("stdout {actual} != {expected}"));
        }
    }
    if let Some(expected) = case.get("stdoutText").and_then(Value::as_str)
        && out != expected
    {
        return Err(format!("stdout {out:?} != {expected:?}"));
    }
    if let Some(expected) = case.get("stderr").and_then(Value::as_str)
        && !err.starts_with(expected)
    {
        return Err(format!("stderr {err:?} does not start with {expected:?}"));
    }
    if let Some(expected) = case.get("tools") {
        let manifest: Value = serde_json::from_str(&out).map_err(|e| e.to_string())?;
        let tools = manifest["tools"].as_array().unwrap();
        let named: Vec<Value> = tools
            .iter()
            .map(|t| serde_json::json!({"name": t["name"], "description": t["description"]}))
            .collect();
        if &Value::Array(named.clone()) != expected {
            return Err(format!("tools {named:?} != {expected}"));
        }
        for instance in case
            .get("instances")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            let tool = tools
                .iter()
                .find(|t| t["name"] == instance["tool"])
                .unwrap();
            let key = format!("{}Schema", instance["io"].as_str().unwrap());
            let valid = jsonschema::validator_for(&tool[key])
                .unwrap()
                .is_valid(&instance["data"]);
            if Some(valid) != instance["valid"].as_bool() {
                return Err(format!("instance {instance} validated as {valid}"));
            }
        }
    }
    Ok(())
}

// `12` and `12.0` are one JSON number, as in the TypeScript and Python runners
fn equal_json(actual: &Value, expected: &Value) -> bool {
    match (actual, expected) {
        (Value::Number(a), Value::Number(b)) => a.as_f64() == b.as_f64(),
        (Value::Array(a), Value::Array(b)) => {
            a.len() == b.len() && a.iter().zip(b).all(|(x, y)| equal_json(x, y))
        }
        (Value::Object(a), Value::Object(b)) => {
            a.len() == b.len()
                && a.iter()
                    .all(|(k, v)| b.get(k).is_some_and(|w| equal_json(v, w)))
        }
        (a, b) => a == b,
    }
}

fn collect_files(dir: &Path, files: &mut Vec<PathBuf>) {
    let mut entries: Vec<PathBuf> = fs::read_dir(dir)
        .unwrap()
        .map(|e| e.unwrap().path())
        .collect();
    entries.sort();
    for path in entries {
        if path.is_dir() {
            collect_files(&path, files);
        } else if path.extension().is_some_and(|ext| ext == "json") {
            files.push(path);
        }
    }
}

fn read_json(path: &Path) -> Value {
    serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap()
}
