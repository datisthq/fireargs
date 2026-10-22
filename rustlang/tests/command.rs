#![allow(clippy::unwrap_used)]

use std::sync::Arc;

use fireargs::{self as f, Command, CommandConfig, Error, InputError, ProgramConfig};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
struct TagsInput {
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    rows: Vec<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[schemars(extend("fireargs" = {"kind": "option", "conflicts": "quiet", "implies": {"level": 3}}))]
    loud: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    quiet: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[schemars(extend("fireargs" = {"kind": "option", "preset": 7, "env": "FIREARGS_TEST_LEVEL"}))]
    level: Option<u32>,
}

fn create_tags(config: CommandConfig) -> Command {
    f::command(config)
        .input::<TagsInput>()
        .output::<TagsInput>()
        .parse("tags", |text| {
            Ok(json!(text.split(',').collect::<Vec<_>>()))
        })
        .handler(|input, _| async move { Ok::<_, Error>(input) })
}

fn run(command: &Command, args: &[&str]) -> (u8, String, String) {
    let argv = std::iter::once("tags").chain(args.iter().copied());
    let (mut out, mut err) = (vec![], vec![]);
    let code =
        pollster::block_on(command.try_run_from(argv, &mut out, &mut err)).unwrap();
    (
        code,
        String::from_utf8(out).unwrap(),
        String::from_utf8(err).unwrap(),
    )
}

#[test]
fn parse_variadic_and_preset_shape_argv() {
    let command = create_tags(CommandConfig::default());
    let (code, out, _) = run(
        &command,
        &["--tags", "a,b", "--rows", "1", "2", "--level", "--json"],
    );
    assert_eq!(code, 0);
    let out: serde_json::Value = serde_json::from_str(&out).unwrap();
    assert_eq!(out, json!({"tags": ["a", "b"], "rows": [1, 2], "level": 7}));
}

#[test]
fn conflicts_and_implies_name_input_keys() {
    let command = create_tags(CommandConfig::default());
    let (code, _, err) = run(&command, &["--loud", "--quiet"]);
    assert_eq!(
        (code, err.trim()),
        (
            1,
            "error: option '--loud' cannot be used with option '--quiet'"
        )
    );
    let (_, out, _) = run(&command, &["--loud", "--json"]);
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(&out).unwrap()["level"],
        3
    );
}

#[test]
fn json_input_skips_parse() {
    let command = create_tags(CommandConfig::default());
    let (code, _, err) = run(&command, &["--json", r#"{"tags":"a,b"}"#]);
    assert_eq!(code, 1);
    assert!(
        err.starts_with("error: invalid --json input at 'tags': "),
        "{err}"
    );
}

#[test]
fn the_nearest_render_error_hook_wins() {
    let render_error: f::RenderError = Arc::new(|error: &Error, _: &f::Context| {
        let input = error.downcast_ref::<InputError>().is_some();
        Some(json!({"leaf": true, "input": input}))
    });
    let leaf = create_tags(CommandConfig {
        render_error: Some(render_error),
        ..Default::default()
    });
    let program_hook: f::RenderError = Arc::new(|_, _| Some(json!("program")));
    let program = f::program(ProgramConfig {
        render_error: Some(program_hook),
        ..Default::default()
    })
    .router([
        ("tags", leaf.into()),
        ("other", create_tags(CommandConfig::default()).into()),
    ]);
    let (mut out, mut err) = (vec![], vec![]);
    let argv = ["cli", "tags", "--json", r#"{"rows":[-1]}"#];
    let code =
        pollster::block_on(program.try_run_from(argv, &mut out, &mut err)).unwrap();
    assert_eq!(code, 1);
    let out: serde_json::Value = serde_json::from_slice(&out).unwrap();
    assert_eq!(out, json!({"leaf": true, "input": true}));

    let (mut out, mut err) = (vec![], vec![]);
    let argv = ["cli", "other", "--rows", "-1"];
    let code =
        pollster::block_on(program.try_run_from(argv, &mut out, &mut err)).unwrap();
    assert_eq!(
        (code, String::from_utf8(err).unwrap()),
        (1, "program\n".to_owned())
    );
}

#[test]
fn a_handler_error_without_a_hook_is_returned() {
    let command = f::command(CommandConfig::default())
        .input::<TagsInput>()
        .output::<TagsInput>()
        .handler(|_, _| async move { Err::<TagsInput, _>("boom") });
    let (mut out, mut err) = (vec![], vec![]);
    let result = pollster::block_on(command.try_run_from(["tags"], &mut out, &mut err));
    assert_eq!(result.unwrap_err().to_string(), "boom");
}
