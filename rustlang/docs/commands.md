---
title: Commands
path: /rust/commands/
icon: terminal
order: 3
description: The fireargs::command() builder and the typed leaf it builds from a handler.
---

# Commands

`fireargs::command()` opens a builder. Its configuration methods (`.name(...)`,
`.description(...)`, …) come first; `.handler(...)` takes an async closure that
receives the input and a `Context` and returns `fireargs::Result<O>`, and builds a
`Command<I, O>` typed from that closure. `.render(...)` follows on the built command.

```rust
#[fireargs::input]
struct GreetInput {
    name: String,
}

#[fireargs::output]
struct GreetOutput {
    greeting: String,
}

fn greet() -> fireargs::Command<GreetInput, GreetOutput> {
    fireargs::command()
        .name("greet")
        .handler(async |input: GreetInput, _| {
            Ok(GreetOutput { greeting: format!("hello {}", input.name) })
        })
}

fn main() -> std::process::ExitCode {
    greet().run()
}
```

The command is named by `.name(...)`. Under a [program](/rust/programs/) the router
key names it instead; a command run on its own has no other name, so set `name` for
its `--llms` tool name and `--version` line.

## Input and output

The handler's input type is the command's input: annotate it in the closure
(`async |input: GreetInput, _|`). It must implement `fireargs::Input`, which
`#[fireargs::input]` does; its fields determine the positional arguments and
`--options` (see [Inputs](/rust/inputs/)). A command without input takes an empty
struct (`#[fireargs::input] struct NoInput {}`).

The output type is inferred from what the handler returns. It can be any
`Serialize + JsonSchema` type — a `#[fireargs::output]` struct, a `Vec<T>`, a
scalar, `()` (see [Outputs](/rust/outputs/)). The handler's return value is
serialized and validated against the output's JSON Schema on every run, so the
validation attributes on the output hold too.

The error type is `fireargs::Error` (`Box<dyn std::error::Error + Send + Sync>`):
`?` converts any `std::error::Error` into it, and `"text".into()` makes one from a
string. `fireargs::Result<T>` is `Result<T, fireargs::Error>`.

## `.render(...)`

Optional. Turns the validated output into what a human sees at the shell. It runs
only without `--json`; with it, the output is written as JSON instead. It receives
the output and a `RenderContext` carrying `input` (the parsed input), `json` and
`command`. A returned `String` is written to stdout with a trailing newline; return
an `Option<String>` and `None` to write the output yourself (spinners, colors,
tables). Without a render, a run without `--json` prints nothing.

```rust
#[fireargs::input]
struct ListInput {
    #[fireargs(argument)]
    path: String,
}

fn list_names() -> fireargs::Command<ListInput, Vec<String>> {
    fireargs::command()
        .handler(async |input: ListInput, _| {
            Ok(vec![format!("{}/a", input.path), format!("{}/b", input.path)])
        })
        .render(|output, context| {
            let lines: Vec<String> = output.iter().map(|name| format!("- {name}")).collect();
            format!("{}:\n{}", context.input.path, lines.join("\n"))
        })
}
```

## The handler

Receives the parsed, schema-validated input and a `Context`. Must return a value of
the output type, or an error.

`context.json` is `true` when `--json` was given, with or without a value: a handler
that drives spinners or progress output keeps quiet then, so stdout stays parseable.
`context.command` is the space-separated route path of the running command, such as
`"admin reset"`, or the command's `name` when it runs on its own.

