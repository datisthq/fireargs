---
title: Commands
path: /commands/
icon: terminal
order: 3
description: The f.command(...) chainable builder and the leaf shape it produces.
---

# Commands

`f.command(config?)` opens a chainable, type-stated builder. Call `.input(...)`,
`.output(...)`, optionally `.render(...)`, then `.handler(...)`, in that order.
The terminal `.handler(...)` returns a fully-wired `Command`, a subclass of
commander's `Command` tagged `type: "command"`.

```ts
import { f } from "fireargs"
import { z } from "zod"

const greet = f
  .command({ name: "greet" })
  .input(z.object({ name: z.string() }))
  .output(z.object({ greeting: z.string() }))
  .handler(input => ({ greeting: `hello ${input.name}` }))

await greet.parseAsync(process.argv)
```

## `.input(z.object)` and `.output(schema)`

The input must be a `z.object(...)`: its shape determines the positional
arguments and `--options` (see [Inputs](/inputs/)). The output can be any zod
schema — an object, an array, a scalar (see [Outputs](/outputs/)). It
validates whatever the handler returns; mismatches throw at runtime through
commander's `parseAsync`.

## `.render((output, ctx) => text)`

Optional. Turns the validated output into what a human sees at the shell.
It runs only without `--json`; with it, the output is written as JSON
instead. A returned string is written to `writeOut` with a trailing newline;
return nothing to write the output yourself (spinners, colors, tables).
`ctx` carries `input` (the parsed input), `json` and `command`. Without
`.render`, a run without `--json` prints nothing.

```ts
f.command({ name: "list" })
  .input(z.object({ path: f.argument().string() }))
  .output(z.array(z.string()))
  .render(names => names.map(name => `- ${name}`).join("\n"))
  .handler(input => listNames(input.path))
```

## `.handler((input, ctx) => result)`

Receives the parsed, zod-validated input and a context. Must return a value
matching the output schema. May be async — fireargs awaits it.

`ctx.json` is `true` when `--json` was given, with or without a value: a
handler that drives spinners or progress output keeps quiet then, so stdout
stays parseable. `ctx.command` is the running `Command`.

The handler is wrapped in commander's `.action(...)`. Input that fails the
zod schema is reported like a commander parse error — one `error: ...` line
per field on stderr, exit code 1. Other errors propagate via the returned
`Command`'s `parseAsync(...)`. A `renderError` hook takes all of them instead
(see [JSON mode](/json-mode/#errors)).

## What gets derived from the input schema

For each property of the input object schema:

| Zod construct               | Becomes                                                                           |
| --------------------------- | --------------------------------------------------------------------------------- |
| `z.string()` / `z.number()` | `--key <value>` (mandatory unless wrapped); a number's CLI string is coerced      |
| `z.boolean()`               | `--key` flag (boolean)                                                            |
| `f.argument()...`           | positional `<key>`; `[key]` when `.optional()` or `.default(v)`                   |
| `z.default(v)`              | forwarded to commander as `defaultValue`                                          |
| `z.enum([...])`             | `cmd.choices([...])` on the option/argument                                       |
| `z.array(T)`                | variadic — `<key...>` (or `[key...]`) for positional, `--key <value...>` option   |
| `z.array(z.enum([...]))`    | variadic with choices on the element                                              |
| `.describe("...")`          | shown in commander `--help` and surfaced as `description` in `--llms` JSON Schema |

`key` is shown in kebab-case: `headerRows` becomes `--header-rows` and
`<header-rows>`, while the handler and `--json` keep `headerRows`. See
[Flag names](/inputs/#flag-names).

For per-field commander config that zod doesn't model (short flag, env var,
conflicts, hidden, preset, a custom `parse`, …) wrap the field with [`f.argument(config)`
or `f.option(config)`](/inputs/).

## `CommandConfig`

The config passed to `f.command(config?)` is a thin pass-through to
commander methods. All fields are optional.

| Field                                                                                                                        | Maps to                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `name`                                                                                                                       | `cmd.name(...)`                                                                                    |
| `description`, `summary`, `aliases`, `usage`, `version`                                                                      | identity setters                                                                                   |
| `versionOption`                                                                                                              | `{ flags?, description? }` for the option `version` adds, e.g. `{ flags: "-v, --version" }`        |
| `helpGroup`                                                                                                                  | `cmd.helpGroup(...)` — heading this command is listed under in its parent's help                   |
| `helpOption`, `helpCommand`                                                                                                  | `cmd.helpOption(...)`, `cmd.helpCommand(...)`; `false` to disable                                  |
| `configureHelp`                                                                                                              | `cmd.configureHelp(...)` — `Partial<commander.Help>`                                               |
| `addHelpText`                                                                                                                | `{ beforeAll?, before?, after?, afterAll? }` — each forwarded to `cmd.addHelpText(position, text)` |
| `addHelpCommand`, `addHelpOption`                                                                                            | drop a pre-built commander `Command` / `Option` instance into help slots                           |
| `preSubcommand`, `preAction`, `postAction`                                                                                   | each becomes `cmd.hook(event, fn)`                                                                 |
| `allowUnknownOption`, `allowExcessArguments`, `enablePositionalOptions`, `passThroughOptions`, `combineFlagAndOptionalValue` | matching boolean toggles                                                                           |
| `showHelpAfterError`, `showSuggestionAfterError`                                                                             | matching setters                                                                                   |
| `exitOverride`                                                                                                               | `true` enables throw mode; pass a `(err) => void` for a custom handler                             |
| `configureOutput`                                                                                                            | `cmd.configureOutput({...})` — custom `writeOut`/`writeErr`/etc.                                   |
| `executableDir`                                                                                                              | `cmd.executableDir(path)`                                                                          |
| `on`                                                                                                                         | `Array<{ event, listener }>` — each registered via `cmd.on(event, listener)`                       |
| `jsonOption`, `llmsOption`                                                                                                   | customize or disable the built-in `--json`/`--llms` flags. See [LLMs mode](/llms-mode/)            |
| `renderError`                                                                                                                | `(error, ctx) => value` — turn a failed run into output. See [JSON mode](/json-mode/#errors)       |

Anything commander supports that fireargs hasn't surfaced (yet) you can call
directly on the returned `Command` — `.handler(...)` returns a real commander
instance.

## Why fixed-order pipeline?

`.input` then `.output` then `.handler`, all required, with `.render` the one
optional step before `.handler`. This keeps the type-state simple (small
interfaces exposing one or two methods) and makes the `Command`'s static type predictable. If you find
yourself wanting an inputless command, use `z.object({})`.
