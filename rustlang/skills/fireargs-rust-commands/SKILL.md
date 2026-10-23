---
name: fireargs-rust-commands
description: Use when writing or editing a Rust Fireargs command — the fireargs::command() builder, #[fireargs::input] / #[fireargs::output], how fields become arguments and --options, #[fireargs(...)] keys and parse, renders, configuration, and traps.
---

# Fireargs Rust Commands

Guidance for defining a single CLI command with Fireargs for Rust: one `#[fireargs::input]` struct, one output type, one async handler and an optional render for humans. Built on serde, schemars and clap; Rust 1.88+, edition 2024. `fireargs` is the only dependency: the macros use its re-exports of serde and schemars.

## When to use this skill

Invoke when the user asks to:

- Add a new command or change an existing one's arguments, options or output.
- Make a field positional, give an option a short flag, an env-var fallback, choices or a default.
- Accept a shell-only syntax such as a comma list or a JSON string for one option.
- Mark options as conflicting, implied, hidden or grouped in `--help`.
- Print human-readable output, or keep a spinner quiet under `--json`.
- Customise help text, error handling, the version flag, the clap command or the built-in `--json` / `--llms` flags of one command.

## The builder

`fireargs::command()` opens a builder: configuration methods first, then `.handler(...)`, an async closure taking the input and a `Context` and returning `fireargs::Result<O>`. The handler types the command: it returns `Command<I, O>`, on which `.render(...)` follows. Use qualified `fireargs::` paths; there is nothing to import.

```rust
#[fireargs::input]
struct GreetInput {
    /// The user's name.
    #[fireargs(argument)]
    name: String,
    /// Repeat it n times.
    #[fireargs(default = 1, range(min = 1))]
    times: u32,
    #[fireargs(short = 'v', default)]
    verbose: bool,
}

#[fireargs::output]
struct Greeting {
    greeting: String,
}

fn greet() -> fireargs::Command<GreetInput, Greeting> {
    fireargs::command()
        .name("greet")
        .description("Greet someone politely.")
        .handler(async |input: GreetInput, _| {
            let words = vec![format!("hello {}", input.name); input.times as usize];
            Ok(Greeting { greeting: words.join(" ") })
        })
        .render(|output, _| output.greeting.clone())
}

fn main() -> std::process::ExitCode {
    greet().run()
}
```

- **Annotate the input in the closure** (`input: GreetInput`); the output type is inferred from the `Ok(...)`. `|input: In, _| async move { ... }` works too.
- The input implements `fireargs::Input` — `#[fireargs::input]` does it; a command without input takes `#[fireargs::input] struct NoInput {}`. The output may be any `Serialize + JsonSchema` type — `Vec<String>` writes a bare JSON array — but prefer a struct when the CLI is served over MCP, whose `outputSchema` must be an object.
- The return value is serialized and validated against the output's JSON Schema on every run; a mismatch fails the run with `fireargs::OutputError`.
- The error type is `fireargs::Error` (`Box<dyn std::error::Error + Send + Sync>`): `?` converts any `std::error::Error`, and `"text".into()` makes one.
- A program's router key names the command; `name` only matters for a command run on its own, where it is the `--llms` tool name.
- `.run()` blocks on the handler with a minimal executor and returns an `ExitCode`. A handler awaiting tokio I/O or timers needs `.run_async().await` inside `#[tokio::main]`.
- `context.json` is `true` under `--json`, with or without a value. Anything else written to stdout then corrupts the result: skip spinners, colors and progress output. `context.command` is the route path (`"admin reset"`).
- Put each command in its own function returning `fireargs::Command<I, O>`; `main` only runs the CLI.

## Human output: `.render(...)`

Without `--json` nothing is printed unless the command has a render. It receives the validated output and a `RenderContext` carrying `input`; a returned `String` is printed with a newline. Return an `Option<String>` and `None` to write the output yourself. It never runs under `--json`, so the handler just returns data:

```rust
.render(|output, context| format!("{}: {}", context.input.name, output.greeting))
```

## How input fields map to the CLI

`#[fireargs::input]` derives serde and schemars, renames the fields to camelCase wire keys and makes `Option` fields optional. Every field becomes a CLI field, its key shown in kebab-case (`dry_run` → `dryRun` → `--dry-run`, `[dry-run]`). The handler, `--json` and `--llms` keep the key.

| Rust                                     | CLI                                                                |
| ---------------------------------------- | ------------------------------------------------------------------ |
| plain field                              | `--key <value>` option                                             |
| `#[fireargs(argument)]`                  | positional `[key]`, read in field order                            |
| `bool`                                   | `--key` flag, no value                                             |
| integers / floats                        | CLI string parsed as a number before the schema validates          |
| `Vec<T>`                                 | `--key <value>...`: `--key a b` or repeated; positional `[key]...` |
| a `#[fireargs::value]` enum              | choices, kebab-case, listed in `--help` and checked by the schema  |
| `#[fireargs(default)]`, `default = expr` | shown as `(default: …)` in `--help`; filled in when absent         |
| `Option<T>`                              | optional, no default needed                                        |
| doc comment                              | help text, and `description` in the `--llms` manifest              |

A field without a default that is not an `Option` is required. A missing positional fails with `error: missing required argument 'key'`, a missing option with `error: required option '--key <value>' not specified`; `--json '<value>'` and `--llms` runs need neither. Any other input that fails the schema prints one commander-style `error: ...` line per field and exits 1. Clap's own parse errors (unknown option, extra argument) keep clap's wording and also exit 1.

