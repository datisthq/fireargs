---
title: Inputs
path: /inputs/
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
    name:    f.argument().string(),  // <name> positional
    verbose: z.boolean(),            // --verbose option (default routing)
  }),
)
```

You can also use `f.option()` explicitly to attach per-field option config —
even though bare zod fields are already options.

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
flows through cleanly:

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
| `short`              | Short flag letter, e.g. `"v"` adds `-v` alongside `--verbose` |
| `env`                | Environment variable to fall back to when the flag is absent  |
| `conflicts`          | Other option name(s) that conflict with this one              |
| `implies`            | Other option values implied when this option is set           |
| `hidden`             | Hide from `--help`                                            |
| `preset`             | Preset value used when the flag appears without an argument   |
| `helpGroup`          | Group heading under which this option is listed in help       |
| `defaultDescription` | Display string for the default value in help                  |
| `parse`              | Turns the CLI string into the field's value — see below       |

## `ArgumentConfig`

Commander's `Argument` exposes far fewer slots than `Option` — no short flag,
no env, no conflicts/implies, no hidden, no helpGroup. What remains:

| Field                | What it does                                            |
| -------------------- | ------------------------------------------------------- |
| `defaultDescription` | Display string for the default value in help            |
| `parse`              | Turns the CLI string into the field's value — see below |

## Parsing CLI values

Commander hands every value over as a string. fireargs converts it before
zod sees it, so the schema describes the real value and `--json` callers
send that value directly:

- **Numbers coerce automatically.** A field whose schema is `z.number()`
  (or an array of them) turns `--rows 10` into `10`, and rejects `--rows abc`
  with a commander error. `--json '{"rows":"10"}'` is still rejected — the
  JSON value must be a number.
- **`parse` handles any other syntax.** It receives the raw string from argv
  or the `env` variable and returns the field's value, which zod then
  validates. It never runs on `--json` input or on defaults.

```ts
.input(
  z.object({
    // --missingValues a,b → ["a", "b"]
    missingValues: f
      .option({ parse: v => v.split(",") })
      .schema(z.array(z.string()).optional()),

    // --headerRows false → false, --headerRows 1,2 → [1, 2]
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
    // positional, required
    name: f.argument().string().describe("user's name"),

    // option with short alias and env fallback
    port: f.option({ short: "p", env: "PORT" }).schema(z.number().default(8080)),

    // boolean with explicit conflicts
    rgb:  f.option({ conflicts: "cmyk" }).boolean(),
    cmyk: z.boolean(),

    // hidden internal option
    secret: f.option({ hidden: true }).string(),

    // variadic with choices
    formats: f.option().array(z.enum(["json", "yaml", "toml"])),
  }),
)
```

## What if I forget the wrapper?

Plain zod fields work — they default to `--options` with mandatory zod-level
validation. The wrappers only add **commander**-specific config that zod
can't express. Don't sprinkle them everywhere; reach for them when you
genuinely need a short flag, env binding, or one of the other slots above.
