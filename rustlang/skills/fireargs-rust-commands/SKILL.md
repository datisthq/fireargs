---
name: fireargs-rust-commands
description: Use when writing or editing a Rust Fireargs command — the f::command(...) builder, how serde fields become arguments and --options, the fireargs meta and .parse(...), renders, CommandConfig, and traps.
---

# Fireargs Rust Commands

Guidance for defining a single CLI command with Fireargs for Rust: one serde input struct, one output type, one async handler and an optional render for humans. Built on serde, schemars and clap; Rust 1.88+, edition 2024.

## When to use this skill

Invoke when the user asks to:

- Add a new command or change an existing one's arguments, options or output.
- Make a field positional, give an option a short flag, an env-var fallback, choices or a default.
- Accept a shell-only syntax such as a comma list or a JSON string for one option.
- Mark options as conflicting, implied, hidden or grouped in `--help`.
- Print human-readable output, or keep a spinner quiet under `--json`.
- Customise help text, error handling, the version flag or the built-in `--json` / `--llms` flags of one command.

## The builder

`f::command(config)` opens a builder that ends in a `Command`: `.input::<I>()`, then `.output::<O>()`, then the optional `.parse(...)` and `.render(...)`, then `.handler(...)`. The handler is an async closure taking the input and a `Context` and returning `Result<O, E>`.

```rust
use std::process::ExitCode;

use fireargs::{self as f, CommandConfig, Error};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
struct GreetInput {
    /// The user's name.
    #[schemars(extend("fireargs" = {"kind": "argument"}))]
    name: String,
    /// Repeat it n times.
    #[serde(default = "one")]
    #[schemars(range(min = 1))]
    times: u32,
    #[serde(default)]
    #[schemars(extend("fireargs" = {"kind": "option", "short": "v"}))]
    verbose: bool,
}

fn one() -> u32 {
    1
}

#[derive(Serialize, JsonSchema)]
struct Greeting {
    greeting: String,
}

fn main() -> ExitCode {
    let config = CommandConfig {
        name: Some("greet".into()),
        description: Some("Greet someone politely.".into()),
        ..Default::default()
    };
    f::command(config)
        .input::<GreetInput>()
        .output::<Greeting>()
        .handler(|input, _| async move {
            let words = vec![format!("hello {}", input.name); input.times as usize];
            Ok::<_, Error>(Greeting { greeting: words.join(" ") })
        })
        .run()
}
```

- The input must be `Deserialize + JsonSchema`; a command without input takes an empty struct. The output may be any `Serialize + JsonSchema` type — `Vec<String>` writes a bare JSON array — but prefer a struct when the CLI is served over MCP, whose `outputSchema` must be an object.
- The return value is serialized and validated against the output's JSON Schema on every run; a mismatch fails the run with `fireargs::OutputError`.
- The error type is anything `Into<fireargs::Error>` (`Box<dyn std::error::Error + Send + Sync>`); write `Ok::<_, Error>(...)` when the closure never fails.
- A program's router key names the command; `name` only matters for a command run on its own, where it is the `--llms` tool name.
- `.run()` blocks on the handler with a minimal executor and returns an `ExitCode`. A handler awaiting tokio I/O or timers needs `.run_async().await` inside `#[tokio::main]`.
- `context.json` is `true` under `--json`, with or without a value. Anything else written to stdout then corrupts the result: skip spinners, colors and progress output. `context.command` is the route path (`"admin reset"`).

## Human output: `.render(...)`

Without `--json` nothing is printed unless the command has a render. It receives the validated output and a `RenderContext` carrying `input`; a returned `Some(text)` is printed with a newline, or it writes itself and returns `None`. It never runs under `--json`, so the handler just returns data:

```rust
.render(|output: &Vec<String>, _| {
    Some(output.iter().map(|name| format!("- {name}")).collect::<Vec<_>>().join("\n"))
})
```

## How input fields map to the CLI

Every field of the input struct becomes a CLI field, named by its serde key; a camelCase key is shown in kebab-case (`dryRun` → `--dry-run`, `[dry-run]`). The handler, `--json` and `--llms` keep the key.

| Rust                        | CLI                                                                |
| --------------------------- | ------------------------------------------------------------------ |
| plain field                 | `--key <value>` option                                             |
| `{"kind": "argument"}` meta | positional `[key]`, read in field order                            |
| `bool`                      | `--key` flag, no value                                             |
| integers / floats           | CLI string parsed as a number before the schema validates          |
| `Vec<T>`                    | `--key <value>...`: `--key a b` or repeated; positional `[key]...` |
| a unit enum                 | choices, listed in `--help` and checked by the schema              |
| `#[serde(default)]`         | shown as `(default: …)` in `--help`; serde fills it                |
| `Option<T>`                 | optional, no default needed                                        |
| doc comment                 | help text, and `description` in the `--llms` manifest              |

A field without a default that is not an `Option` is required. A missing positional fails with `error: missing required argument 'key'`, a missing option with `error: required option '--key <value>' not specified`; `--json '<value>'` and `--llms` runs need neither. Any other input that fails the schema prints one commander-style `error: ...` line per field and exits 1. Clap's own parse errors (unknown option, extra argument) keep clap's wording and also exit 1.