## `#[fireargs(...)]` on a field

Keys are snake_case; a misspelled one fails to compile. Plain fields are already options — add the attribute only when a key below is needed.

| Key                                                             | Effect                                                            |
| --------------------------------------------------------------- | ----------------------------------------------------------------- |
| `argument` / `option`                                           | positional, or an option (the default)                            |
| `name = "to"`                                                   | flag or positional name: `--to`                                   |
| `short = 'v'`                                                   | adds `-v` alongside `--verbose`                                   |
| `env = "NAME"`                                                  | environment variable used when the flag is absent                 |
| `conflicts = quiet` / `[a, b]`                                  | sibling fields that may not be combined with this                 |
| `implies(level = 3)`                                            | values set on sibling fields when this option is given            |
| `hidden`                                                        | leave out of `--help`                                             |
| `preset = expr`                                                 | value used when the flag is given without a value                 |
| `help_group = "Logs"`                                           | heading this option is listed under in `--help`                   |
| `default_description = ".."`                                    | text shown for the default in `--help` instead of the literal     |
| `default` / `default = expr`                                    | `Default::default()` or this value when absent                    |
| `parse = fn`                                                    | CLI string → value, see below                                     |
| `flatten`                                                       | mix in a `#[fireargs::input]` block, see `fireargs-rust-programs` |
| `range(..)`, `length(..)`, `regex(..)`, `email`, `inner(..)`, … | schemars validation, checked on every run                         |

A positional takes only `name`, `default_description`, `default`, `parse` and the validation keys. `conflicts` and `implies` name sibling fields by their Rust names; the macro maps them to wire keys.

## Parsing CLI strings

`#[fireargs(parse = fn)]` turns the string from argv or the env var into the field's value; the schema then validates it. The function takes `&str` and returns `Result<T, E>` with `T: Serialize` and `E: Display`. It never runs on `--json` input, so the struct — and the `--llms` manifest — describe the real value:

```rust
fn split_commas(text: &str) -> fireargs::Result<Vec<String>, String> {
    Ok(text.split(',').map(str::to_owned).collect())
}

#[fireargs::input]
struct ReadInput {
    #[fireargs(parse = split_commas)]
    missing_values: Option<Vec<String>>,
}
```

- A field with `parse` takes exactly one value (`--key <value>`), even for a `Vec` or `bool` type.
- An `Err` becomes `error: option '--key <value>' argument '…' is invalid. <message>` and exit 1; it never reaches `render_error`.
- The returned value cannot borrow the input string: collect owned values.
- Put `parse` on a `#[fireargs::value]` type to parse every field of that type (see `fireargs-rust-programs`).

## Configuration

Builder methods before `.handler(...)`, all optional:

- **Identity:** `.name(..)`, `.description(..)`, `.summary(..)` (the one-line listing text), `.alias(..)` (an extra name the parent routes here; repeat for more), `.version(..)` (adds `-V, --version`).
- **Help text:** `.usage(..)` replaces the usage line; `.before_help(..)` and `.after_help(..)` frame the help.
- **Built-in flags:** `.json_option(..)` and `.llms_option(..)` — `FlagConfig::Enabled` (default), `Disabled` or `Custom { long, description }`. See `fireargs-rust-automation`.
- **Errors:** `.render_error(|error, context| ...)` turns a failed run into output and exit code 1. See `fireargs-rust-automation`.
- **Clap:** `.configure(|clap| clap.help_template(..))` gets the declared `fireargs::clap::Command` last, so any clap setting is reachable. An argument added there reaches clap but not the input.

## Rules of thumb

1. **Give booleans `#[fireargs(default)]`.** An absent flag is not sent, so a `bool` without a default fails whenever the flag is left off.
2. **Keep the camelCase keys.** `#[fireargs::input]` and `#[fireargs::output]` already give `--json` / `--llms` the TypeScript twin's keys (`headerRows`); add a `rename_all` only to break that on purpose.
3. **Spell optional output as `Option<T>` on a `#[fireargs::output]` struct.** It is left out of `--json` output while `None` and not required in `outputSchema` — the wire shape of a TypeScript `.optional()`.
4. **Use `parse`, not a custom `Deserialize`, for shell syntax.** A deserializer is part of the type, so `--json` callers go through it too and `--llms` cannot show the string syntax. Numbers need neither: fireargs parses their CLI strings.
5. **Set `name` only to change the flag.** Reach for it for a shorter flag (`to_path` → `--to`) or to keep an existing verbatim flag (`name = "dryRun"`). A `no_…` field gives a plain `--no-…` flag, never a negation.
6. **Order positionals required first.** They are read in field order — including fields of flattened blocks, at the flatten's position — so an optional one before a required one takes the first value.
7. **Define reusable fields as `#[fireargs::value]` newtypes** carrying their doc comment, validation, CLI config, `default` and `parse`; see `fireargs-rust-programs`.

## Verification

- Run the command with `--help` and check every argument, option, default, choice and group is listed as intended.
- Run it once at the shell and once with `--json '<value>'`, including a case that omits each optional field. Under `--json`, stdout holds the JSON and nothing else. For a field with `parse`, the shell gets the string syntax and `--json` the parsed value.
- `command.try_run_from(argv, &mut out, &mut err).await` drives a command from a unit test without exiting the process.

## References

- Commands: https://fireargs.dev/rust/commands/
- Inputs: https://fireargs.dev/rust/inputs/
- Outputs: https://fireargs.dev/rust/outputs/
