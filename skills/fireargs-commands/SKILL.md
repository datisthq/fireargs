---
name: fireargs-commands
description: Use when writing or editing a Fireargs command — f.command(...).input().output().handler(), how zod fields become arguments and --options, f.argument()/f.option() config, CommandConfig, and the traps that silently drop field metadata.
---

# Fireargs Commands

Guidance for defining a single CLI command with Fireargs: one zod input schema, one zod output schema, one handler.

## When to use this skill

Invoke when the user asks to:

- Add a new command or change an existing one's arguments, options or output.
- Make a field positional, give an option a short flag, an env-var fallback, choices or a default.
- Mark options as conflicting, implied, hidden or grouped in `--help`.
- Customise help text, hooks, error handling or the built-in `--json` / `--llms` flags of one command.

## The builder

`f.command(config?)` opens a type-stated builder. `.input(...)`, `.output(...)` and `.handler(...)` are all required, in that order. `.handler(...)` returns a real commander `Command` (tagged `type: "command"`), so run it with `parseAsync`:

```ts
import { f } from "fireargs"
import { z } from "zod"

const greet = f
  .command({ name: "greet", description: "Greet someone politely." })
  .input(
    z.object({
      name: f.argument().string().describe("The user's name."),
      times: z.coerce.number().default(1).describe("Repeat the greeting n times."),
      verbose: f.option({ short: "v" }).schema(z.boolean().default(false)),
    }),
  )
  .output(z.object({ greeting: z.string() }))
  .handler(input => ({ greeting: `hello ${input.name}`.repeat(input.times) }))

await greet.parseAsync(process.argv)
```

- Input and output must both be `z.object(...)`. A command without input uses `z.object({})`; a command returning a scalar wraps it (`z.object({ count: z.number() })`).
- The handler receives the zod-parsed input as one argument and may be async. Its return value is parsed through the output schema on every run, so output transforms apply and a mismatch throws.
- Without `--json` nothing is printed: a handler that should talk to a human at the shell writes to stdout itself.

## How input fields map to the CLI

Every key of the input object becomes a field, named exactly as the key (`dryRun` → `--dryRun`).

| Zod                | CLI                                                   |
| ------------------ | ----------------------------------------------------- |
| bare field         | `--key <value>` option                                |
| `f.argument()...`  | positional `[key]`, declared in input-key order       |
| `z.boolean()`      | `--key` flag, no value                                |
| `z.array(T)`       | variadic: `[key...]` or `--key <value...>`            |
| `z.enum([...])`    | choices, checked by commander before the handler runs |
| `.default(v)`      | default shown in `--help` and applied by commander    |
| `.optional()`      | field may be absent                                   |
| `.describe("...")` | help text, and `description` in the `--llms` manifest |

Positionals are always declared optional to commander (`[key]`); whether a field is really required is decided by zod when the input is parsed.

## `f.argument()` and `f.option()`

Both open a field builder with `.string()`, `.number()`, `.boolean()`, `.enum([...])`, `.array(inner)` and `.schema(anyZod)`. Each returns the same zod type with Fireargs metadata attached, so `z.infer` is unchanged. Bare fields are already options — reach for `f.option()` only when a slot below is needed.

`f.option(config)`:

| Field                | Effect                                                        |
| -------------------- | ------------------------------------------------------------- |
| `short`              | `"v"` adds `-v` alongside `--verbose`                         |
| `env`                | environment variable used when the flag is absent             |
| `conflicts`          | option name(s) that may not be combined with this one         |
| `implies`            | `{ otherKey: value }` set when this option is given           |
| `hidden`             | leave out of `--help`                                         |
| `preset`             | value used when the flag is given without a value             |
| `helpGroup`          | heading this option is listed under in `--help`               |
| `defaultDescription` | text shown for the default in `--help` instead of the literal |

`f.argument(config)` takes only `defaultDescription`. Commander arguments have no short flag, env, conflicts, hidden or group.

## `CommandConfig`

Everything passed to `f.command(config)` is optional and forwarded to commander:

- **Identity:** `name`, `description`, `summary`, `aliases`, `usage`, `version`, `helpGroup`.
- **Help:** `helpOption` / `helpCommand` (`false` disables), `configureHelp`, `addHelpText` (`{ beforeAll, before, after, afterAll }`), `addHelpCommand`, `addHelpOption`.
- **Parsing:** `allowUnknownOption`, `allowExcessArguments`, `enablePositionalOptions`, `passThroughOptions`, `combineFlagAndOptionalValue`, `showHelpAfterError`, `showSuggestionAfterError`.
- **Hooks and events:** `preSubcommand`, `preAction`, `postAction`, `on: [{ event, listener }]`.
- **Exit and output:** `exitOverride` (`true` throws `CommanderError` instead of exiting), `configureOutput` (`writeOut` / `writeErr`), `executableDir`.
- **Built-in flags:** `jsonOption` and `llmsOption` — `{ flags?, description? }` or `false`. See `fireargs-automation`.

Anything commander supports that the config does not surface can be called on the returned `Command` directly.

## Rules of thumb

1. **Put modifiers inside `.schema(...)`.** `f.option({ short: "v" }).boolean().optional()` returns a new zod wrapper without the metadata, so `-v` disappears and an `f.argument()` field silently turns back into `--key`. Write `f.option({ short: "v" }).schema(z.boolean().optional())`. `.describe(...)` is the one chain that keeps the metadata.
2. **Coerce numbers.** Commander hands every value over as a string, so a bare `z.number()` (and `.number()` on a field builder) rejects `--times 3`. Use `z.coerce.number()`; it accepts both CLI strings and `--json` numbers.
3. **Give booleans a default.** An absent flag reaches zod as `undefined`, so a required `z.boolean()` fails whenever the flag is left off. Use `z.boolean().default(false)` or `.optional()`.
4. **Expose dates as strings.** `z.date()` cannot be written to JSON Schema, so `--llms` throws. Use `z.iso.datetime()` (ISO string in and out) or `z.coerce.date()` on input.
5. **Keep keys flag-shaped.** The key is the flag: prefer `camelCase` keys and avoid characters that do not read well after `--`.
6. **Wrap sparingly.** Plain zod covers descriptions, defaults, choices, variadics and optionality; the wrappers are only for commander-specific slots.

## Verification

- Run the command with `--help` and check every argument, option, default, choice and env binding is listed as intended.
- Run it once at the shell and once with `--json '<value>'`, including a case that omits each optional field.
- With `exitOverride: true` and `configureOutput: { writeOut, writeErr }` the command can be driven from a unit test without exiting the process.

## References

- Commands: https://fireargs.dev/commands/
- Inputs: https://fireargs.dev/inputs/
- Outputs: https://fireargs.dev/outputs/