Handlers are always async; `|input: In, _| async move { ... }` works as well as
`async |input: In, _| { ... }`. `.run()` blocks on the handler with a minimal
executor, so `fn main() -> ExitCode { cli().run() }` needs no runtime. A handler
that awaits runtime-bound futures (tokio's I/O or timers) runs under that runtime
with `.run_async().await`:

```rust
#[fireargs::input]
struct FetchInput {
    url: String,
}

#[fireargs::output]
struct Fetched {
    url: String,
    mode: String,
}

#[tokio::main]
async fn main() -> std::process::ExitCode {
    let fetch = fireargs::command()
        .name("fetch")
        .description("Fetch a URL")
        .handler(async |input: FetchInput, context| {
            tokio::task::yield_now().await;
            let mode = if context.json { "json" } else { "text" };
            Ok(Fetched { url: input.url, mode: mode.into() })
        });
    fetch.run_async().await
}
```

Input that fails the schema is reported like a commander parse error — one
`error: ...` line per field on stderr, exit code 1. An error returned by the
handler, and output that fails its schema, end the run: `.run()` prints
`error: <message>` to stderr and exits 1, and `.try_run_from(...)` returns the
error. A `render_error` hook takes all of them instead (see
[JSON mode](/rust/json-mode/#errors)).

## What gets derived from the input struct

For each field of the input struct:

| Rust construct                            | Becomes                                                                     |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| `String` / an integer / a float           | `--key <value>`, required unless defaulted; a number's CLI string is parsed |
| `bool`                                    | `--key` flag                                                                |
| `#[fireargs(argument)]`                   | positional `[key]`, read in field order                                     |
| `#[fireargs(default)]` / `default = expr` | shown as `(default: …)` in `--help`; filled in when absent                  |
| a `#[fireargs::option]` enum              | choices: `(choices: "a", "b")` in `--help`, checked against the schema      |
| `Vec<T>`                                  | `--key <value>...`: `--key a b` or `--key a --key b`; positional `[key]...` |
| `Vec<SomeEnum>`                           | repeated, with choices on each value                                        |
| `Option<T>`                               | optional, with no default needed                                            |
| a doc comment on the field                | shown in `--help` and surfaced as `description` in `--llms` JSON Schema     |

`key` is the camelCase wire key, shown in kebab-case: `header_rows` is `headerRows`
in `--json` and `--header-rows` at the shell. See
[Flag names](/rust/inputs/#flag-names).

For per-field CLI config that serde and schemars don't model (positional, short
flag, env var, conflicts, hidden, a preset value, a custom parser, …) add
[`#[fireargs(...)]`](/rust/inputs/) to the field.

## Configuration

The builder methods, all optional, before `.handler(...)`:

| Method                                   | What it does                                                                             |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| `.name(...)`                             | the command name when run on its own; a program's router key overrides it                |
| `.description(...)`                      | help text, and the tool `description` in `--llms`                                        |
| `.summary(...)`                          | the one-line text in the parent's command list and `-h`; falls back to `description`     |
| `.alias(...)`                            | an extra name the parent program also routes to this command; repeat for more            |
| `.usage(...)`                            | replaces the generated usage line                                                        |
| `.version(...)`                          | adds a `-V, --version` flag printing it                                                  |
| `.before_help(...)`, `.after_help(...)`  | text printed before and after the generated help                                         |
| `.json_option(...)`, `.llms_option(...)` | a `FlagConfig` to rename or disable `--json`/`--llms`. See [LLMs mode](/rust/llms-mode/) |
| `.render_error(...)`                     | `Fn(&Error, &Context) -> Option<Value>`. See [JSON mode](/rust/json-mode/#errors)        |
| `.configure(...)`                        | `Fn(clap::Command) -> clap::Command`, applied to the clap command fireargs declares      |

## The clap command

Fireargs declares the clap command when the command runs. `.configure(...)` gets it
last, so anything clap offers is reachable — a help template, colors, a
`display_order` — through the `fireargs::clap` re-export:

```rust
let greet = fireargs::command()
    .configure(|clap| clap.help_template("{usage}\n\n{all-args}"))
    .handler(async |input: GreetInput, _| Ok(greet_someone(input)));
```

Fireargs reads its input from the fields it declared, so an argument added in
`configure` reaches clap but not the handler. Run a command with `.run()`,
`.run_async().await`, or `.try_run_from(argv, &mut out, &mut err).await`, which
takes the argv (binary name first) and the writers, for tests.

## Why a typed command

`Command<I, O>` carries its input and output types until a program mounts it, so
`.render(...)` is typed from them, and a function returning
`fireargs::Command<GreetInput, GreetOutput>` states its contract in its signature. The
handler's closure is the one place the types are written: the schemas, the handler
and the render cannot drift apart.
