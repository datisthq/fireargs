---
title: Inputs
path: /rust/inputs/
icon: square-pen
order: 4
description: The #[fireargs::input] struct and #[fireargs(...)] for per-field clap config.
---

# Inputs

`#[fireargs::input]` turns a struct into a command's input. It adds the serde and
schemars derives (through fireargs' own re-exports, so neither crate is a dependency
of yours), gives the fields camelCase wire keys, makes `Option` fields optional, and
implements `fireargs::Input`. Most field configuration comes from the Rust type —
descriptions from doc comments, choices from a `#[fireargs::option]` enum, repeated
values from `Vec<T>`, optionality from `Option<T>`. Everything else goes in
`#[fireargs(...)]` on the field: defaults, bounds, positionals, short flags, env
vars, conflicts, a custom parser, …

## Default routing

Plain fields of the input struct are `--options`. To make a field positional, mark
it `argument`:

```rust
#[fireargs::input]
struct GreetInput {
    #[fireargs(argument)]
    name: String, // [name] positional
    #[fireargs(default)]
    verbose: bool, // --verbose option (default routing)
}
```

`option` is the default, written out only to override a
[`#[fireargs::argument]` type](/rust/composability/).

## Flag names

A field's flag is its input key in kebab-case: `header_rows` (`headerRows` on the
wire) becomes `--header-rows`, and a positional `source_path` is shown as
`[source-path]`. The handler, `--json` input and the `--llms` manifest keep the key
(`headerRows`). Set `name` to choose the flag yourself:

```rust
#[fireargs::input]
struct CopyInput {
    #[fireargs(default)]
    header_rows: u32, // --header-rows <value>
    #[fireargs(name = "to", default)]
    to_path: String, // --to <value>
    #[fireargs(name = "dryRun", default)]
    dry_run: bool, // --dryRun
}
```

## Booleans

A `bool` is a flag without a value. One that defaults to `true`
(`#[fireargs(default = true)]`) also gets `--no-<flag>`, which sets it `false`;
when both are given, the last wins. A key that already starts with `no` gets none:
a `no_cache: bool` is a plain `--no-cache` flag, `true` when passed. A `--no-…`
flag that clashes with another field's flag panics when the command is built.

A `bool`'s `env` value is read as a word, trimmed and in any case: `1`, `true`,
`yes`, `on`, `y` or `t` sets it; `0`, `false`, `no`, `off`, `n` or `f` clears it,
even over a `true` default; unset or empty leaves the default. Anything else exits 1:

```text
error: option '--force' value 'maybe' from env 'FORCE' is invalid. Not a boolean.
```

## Wire keys shared with TypeScript

`#[fireargs::input]` renames the fields to camelCase, so a Rust field `header_rows`
is `headerRows` on the wire — the key its TypeScript and Python twins use — and
`--header-rows` at the shell. A `#[serde(rename_all = "...")]` on the struct
replaces that rule, and `#[serde(rename = "...")]` on one field sets its key alone.
`conflicts` and `implies` name sibling fields by their Rust names; the macro turns
them into these keys.

## `#[fireargs(...)]`

The attribute writes the field's CLI config into its JSON Schema, under the
`fireargs` key, where fireargs reads it; the validation keys become schemars
attributes. A misspelled key fails to compile, naming the key:

```rust
#[fireargs::input]
struct ListInput {
    /// Max rows
    #[fireargs(short = 'l', default = 20, range(min = 1))]
    limit: u32,
}
```

The meta is stripped from the `--llms` schemas. serde and schemars attributes still
apply beside it, since the struct derives both.

### Values and validation