## The `fireargs` meta

`#[schemars(extend("fireargs" = {...}))]` attaches CLI config to a field's JSON Schema; fireargs reads it and strips it from `--llms`. Keys are camelCase, as in the TypeScript `ArgumentConfig` / `OptionConfig`. An unknown key or a wrongly typed value panics when the command is built. Plain fields are already options — add the meta only when a key below is needed.

`{"kind": "option", ...}`:

| Key                  | Effect                                                         |
| -------------------- | -------------------------------------------------------------- |
| `name`               | long flag without dashes: `"to"` gives `--to`                  |
| `short`              | `"v"` adds `-v` alongside `--verbose`                          |
| `env`                | environment variable used when the flag is absent              |
| `conflicts`          | key or keys of options that may not be combined with this      |
| `implies`            | `{"otherKey": value}` set when this option is given            |
| `hidden`             | leave out of `--help`                                          |
| `preset`             | value used when the flag is given without a value              |
| `helpGroup`          | heading this option is listed under in `--help`, e.g. `"Logs"` |
| `defaultDescription` | text shown for the default in `--help` instead of the literal  |

`{"kind": "argument", ...}` takes only `name` and `defaultDescription`. Every schemars validation attribute (`range`, `length`, `regex`, `email`, `inner(...)`, …) works, since input is validated against the JSON Schema.

## Parsing CLI strings

`.parse(key, |text| ...)` on the builder turns the string from argv or the env var into the field's JSON value; the schema then validates it. It is keyed by input key because a closure cannot live in the schema, and it never runs on `--json` input, so the struct — and the `--llms` manifest — describe the real value:

```rust
.parse("missingValues", |text| Ok(json!(text.split(',').collect::<Vec<_>>())))
.parse("props", |text| serde_json::from_str(text).map_err(|e| e.to_string()))
```

- A field with `parse` takes exactly one value (`--key <value>`), even for a `Vec` or `bool` type.
- An `Err(message)` becomes `error: option '--key <value>' argument '…' is invalid. <message>` and exit 1; it never reaches `render_error`.
- A key the input does not have panics when the command is built.

## `CommandConfig`

Every field is optional; end the literal with `..Default::default()`:

- **Identity:** `name`, `description`, `summary` (the one-line listing text), `aliases` (extra names the parent program routes here), `version` (adds `-V, --version`).
- **Help text:** `usage` replaces the usage line; `before_help` and `after_help` frame the help.
- **Built-in flags:** `json_option` and `llms_option` — `FlagConfig::Enabled` (default), `Disabled` or `Custom { long, description }`. See `fireargs-rust-automation`.
- **Errors:** `render_error: Some(Arc::new(|error, context| ...))` turns a failed run into output and exit code 1. See `fireargs-rust-automation`.

The clap command is built at run time and is not exposed: clap settings beyond these are not reachable.

## Rules of thumb

1. **Give booleans `#[serde(default)]`.** An absent flag is not sent, so a `bool` without a default fails whenever the flag is left off.
2. **Put `#[serde(rename_all = "camelCase")]` on input structs.** The flag is `--header-rows` either way, but only then do `--json` / `--llms` share the TypeScript twin's key, `headerRows`, instead of `header_rows`.
3. **Spell optional output as `Option<T>` with `#[serde(skip_serializing_if = "Option::is_none")]`.** That spelling is left out of `--json` output while `None` and not required in `outputSchema` — the wire shape of a TypeScript `.optional()`. Without it the field is written as `null`.
4. **Use `.parse(...)`, not a custom `Deserialize`, for shell syntax.** A deserializer is part of the type, so `--json` callers go through it too and `--llms` cannot show the string syntax. Numbers need neither: fireargs parses their CLI strings.
5. **Set `name` only to change the flag.** Reach for it for a shorter flag (`toPath` → `--to`) or to keep an existing verbatim flag (`"name": "dryRun"`). A `no…` key gives a plain `--no-…` flag, never a negation. `conflicts`, `implies` and `.parse(...)` name keys, not flags.
6. **Order positionals required first.** They are read in field order — including fields of flattened blocks, at the flatten's position — so an optional one before a required one takes the first value.
7. **Define reusable fields as newtypes** carrying their doc comment, schemars attributes and meta, with a `Default` impl; derive `Serialize` too so the default reaches the schema and `--help`.

## Verification

- Run the command with `--help` and check every argument, option, default, choice and group is listed as intended.
- Run it once at the shell and once with `--json '<value>'`, including a case that omits each optional field. Under `--json`, stdout holds the JSON and nothing else. For a field with `parse`, the shell gets the string syntax and `--json` the parsed value.
- `command.try_run_from(argv, &mut out, &mut err).await` drives a command from a unit test without exiting the process.

## References

- Commands: https://fireargs.dev/rust/commands/
- Inputs: https://fireargs.dev/rust/inputs/
- Outputs: https://fireargs.dev/rust/outputs/
