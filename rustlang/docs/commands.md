---
title: Commands
path: /rust/commands/
icon: terminal
order: 3
description: The f::command(...) builder and the leaf it builds from a handler.
---

# Commands

`f::command(config)` opens a builder that ends in a `Command`. `.input::<I>()`
picks the input struct, `.output::<O>()` the output type, and `.handler(...)`
takes an async closure that receives the input and a `Context` and returns
`Result<O, E>`. The steps come in that order — the builder's types enforce it
— with the optional `.parse(...)` and `.render(...)` before the handler.

```rust
use std::process::ExitCode;

use fireargs::{self as f, CommandConfig, Error};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Deserialize, JsonSchema)]
struct GreetInput {
    name: String,
}

#[derive(Serialize, JsonSchema)]
struct Greeting {
    greeting: String,
}

fn main() -> ExitCode {
    let config = CommandConfig {
        name: Some("greet".into()),
        ..Default::default()
    };
    let greet = f::command(config)
        .input::<GreetInput>()
        .output::<Greeting>()
        .handler(|input, _| async move {
            Ok::<_, Error>(Greeting { greeting: format!("hello {}", input.name) })
        });
    greet.run()
}
```

The command is named by `name`. Under a [program](/rust/programs/) the router
key names it instead; a command run on its own has no other name, so set
`name` for its `--llms` tool name and `--version` line.

## Input and output

The input must be `Deserialize + JsonSchema`: its fields determine the
positional arguments and `--options` (see [Inputs](/rust/inputs/)). A command
without input takes an empty struct (`struct NoInput {}`). The output can be
any `Serialize + JsonSchema` type — a struct, a `Vec<T>`, a scalar, `()` (see
[Outputs](/rust/outputs/)). The handler's return value is serialized and
validated against the output's JSON Schema on every run, so schemars'
validation attributes on the output hold too.

The handler's error type is anything that converts into `fireargs::Error`
(`Box<dyn std::error::Error + Send + Sync>`): a `&str`, a `String`, or any
`std::error::Error`. Spell it at the `Ok` (`Ok::<_, Error>(...)`) when the
closure never fails, so the compiler can infer it.

## `.render(...)`

Optional. Turns the validated output into what a human sees at the shell. It
runs only without `--json`; with it, the output is written as JSON instead.
It receives the output and a `RenderContext` carrying `input` (the parsed
input), `json` and `command`. A returned `Some(text)` is written to stdout
with a trailing newline; return `None` to write the output yourself
(spinners, colors, tables). Without a render, a run without `--json` prints
nothing.

```rust
use fireargs::{self as f, Command, CommandConfig, Error};
use schemars::JsonSchema;
use serde::Deserialize;

#[derive(Deserialize, JsonSchema)]
struct ListInput {
    #[schemars(extend("fireargs" = {"kind": "argument"}))]
    path: String,
}

fn create_list_names() -> Command {
    f::command(CommandConfig::default())
        .input::<ListInput>()
        .output::<Vec<String>>()
        .render(|output, context| {
            let lines: Vec<String> = output.iter().map(|name| format!("- {name}")).collect();
            Some(format!("{}:\n{}", context.input.path, lines.join("\n")))
        })
        .handler(|input, _| async move {
            Ok::<_, Error>(vec![format!("{}/a", input.path), format!("{}/b", input.path)])
        })
}
```

## The handler

Receives the parsed, schema-validated input and a `Context`. Must return a
value of the output type, or an error.

`context.json` is `true` when `--json` was given, with or without a value: a
handler that drives spinners or progress output keeps quiet then, so stdout
stays parseable. `context.command` is the space-separated route path of the
running command, such as `"admin reset"`, or the command's `name` when it
runs on its own.

