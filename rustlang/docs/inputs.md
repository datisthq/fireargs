---
title: Inputs
path: /rust/inputs/
icon: square-pen
order: 4
description: The fireargs meta attribute and .parse(...) for per-field clap config.
---

# Inputs

Most field configuration comes from serde and schemars — descriptions from
doc comments, defaults from `#[serde(default)]`, constraints such as
`#[schemars(range(min = 1))]` or `#[schemars(regex(pattern = ...))]`,
choices from a unit enum, repeated values from `Vec<T>`, optionality from
`Option<T>`. For CLI behavior that has no serde equivalent (positionals,
short flags, env vars, conflicts, hidden, …) add the `fireargs` meta to the
field with `#[schemars(extend("fireargs" = {...}))]`.

## Default routing

Plain fields of the input struct are `--options`. To make a field
positional, give it `"kind": "argument"`:

```rust
use schemars::JsonSchema;
use serde::Deserialize;

#[derive(Deserialize, JsonSchema)]
struct GreetInput {
    #[schemars(extend("fireargs" = {"kind": "argument"}))]
    name: String, // [name] positional
    #[serde(default)]
    verbose: bool, // --verbose option (default routing)
}
```

`"kind": "option"` is the default, written out only to attach more option
config.

## Flag names

A field's flag is its input key in kebab-case: `headerRows` becomes
`--header-rows`, and a positional `sourcePath` is shown as `[source-path]`.
The handler, `--json` input and the `--llms` manifest keep the key
(`headerRows`). Set `name` to choose the flag yourself:

```rust
use schemars::JsonSchema;
use serde::Deserialize;

#[derive(Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
struct CopyInput {
    #[serde(default)]
    header_rows: u32, // --header-rows <value>
    #[serde(default)]
    #[schemars(extend("fireargs" = {"kind": "option", "name": "to"}))]
    to_path: String, // --to <value>
    #[serde(default)]
    #[schemars(extend("fireargs" = {"kind": "option", "name": "dryRun"}))]
    dry_run: bool, // --dryRun
}
```

A key starting with `no` gives a plain `--no-…` flag, not a negation: a
`noCache: bool` is `true` when `--no-cache` is passed.

## Wire keys shared with TypeScript

The key is the field's serde name, so a Rust field `header_rows` is
`header_rows` on the wire; its flag is `--header-rows` either way. Put
`#[serde(rename_all = "camelCase")]` on the input struct to keep the keys of
a TypeScript twin (`headerRows`): `--json` input and output and the `--llms`
schemas then use the camelCase key:

```rust
use schemars::JsonSchema;
use serde::Deserialize;

#[derive(Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
struct ReadInput {
    #[serde(default)]
    header_rows: u32, // --header-rows, "headerRows" on the wire
}
```

`#[serde(rename = "...")]` on one field sets its key alone. Meta that names
other fields (`conflicts`, `implies`) and `.parse(...)` use these keys.

## The meta

`#[schemars(extend("fireargs" = {...}))]` writes a JSON object under the
`fireargs` key of the field's JSON Schema, where fireargs reads it. Its keys
are camelCase, the same as the TypeScript `ArgumentConfig` /
`OptionConfig`. It sits beside schemars' own attributes:

```rust
use schemars::JsonSchema;
use serde::Deserialize;

#[derive(Deserialize, JsonSchema)]
struct ListInput {
    /// Max rows
    #[serde(default = "twenty")]
    #[schemars(range(min = 1), extend("fireargs" = {"kind": "option", "short": "l"}))]
    limit: u32,
}

fn twenty() -> u32 {
    20
}
```

A meta with an unknown key or a wrongly typed value panics when the command
is built, naming the field, rather than turning back into a plain option.
The meta is stripped from the `--llms` schemas.

Every schemars attribute applies, since input is validated against the JSON
Schema it produces: `range`, `length`, `regex`, `email`, `url`, `contains`,
`inner(...)` for items, and `extend` with any other JSON Schema keyword.

## Option meta

With `"kind": "option"` (or no `kind`), the meta takes:

| Key                  | What it does                                                        |
| -------------------- | ------------------------------------------------------------------- |
| `name`               | Long flag without dashes, e.g. `"to"` → `--to`                      |
| `short`              | Short flag letter, e.g. `"v"` adds `-v` alongside `--verbose`       |
| `env`                | Environment variable to fall back to when the flag is absent        |
| `conflicts`          | Key or keys of options that conflict with this one                  |
| `implies`            | `{"key": value}` set when this option is given                      |
| `hidden`             | Hide from `--help`                                                  |
| `preset`             | Value used when the flag appears without an argument                |
| `helpGroup`          | Heading under which this option is listed in help, e.g. `"Logging"` |
| `defaultDescription` | Display string for the default value in help                        |

The env var is listed in `--help` as `[env: NAME=]`, and its value goes
through number parsing and `.parse(...)` like a CLI value.

## Argument meta

A positional takes fewer keys — no short flag, env var, conflicts/implies,
hidden, preset or help group. Beyond `"kind": "argument"`:

