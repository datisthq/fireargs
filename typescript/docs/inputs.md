---
title: Inputs
path: /typescript/inputs/
icon: square-pen
order: 4
description: f.argument() and f.option() for per-field commander config.
---

# Inputs

Most field configuration comes from zod itself — descriptions via
`.describe()`, defaults via `.default()`, choices via `z.enum([...])`,
variadic via `z.array(...)`, optionality via `.optional()`. For commander
behavior that has no zod equivalent (short flags, env vars, conflicts,
hidden, a custom value parser, …) wrap the field with `f.argument(config)`
or `f.option(config)`.

## Default routing

Bare zod fields in `.input(z.object({...}))` are treated as `--options`. To
make a field positional, wrap with `f.argument()`:

```ts
.input(
  z.object({
    name:    f.argument().string(),         // <name> positional
    verbose: z.boolean().default(false), // --verbose option (default routing)
  }),
)
```

You can also use `f.option()` explicitly to attach per-field option config —
even though bare zod fields are already options.

## Flag names

A field's flag is its key in kebab-case: `headerRows` becomes `--header-rows`,
and a positional `sourcePath` is shown as `<source-path>`. The handler, `--json`
input and the `--llms` manifest keep the zod key (`headerRows`). Set `name` to
choose the flag yourself:

```ts
.input(
  z.object({
    headerRows: z.coerce.number(),                      // --header-rows <value>
    toPath:     f.option({ name: "to" }).string(),      // --to <value>
    dryRun:     f.option({ name: "dryRun" }).boolean().default(false), // --dryRun
  }),
)
```

## Booleans

A boolean is a flag without a value. One that defaults to `true` also gets
`--no-<flag>`, which sets it `false`; when both are given, the last wins.
A key that already starts with `no` gets none: `noCache: z.boolean()` is a
plain `--no-cache` flag, `true` when passed. A `--no-…` flag that clashes
with another field's flag throws when the command is built.

A boolean's `env` value is read as a word, trimmed and in any case: `1`,
`true`, `yes`, `on`, `y` or `t` sets it; `0`, `false`, `no`, `off`, `n` or
`f` clears it, even over a `true` default; unset or empty leaves the
default. Anything else exits 1:

```text
error: option '--force' value 'maybe' from env 'FORCE' is invalid. Not a boolean.
```

## The wrappers

`f.argument(config?)` and `f.option(config?)` open a per-field builder. Each
exposes the common zod constructors plus `.schema(any)` for arbitrary zod:

| Method            | Returns                                               |
| ----------------- | ----------------------------------------------------- |
| `.string()`       | `z.ZodString` tagged with the config                  |
| `.number()`       | `z.ZodNumber` tagged                                  |
| `.boolean()`      | `z.ZodBoolean` tagged                                 |
| `.enum([...])`    | `z.ZodEnum` tagged                                    |
| `.array(inner)`   | `z.ZodArray` tagged                                   |
| `.schema(custom)` | wraps any zod schema (e.g. `z.number().int().min(1)`) |

The returned schema is _the same zod type_ — fireargs writes its metadata
into Zod 4's global registry rather than wrapping the schema, so `z.infer`
flows through cleanly, and chained modifiers such as `.default()`,
`.optional()`, `.nullable()` and `.describe()` keep the metadata:

```ts
const input = z.object({
  port: f.option({ env: "PORT" }).schema(z.number()),
})
type Input = z.infer<typeof input> // { port: number }
```

## `OptionConfig`

`f.option(config)` accepts:

| Field                | What it does                                                  |
| -------------------- | ------------------------------------------------------------- |
| `name`               | Long flag without dashes, e.g. `"to"` → `--to`                |
| `short`              | Short flag letter, e.g. `"v"` adds `-v` alongside `--verbose` |
| `env`                | Environment variable to fall back to when the flag is absent  |
| `conflicts`          | Input key(s) of options that conflict with this one           |
| `implies`            | `{ inputKey: value }` set when this option is given           |
| `hidden`             | Hide from `--help`                                            |
| `preset`             | Value used when the flag is given alone: `--key [value]`      |
| `helpGroup`          | Group heading under which this option is listed in help       |
| `defaultDescription` | Display string for the default value in help                  |
| `parse`              | Turns the CLI string into the field's value — see below       |