Handlers are always async. `.run()` blocks on the handler with a minimal
executor, so `fn main() -> ExitCode { cli.run() }` needs no runtime. A
handler that awaits runtime-bound futures (tokio's I/O or timers) runs under
that runtime with `.run_async().await`:

```rust
use std::process::ExitCode;

use fireargs::{self as f, CommandConfig, Context, Error};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Deserialize, JsonSchema)]
struct FetchInput {
    url: String,
}

#[derive(Serialize, JsonSchema)]
struct Fetched {
    url: String,
    mode: String,
}

#[tokio::main]
async fn main() -> ExitCode {
    let config = CommandConfig {
        name: Some("fetch".into()),
        description: Some("Fetch a URL".into()),
        ..Default::default()
    };
    let fetch = f::command(config)
        .input::<FetchInput>()
        .output::<Fetched>()
        .handler(|input, context: Context| async move {
            tokio::task::yield_now().await;
            let mode = if context.json { "json" } else { "text" };
            Ok::<_, Error>(Fetched { url: input.url, mode: mode.into() })
        });
    fetch.run_async().await
}
```

Input that fails the schema is reported like a commander parse error — one
`error: ...` line per field on stderr, exit code 1. An error returned by the
handler, and output that fails its schema, end the run: `.run()` prints
`error: <message>` to stderr and exits 1, and `.try_run_from(...)` returns
the error. A `render_error` hook takes all of them instead (see
[JSON mode](/rust/json-mode/#errors)).

## What gets derived from the input struct

For each field of the input struct:

| Rust construct                        | Becomes                                                                     |
| ------------------------------------- | --------------------------------------------------------------------------- |
| `String` / an integer / a float       | `--key <value>`, required unless defaulted; a number's CLI string is parsed |
| `bool`                                | `--key` flag                                                                |
| `{"kind": "argument"}` meta           | positional `[key]`, read in field order                                     |
| `#[serde(default)]` / `default = "f"` | shown as `(default: …)` in `--help`; serde fills it                         |
| a unit enum                           | choices: `(choices: "a", "b")` in `--help`, checked against the schema      |
| `Vec<T>`                              | `--key <value>...`: `--key a b` or `--key a --key b`; positional `[key]...` |
| `Vec<SomeEnum>`                       | repeated, with choices on each value                                        |
| `Option<T>`                           | optional, with no default needed                                            |
| a doc comment on the field            | shown in `--help` and surfaced as `description` in `--llms` JSON Schema     |

`key` is shown in kebab-case: with `#[serde(rename_all = "camelCase")]`,
`header_rows` becomes `headerRows` on the wire and `--header-rows` at the
shell. See [Flag names](/rust/inputs/#flag-names).

For per-field CLI config that serde and schemars don't model (positional,
short flag, env var, conflicts, hidden, a preset value, …) add
[the `fireargs` meta](/rust/inputs/) to the field; a custom value parser is
`.parse(...)` on the builder.

## `CommandConfig`

The struct `f::command(...)` takes. Every field is optional; spread
`..Default::default()` for the rest.

| Field                        | What it does                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| `name`                       | the command name when run on its own; a program's router key overrides it                  |
| `description`                | help text, and the tool `description` in `--llms`                                          |
| `summary`                    | the one-line text in the parent's command list and `-h`; falls back to `description`       |
| `aliases`                    | extra names the parent program also routes to this command                                 |
| `usage`                      | replaces the generated usage line                                                          |
| `version`                    | adds a `-V, --version` flag printing it                                                    |
| `before_help`, `after_help`  | text printed before and after the generated help                                           |
| `json_option`, `llms_option` | a `FlagConfig` to rename or disable `--json`/`--llms`. See [LLMs mode](/rust/llms-mode/)   |
| `render_error`               | `Arc<dyn Fn(&Error, &Context) -> Option<Value>>`. See [JSON mode](/rust/json-mode/#errors) |

The clap command is built when the command runs and stays internal, so
clap settings beyond these are not reachable. Run a command with `.run()`,
`.run_async().await`, or `.try_run_from(argv, &mut out, &mut err).await`,
which takes the argv (binary name first) and the writers, for tests.

## Why a builder

The input and output types are generic parameters of the builder, and the
handler and render closures are typed from them, so the schemas and the
handler cannot drift apart. The builder's steps are distinct types, so a
command missing its input, output or handler does not compile.