| Key                                   | What it does                                                               |
| ------------------------------------- | -------------------------------------------------------------------------- |
| `default`                             | the type's `Default` when the value is absent; shown in `--help`           |
| `default = expr`                      | this value instead; a string literal goes through `Into` (`String` fields) |
| `parse = fn`                          | turns the CLI string into the value; see [Parsing](#parsing-cli-values)    |
| `range(min = .., max = ..)`           | numeric bounds, checked on every run                                       |
| `length(min = .., max = ..)`          | string or list length                                                      |
| `regex(pattern = ..)` / `pattern(..)` | a string pattern                                                           |
| `email`, `url`, `contains(..)`        | the schemars validations of the same name                                  |
| `inner(..)`                           | any of these on each item of a `Vec`                                       |

### Option keys

| Key                          | What it does                                                 |
| ---------------------------- | ------------------------------------------------------------ |
| `name = "to"`                | Long flag without dashes → `--to`                            |
| `short = 'v'`                | Short flag letter, alongside `--verbose`                     |
| `env = "NAME"`               | Environment variable to fall back to when the flag is absent |
| `conflicts = other`          | Field or fields (`[a, b]`) that conflict with this one       |
| `implies(level = 3, ..)`     | Values set on other fields when this option is given         |
| `hidden`                     | Hide from `--help`                                           |
| `preset = expr`              | Value used when the flag is given alone: `--key [value]`     |
| `help_group = "Logging"`     | Heading under which this option is listed in help            |
| `default_description = ".."` | Display string for the default value in help                 |

The env var is listed in `--help` as `[env: NAME=]`, and its value goes through
number parsing and `parse` like a CLI value.

### Argument keys

A positional takes fewer keys — no short flag, env var, conflicts/implies, hidden,
preset or help group. Beyond `argument`:

| Key                          | What it does                                 |
| ---------------------------- | -------------------------------------------- |
| `name = "file"`              | Name shown in help and usage, e.g. `[file]`  |
| `default_description = ".."` | Display string for the default value in help |

A positional's default is shown next to its description under `Arguments`, as
`(default: …)`.

## Parsing CLI values

Clap hands every value over as a string. fireargs converts it before the schema sees
it, so the struct describes the real value and `--json` callers send that value
directly:

- **Numbers parse automatically.** A field typed as an integer or a float (or a
  `Vec` of them) turns `--rows 10` into `10`, and rejects `--rows abc` with
  `error: option '--rows <value>' argument 'abc' is invalid. Not a number.`
  `--json '{"rows":"10"}'` is still rejected — the JSON value must be a number.
  An error quotes the value as typed: `--rows 011` that fails `range(min = 20)`
  reports `'011'`, not `11`. A value out of the integer type's range — `300`
  for a `u8` — fails at its field like any other schema error.
  A number token is decimal: an optional sign, digits with an optional
  point, an optional exponent, surrounding whitespace trimmed — `1e3`, `.5`
  and `+7` parse; `0x10`, `1_000`, `inf` and `NaN` are not a number.
  A plain integer parses exactly as an `i64` or `u64`, and `1e3` reaches a `u32`
  field as `1000`.
- **Choices map back to their values.** A choice is the JSON text of each `enum`
  value or `oneOf` const in the schema, so a `u8` with
  `#[schemars(extend("enum" = [1, 2]))]` takes `--level 2` as `2`, and
  `--level 3` fails with `Allowed choices are 1, 2.`
- **A tuple converts by position.** `(i64, String)` takes `--pair 1 --pair a`
  as `[1, "a"]`; the schema checks how many were given.
- **`parse = fn` handles any other syntax.** It receives the raw string from argv
  or the env var and returns `Result<T, E>`: any `Serialize` value, which the schema
  then validates, or an error that displays. It never runs on `--json` input or on
  defaults. Set it on the field, or on a [reusable type](/rust/composability/) to
  parse every field of that type.

```rust
use std::collections::BTreeMap;

#[fireargs::option(parse = parse_header_rows)]
#[serde(untagged)]
enum HeaderRows {
    Flag(bool),
    Rows(Vec<u32>),
}

// --header-rows false → false, --header-rows 1,2 → [1, 2]
fn parse_header_rows(text: &str) -> fireargs::Result<HeaderRows, String> {
    if text == "false" {
        return Ok(HeaderRows::Flag(false));
    }
    let rows: Result<Vec<u32>, _> = text.split(',').map(str::parse).collect();
    rows.map(HeaderRows::Rows).map_err(|error| error.to_string())
}

// --props '{"a":1}' → {"a": 1}
fn parse_props(text: &str) -> serde_json::Result<BTreeMap<String, i64>> {
    serde_json::from_str(text)
}

// --missing-values a,b → ["a", "b"]
fn split_commas(text: &str) -> fireargs::Result<Vec<String>, String> {
    Ok(text.split(',').map(str::to_owned).collect())
}

#[fireargs::input]
struct ReadInput {
    #[fireargs(parse = split_commas)]
    missing_values: Option<Vec<String>>,
    header_rows: Option<HeaderRows>,
    #[fireargs(default, parse = parse_props)]
    props: BTreeMap<String, i64>,
}
```

A field with `parse` always takes exactly one value (`--key <value>`), even when its
type is a `Vec` or a `bool`: `parse` owns the whole string. An `Err` from `parse` is
reported as an invalid argument, with its message, and exits 1 without reaching
`render_error`:

```text
error: option '--props <value>' argument 'nope' is invalid. expected ident at line 1 column 2
```

Reach for `parse` rather than a custom `Deserialize` or `deserialize_with` when the
comma list or JSON string is only shell syntax. A deserializer belongs to the type,
so `--json` callers would go through it too, and `--llms` cannot tell them which
string syntax it expects.

## Examples

```rust
#[fireargs::option]
enum Format {
    Json,
    Yaml,
    Toml,
}

#[fireargs::input]
struct ServeInput {
    /// user's name
    // positional, required: [name]
    #[fireargs(argument)]
    name: String,
    // positional, optional; keep required positionals first
    #[fireargs(argument)]
    greeting: Option<String>,
    // option with short flag and env fallback
    #[fireargs(short = 'p', env = "PORT", default = 8080)]
    port: u16,
    // booleans with explicit conflicts
    #[fireargs(conflicts = cmyk, default)]
    rgb: bool,
    #[fireargs(default)]
    cmyk: bool,
    // hidden internal option
    #[fireargs(hidden)]
    secret: Option<String>,
    // with choices: --formats json yaml, or --formats json --formats yaml
    #[fireargs(default)]
    formats: Vec<Format>,
    // preset: --level alone is "info", --level debug is "debug"
    #[fireargs(preset = "info")]
    level: Option<String>,
    /// Retry this many times
    #[fireargs(default = 3, range(max = 10))]
    retries: u32,
}
```

## Without the macro

The macro writes nothing a hand-written struct cannot: derive `Deserialize` and
`JsonSchema` yourself, put the meta in `#[schemars(extend("fireargs" = {...}))]`
with the camelCase keys of the TypeScript `ArgumentConfig` / `OptionConfig`
(`{"kind": "argument"}`, `{"short": "v", "helpGroup": "Logging"}`), and add an empty
`impl fireargs::Input for MyInput {}`. Such a struct has no `parse` and does not
inherit a reusable type's default; a meta with an unknown key panics when `.handler(...)`
builds the command — so on every run, `--help` included — naming the field.
