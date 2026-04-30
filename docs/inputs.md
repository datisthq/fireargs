---
title: Inputs
path: /inputs/
icon: square-pen
order: 3
description: f.argument() and f.option() for per-field commander config.
---

# Inputs

Most field configuration comes from zod itself — descriptions via
`.describe()`, defaults via `.default()`, choices via `z.enum([...])`,
variadic via `z.array(...)`, optionality via `.optional()`. For commander
behavior that has no zod equivalent (short flags, env vars, conflicts,
hidden, …) wrap the field with `f.argument(config)` or `f.option(config)`.

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

| Method            | Returns                                                |
| ----------------- | ------------------------------------------------------ |
| `.string()`       | `z.ZodString` tagged with the config                   |
| `.number()`       | `z.ZodNumber` tagged                                   |
| `.boolean()`      | `z.ZodBoolean` tagged                                  |
| `.enum([...])`    | `z.ZodEnum` tagged                                     |
| `.array(inner)`   | `z.ZodArray` tagged                                    |
| `.schema(custom)` | wraps any zod schema (e.g. `z.coerce.number().min(1)`) |

The returned schema is _the same zod type_ — fireargs writes its metadata
into Zod 4's global registry rather than wrapping the schema, so `z.infer`
flows through cleanly:

```ts
const input = z.object({
  port: f.option({ env: "PORT" }).schema(z.coerce.number()),
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

## `ArgumentConfig`

Commander's `Argument` exposes far fewer slots than `Option` — no short flag,
no env, no conflicts/implies, no hidden, no helpGroup. The only
presentation slot worth surfacing is:

| Field                | What it does                                 |
| -------------------- | -------------------------------------------- |
| `defaultDescription` | Display string for the default value in help |

## Examples

```ts
.input(
  z.object({
    // positional, required
    name: f.argument().string().describe("user's name"),

    // option with short alias and env fallback
    port: f.option({ short: "p", env: "PORT" }).schema(z.coerce.number().default(8080)),

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