| Key                  | What it does                                 |
| -------------------- | -------------------------------------------- |
| `name`               | Name shown in help and usage, e.g. `[file]`  |
| `defaultDescription` | Display string for the default value in help |

A positional's default is shown next to its description under `Arguments`,
as `(default: …)`.

## Parsing CLI values

Clap hands every value over as a string. fireargs converts it before the
schema sees it, so the struct describes the real value and `--json` callers
send that value directly:

- **Numbers parse automatically.** A field typed as an integer or a float
  (or a `Vec` of them) turns `--rows 10` into `10`, and rejects `--rows abc`
  with `error: option '--rows <value>' argument 'abc' is invalid. Not a number.`
  `--json '{"rows":"10"}'` is still rejected — the JSON value must be a
  number.
- **`.parse(key, ...)` handles any other syntax.** Registered on the builder
  by input key, since a closure cannot live in the schema, it receives the
  raw string from argv or the env var and returns the field's JSON value,
  which the schema then validates. It never runs on `--json` input or on
  defaults.

```rust
use std::collections::BTreeMap;

use fireargs::{self as f, Command, CommandConfig, Error};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

#[derive(Deserialize, Serialize, JsonSchema)]
#[serde(untagged)]
enum HeaderRows {
    Flag(bool),
    Rows(Vec<u32>),
}

#[derive(Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
struct ReadInput {
    missing_values: Option<Vec<String>>,
    header_rows: Option<HeaderRows>,
    #[serde(default)]
    props: BTreeMap<String, i64>,
}

fn parse_header_rows(text: &str) -> Result<Value, String> {
    if text == "false" {
        return Ok(json!(false));
    }
    let rows: Result<Vec<u32>, _> = text.split(',').map(str::parse).collect();
    rows.map(|rows| json!(rows)).map_err(|error| error.to_string())
}

fn create_read() -> Command {
    f::command(CommandConfig::default())
        .input::<ReadInput>()
        .output::<ReadInput>()
        // --missing-values a,b → ["a", "b"]
        .parse("missingValues", |text| Ok(json!(text.split(',').collect::<Vec<_>>())))
        // --header-rows false → false, --header-rows 1,2 → [1, 2]
        .parse("headerRows", parse_header_rows)
        // --props '{"a":1}' → {"a": 1}
        .parse("props", |text| serde_json::from_str(text).map_err(|e| e.to_string()))
        .handler(|input, _| async move { Ok::<_, Error>(input) })
}
```

A field with `parse` always takes exactly one value (`--key <value>`), even
when its type is a `Vec` or a `bool`: `parse` owns the whole string. An
`Err(message)` from `parse` is reported as an invalid argument, with the
message, and exits 1 without reaching `render_error`:

```text
error: option '--props <value>' argument 'nope' is invalid. expected ident at line 1 column 2
```

`.parse(...)` naming a key the input does not have panics when the command
is built.

Reach for `parse` rather than a custom `Deserialize` or `deserialize_with`
when the comma list or JSON string is only shell syntax. A deserializer
belongs to the type, so `--json` callers would go through it too, and
`--llms` cannot tell them which string syntax it expects.

## Examples

```rust
use schemars::JsonSchema;
use serde::Deserialize;

#[derive(Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
enum Format {
    Json,
    Yaml,
    Toml,
}

#[derive(Deserialize, JsonSchema)]
struct ServeInput {
    /// user's name
    // positional, required: [name]
    #[schemars(extend("fireargs" = {"kind": "argument"}))]
    name: String,
    // positional, optional; keep required positionals first
    #[schemars(extend("fireargs" = {"kind": "argument"}))]
    greeting: Option<String>,
    // option with short flag and env fallback
    #[serde(default = "default_port")]
    #[schemars(extend("fireargs" = {"kind": "option", "short": "p", "env": "PORT"}))]
    port: u16,
    // booleans with explicit conflicts
    #[serde(default)]
    #[schemars(extend("fireargs" = {"kind": "option", "conflicts": "cmyk"}))]
    rgb: bool,
    #[serde(default)]
    cmyk: bool,
    // hidden internal option
    #[schemars(extend("fireargs" = {"kind": "option", "hidden": true}))]
    secret: Option<String>,
    // with choices: --formats json yaml, or --formats json --formats yaml
    #[serde(default)]
    formats: Vec<Format>,
    // preset: --level alone is "info", --level debug is "debug"
    #[schemars(extend("fireargs" = {"kind": "option", "preset": "info"}))]
    level: Option<String>,
    /// Retry this many times
    #[serde(default = "default_retries")]
    #[schemars(range(max = 10))]
    retries: u32,
}

fn default_port() -> u16 {
    8080
}

fn default_retries() -> u32 {
    3
}
```

## What if I forget the meta?

Plain fields work — they default to `--options` with the schema's
validation. The meta only adds **CLI**-specific config that serde and
schemars can't express. Don't sprinkle it everywhere; reach for it when you
genuinely need a positional, a short flag, an env binding, or one of the
other keys above.
