#![allow(clippy::unwrap_used)]

use fireargs::{Command, Error, InputError};
use serde_json::{Value, json};

#[fireargs::input]
struct TagsInput {
    #[fireargs(default, parse = |text: &str| Ok::<_, String>(text.split(',').map(str::to_owned).collect::<Vec<_>>()))]
    tags: Vec<String>,
    #[fireargs(default)]
    rows: Vec<u32>,
    #[fireargs(conflicts = quiet, implies(level = 3))]
    loud: Option<bool>,
    quiet: Option<bool>,
    #[fireargs(preset = 7, env = "FIREARGS_TEST_LEVEL")]
    level: Option<u32>,
}

/// Page size
#[fireargs::option(short = 'l', env = "FIREARGS_TEST_LIMIT", default = 20)]
struct Limit(#[fireargs(range(min = 1, max = 100))] u32);

/// A tag list, written as `a,b`
#[fireargs::option(parse = split_tags)]
struct Tags(Vec<String>);

fn split_tags(text: &str) -> fireargs::Result<Vec<String>, String> {
    Ok(text.split(',').map(str::to_owned).collect())
}

#[fireargs::input]
struct Pagination {
    limit: Limit,
}

#[fireargs::input]
struct UsersInput {
    #[fireargs(flatten)]
    pagination: Pagination,
    /// Results per page
    #[fireargs(short = 'n')]
    page_size: Option<Limit>,
    tags: Option<Tags>,
}

#[fireargs::output]
struct UsersOutput {
    limit: u32,
    page_size: Option<u32>,
    tags: Vec<String>,
}

fn create_tags() -> Command<TagsInput, TagsInput> {
    fireargs::command().handler(async |input: TagsInput, _| Ok(input))
}

fn create_users() -> Command<UsersInput, UsersOutput> {
    fireargs::command()
        .handler(async |input: UsersInput, _| {
            Ok(UsersOutput {
                limit: *input.pagination.limit,
                page_size: input.page_size.map(|size| *size),
                tags: input.tags.map(|tags| tags.0).unwrap_or_default(),
            })
        })
        .render(|output, context| {
            format!("{} {}", context.input.pagination.limit.0, output.limit)
        })
}

fn run<I, O>(command: &Command<I, O>, args: &[&str]) -> (u8, String, String)
where
    I: serde::de::DeserializeOwned + 'static,
    O: serde::Serialize + 'static,
{
    let argv = std::iter::once("cli").chain(args.iter().copied());
    let (mut out, mut err) = (vec![], vec![]);
    let code =
        pollster::block_on(command.try_run_from(argv, &mut out, &mut err)).unwrap();
    (
        code,
        String::from_utf8(out).unwrap(),
        String::from_utf8(err).unwrap(),
    )
}

fn read_json(text: &str) -> Value {
    serde_json::from_str(text).unwrap()
}

#[test]
fn parse_variadic_and_preset_shape_argv() {
    let (code, out, _) = run(
        &create_tags(),
        &["--tags", "a,b", "--rows", "1", "2", "--level", "--json"],
    );
    assert_eq!(code, 0);
    assert_eq!(
        read_json(&out),
        json!({"tags": ["a", "b"], "rows": [1, 2], "level": 7})
    );
}

#[test]
fn conflicts_and_implies_name_input_keys() {
    let command = create_tags();
    let (code, _, err) = run(&command, &["--loud", "--quiet"]);
    assert_eq!(
        (code, err.trim()),
        (
            1,
            "error: option '--loud' cannot be used with option '--quiet'"
        )
    );
    let (_, out, _) = run(&command, &["--loud", "--json"]);
    assert_eq!(read_json(&out)["level"], 3);
}

#[test]
fn json_input_skips_parse() {
    let (code, _, err) = run(&create_tags(), &["--json", r#"{"tags":"a,b"}"#]);
    assert_eq!(code, 1);
    assert!(
        err.starts_with("error: invalid --json input at 'tags': "),
        "{err}"
    );
}

#[test]
fn a_value_type_carries_its_meta_default_and_parse() {
    let command = create_users();
    let (code, out, _) =
        run(&command, &["-l", "5", "-n", "7", "--tags", "a,b", "--json"]);
    assert_eq!(code, 0);
    assert_eq!(
        read_json(&out),
        json!({"limit": 5, "pageSize": 7, "tags": ["a", "b"]})
    );
    let (_, out, _) = run(&command, &["--json", "{}"]);
    assert_eq!(read_json(&out), json!({"limit": 20, "tags": []}));
    let (code, _, err) = run(&command, &["-l", "0"]);
    assert_eq!(code, 1);
    assert!(err.contains("'-l, --limit <value>'"), "{err}");
}

#[test]
fn a_field_overrides_its_value_types_meta_key_by_key() {
    let (_, out, _) = run(&create_users(), &["--help"]);
    assert!(out.contains("-l, --limit <value>"), "{out}");
    assert!(out.contains("-n, --page-size <value>"), "{out}");
    assert!(out.contains("Results per page"), "{out}");
    assert!(out.contains("Page size (default: 20)"), "{out}");
    assert_eq!(out.matches("FIREARGS_TEST_LIMIT").count(), 2, "{out}");
}

#[test]
fn render_receives_the_output_and_the_input() {
    let (code, out, _) = run(&create_users(), &["-l", "9"]);
    assert_eq!((code, out.as_str()), (0, "9 9\n"));
}

#[test]
fn the_nearest_render_error_hook_wins() {
    let leaf = fireargs::command()
        .render_error(|error: &Error, _| {
            let input = error.downcast_ref::<InputError>().is_some();
            Some(json!({"leaf": true, "input": input}))
        })
        .handler(async |input: TagsInput, _| Ok(input));
    let program = fireargs::program()
        .render_error(|_, _| Some(json!("program")))
        .command("tags", leaf)
        .command("other", create_tags());
    let (mut out, mut err) = (vec![], vec![]);
    let argv = ["cli", "tags", "--json", r#"{"rows":[-1]}"#];
    let code =
        pollster::block_on(program.try_run_from(argv, &mut out, &mut err)).unwrap();
    assert_eq!(code, 1);
    assert_eq!(
        serde_json::from_slice::<Value>(&out).unwrap(),
        json!({"leaf": true, "input": true})
    );

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
    let command = fireargs::command().handler(
        async |_: TagsInput, _| -> fireargs::Result<TagsInput> { Err("boom".into()) },
    );
    let (mut out, mut err) = (vec![], vec![]);
    let result = pollster::block_on(command.try_run_from(["cli"], &mut out, &mut err));
    assert_eq!(result.unwrap_err().to_string(), "boom");
}

#[test]
fn configure_changes_the_declared_clap_command() {
    let command = fireargs::command()
        .configure(|clap| clap.after_help("configured"))
        .handler(async |input: TagsInput, _| Ok(input));
    let (_, out, _) = run(&command, &["--help"]);
    assert!(out.trim_end().ends_with("configured"), "{out}");
}

#[derive(serde::Deserialize, serde::Serialize, schemars::JsonSchema)]
struct PlainInput {
    #[schemars(extend("fireargs" = {"kind": "argument"}))]
    path: String,
}

impl fireargs::Input for PlainInput {}

#[test]
fn a_hand_written_input_reads_its_meta_from_the_schema() {
    let command = fireargs::command().handler(async |input: PlainInput, _| Ok(input));
    let (code, out, _) = run(&command, &["a.csv", "--json"]);
    assert_eq!((code, read_json(&out)), (0, json!({"path": "a.csv"})));
}

/// Who to greet
#[fireargs::argument]
struct Name(String);

#[fireargs::input]
struct NamesInput {
    name: Name,
    #[fireargs(option)]
    friend: Option<Name>,
}

#[test]
fn an_argument_type_is_positional_and_a_field_can_make_it_an_option() {
    let command = fireargs::command().handler(async |input: NamesInput, _| Ok(input));
    let (code, out, _) = run(&command, &["ada", "--friend", "bob", "--json"]);
    assert_eq!(
        (code, read_json(&out)),
        (0, json!({"name": "ada", "friend": "bob"}))
    );
    let (_, out, _) = run(&command, &["--help"]);
    assert!(out.contains("[name]  Who to greet"), "{out}");
    assert!(out.contains("--friend <value>"), "{out}");
}
