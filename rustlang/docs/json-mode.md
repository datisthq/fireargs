---
title: JSON mode
path: /rust/json-mode/
icon: file-braces
order: 7
description: --json drives a fireargs command with JSON in and JSON out.
---

# JSON mode

`--json` is a built-in flag on every fireargs command. It lets the same
program serve human users at the shell, scripts in a pipeline, and LLM
agents — all backed by one schema-validated handler.

Enabled by default. Disable per command with
`json_option: FlagConfig::Disabled`, or rename the flag and its help with
`FlagConfig::Custom { long, description }` — any long name works, e.g.
`long: "as-json".into()` for `--as-json`.

## Three modes

```bash
greet world                              # CLI in, rendered output (if any)
greet world --json                       # CLI in, JSON out
greet --json '{"name":"world"}'          # JSON in, JSON out
```

The flag takes an optional value (`--json [<value>]`):

- **Absent** — normal CLI parsing, the handler runs, and the validated output
  goes to the command's render if it has one; otherwise nothing is printed.
- **Present without a value** — CLI parsing for input, but the handler's
  return is serialized as JSON to stdout.
- **Present with a JSON value** — input comes from the JSON value; CLI
  positionals and options are skipped, so required positionals may be left
  off; output is JSON.

## What happens on `--json '<value>'`

1. Parses the value as JSON.
2. Validates it against the input struct's JSON Schema, collecting every
   failing path.
3. Deserializes it into the input struct with serde.
4. Calls the handler with the input and `context.json == true`.
5. Serializes the handler's return and validates it against the output
   type's JSON Schema.
6. Writes it to stdout as JSON indented by two spaces, with a newline.

When `--json` is passed alone (no value), step 1 is skipped and input is
collected from the regular CLI parse instead. Steps 2–6 are identical.

JSON input bypasses clap, so env vars, a field's `parse`, number parsing,
`conflicts` and `implies` do not apply — serde's defaults and the schema's
validation, choices included, still do. Send each value in its real type:
`["a","b"]`, not `"a,b"`; `3`, not `"3"` — the schema rejects a string for
an integer, like zod does. Strings still carry the types JSON has no literal
for: a `chrono` date, a `Uuid`, a unit enum variant. Keys the struct does not
declare are ignored, as serde does by default; `#[serde(deny_unknown_fields)]`
rejects them.

## Keeping stdout clean

The handler's `Context` tells it which mode it runs in. In JSON mode,
anything else written to stdout corrupts the result, so spinners, colors
and progress output should check `context.json`:

```rust
use fireargs::{self as f, Command, CommandConfig, Error};
use schemars::JsonSchema;
use serde::Deserialize;

#[derive(Deserialize, JsonSchema)]
struct SyncInput {
    source: String,
}

fn create_sync() -> Command {
    f::command(CommandConfig::default())
        .input::<SyncInput>()
        .output::<Vec<String>>()
        .handler(|input, context| async move {
            if !context.json {
                eprintln!("Syncing {}…", input.source);
            }
            Ok::<_, Error>(vec![input.source])
        })
}
```

## Errors

Without a hook, a value that is not JSON and input that fails the schema are
reported like a commander parse error, written to stderr with exit code 1:

```text
error: --json value is not valid JSON: expected ident at line 1 column 2
error: invalid --json input at 'items[0][1]': "x" is not of type "integer"
```

The path reads like TypeScript's (`a.b[0]`); the message after the colon is
the JSON Schema validator's. An error the handler returns and output that
fails its schema end the run: `.run()` prints `error: <message>` to stderr
and exits 1, and `.try_run_from(...)` returns the error.

Set `render_error` in the command's or program's config to turn all of them
into output instead. The hook receives a `&fireargs::Error`: input failures
downcast to `fireargs::InputError` (`InvalidJson` or `Invalid` with the
issues), output failures to `fireargs::OutputError`, and a handler's error
is the one it returned:

```rust
use std::sync::Arc;

use fireargs::{self as f, Context, Error, InputError, Program, ProgramConfig, RenderError};
use serde_json::json;

fn create_cli(greet: f::Command) -> Program {
    let render_error: RenderError = Arc::new(|error: &Error, context: &Context| {
        let input = error.downcast_ref::<InputError>().is_some();
        Some(match context.json {
            true => json!({"error": error.to_string(), "input": input}),
            false => json!(format!("error: {error}")),
        })
    });
    f::program(ProgramConfig {
        name: Some("myapp".into()),
        render_error: Some(render_error),
        ..Default::default()
    })
    .router([("greet", greet.into())])
}
```

- In JSON mode a returned value is written as JSON to stdout; otherwise a
  returned JSON string is written to stderr. Return `None` to write it
  yourself.
- The run then exits with code 1; a hook cannot hand the error back.
- The nearest hook wins: the leaf's own, then each enclosing program's.

Clap's parse errors (unknown option, extra argument) happen before the run
starts: clap prints `error: ...` and its usage line to stderr and exits
with code 1. A missing required positional, a `conflicts` violation and a
CLI value that number parsing or a field's `parse` rejects are reported in
commander's wording, also with exit code 1. None of these reach
`render_error`. A value that parses but fails the schema — a bound, a
choice, a missing required option — does, like `--json` input.

## Composes with subcommands

Every leaf in a program tree gets its own `--json`:

```bash
myapp greet --json '{"name":"world"}'
myapp api deploy --json '{"env":"prod"}'
```

The program itself doesn't have a `--json` — programs dispatch to
subcommands; only leaves take input. See [Programs](/rust/programs/).

## Pairs with `--llms`

Together with [LLMs mode](/rust/llms-mode/), `--json` is the call-time
half of fireargs's agentic interface: an LLM reads the `--llms` manifest to
learn the schemas, then calls back through `--json` with a value matching
the documented `inputSchema`.