## `ArgumentConfig`

Commander's `Argument` exposes far fewer slots than `Option` — no short flag,
no env, no conflicts/implies, no hidden, no helpGroup. What remains:

| Field                | What it does                                            |
| -------------------- | ------------------------------------------------------- |
| `name`               | Name shown in help and usage, e.g. `<file>`             |
| `defaultDescription` | Display string for the default value in help            |
| `parse`              | Turns the CLI string into the field's value — see below |

## Parsing CLI values

Commander hands every value over as a string. fireargs converts it before
zod sees it, so the schema describes the real value and `--json` callers
send that value directly:

- **Numbers coerce automatically.** A field whose schema is `z.number()`
  (or an array of them) turns `--rows 10` into `10`, and rejects `--rows abc`
  with a commander error. `--json '{"rows":"10"}'` is still rejected — the
  JSON value must be a number. An error quotes the value as typed:
  `--rows 03` that fails `.min(10)` reports `'03'`, not `3`.
  A number token is decimal: an optional sign, digits with an optional
  point, an optional exponent, surrounding whitespace trimmed — `1e3`, `.5`
  and `+7` parse; `0x10`, `1_000`, `inf` and `NaN` are not a number.
- **Choices map back to their values.** A choice is the JSON text of each
  value of a `z.enum`, a `z.literal` or a union of literals, so
  `z.literal([1, 2])` takes `--level 2` as the number `2`, and `--level 3`
  fails with `Allowed choices are 1, 2.`
- **A tuple converts by position.** `z.tuple([z.number(), z.string()])` takes
  `--pair 1 --pair a` as `[1, "a"]`; the schema checks how many were given.
- **`parse` handles any other syntax.** It receives the raw string from argv
  or the `env` variable and returns the field's value, which zod then
  validates. It never runs on `--json` input or on defaults.

```ts
.input(
  z.object({
    // --missing-values a,b → ["a", "b"]
    missingValues: f
      .option({ parse: v => v.split(",") })
      .schema(z.array(z.string()).optional()),

    // --header-rows false → false, --header-rows 1,2 → [1, 2]
    headerRows: f
      .option({ parse: v => (v === "false" ? false : v.split(",").map(Number)) })
      .schema(z.union([z.literal(false), z.array(z.number())]).optional()),

    // --props '{"a":1}' → { a: 1 }
    props: f.option({ parse: v => JSON.parse(v) }).schema(z.record(z.string(), z.number())),
  }),
)
```

A field with `parse` always takes exactly one value (`--key <value>`), even
when its schema is an array or a boolean: `parse` owns the whole string.
TypeScript rejects a `.schema(...)` that cannot accept what `parse` returns,
and an error thrown by `parse` is reported by commander as an invalid
argument.

Reach for `parse` rather than `.transform()` when the comma list or JSON
string is only shell syntax. A transform belongs to the schema, so `--json`
callers would have to send the same string, and `--llms` describes the
field by its pre-transform type.

## Examples

```ts
.input(
  z.object({
    // positional, required: <name>
    name: f.argument().string().describe("user's name"),

    // positional, optional: [greeting]; keep required positionals first
    greeting: f.argument().string().optional(),

    // option with short alias and env fallback
    port: f.option({ short: "p", env: "PORT" }).number().default(8080),

    // booleans with explicit conflicts
    rgb:  f.option({ conflicts: "cmyk" }).boolean().default(false),
    cmyk: z.boolean().default(false),

    // hidden internal option
    secret: f.option({ hidden: true }).string().optional(),

    // variadic with choices
    formats: z.array(z.enum(["json", "yaml", "toml"])).default([]),
  }),
)
```

## What if I forget the wrapper?

Plain zod fields work — they default to `--options` with mandatory zod-level
validation. The wrappers only add **commander**-specific config that zod
can't express. Don't sprinkle them everywhere; reach for them when you
genuinely need a short flag, env binding, or one of the other slots above.
