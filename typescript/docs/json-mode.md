---
title: JSON mode
path: /typescript/json-mode/
icon: file-braces
order: 7
description: --json drives a fireargs command with JSON in and JSON out.
---

# JSON mode

`--json` is a built-in flag on every fireargs command. It lets the same
binary serve human users at the shell, scripts in a pipeline, and LLM
agents — all backed by one zod-validated handler.

Enabled by default. Disable per-command with `jsonOption: false`, or
customize the flag string/description with `jsonOption: { flags?, description? }`.

## Three modes

```bash
greet world                              # CLI in, .render output (if any)
greet world --json                       # CLI in, JSON out
greet --json '{"name":"world"}'          # JSON in, JSON out
```

The flag takes an optional value (`--json [value]`):

- **Absent** — normal CLI parsing, handler runs, and the validated output
  goes to `.render(...)` if the command has one; otherwise nothing is printed.
- **Present without a value** — CLI parsing for input, but the handler's
  return is serialized as JSON to stdout.
- **Present with a JSON value** — input comes from the JSON blob; CLI
  positionals/options are skipped, so required positionals may be left off;
  output is JSON.

## What happens on `--json '<value>'`

1. `JSON.parse`'s the value.
2. Validates the parsed object through the input zod schema.
3. Calls the handler with the validated input and `context.json === true`.
4. Validates the handler's return through the output schema.
5. Writes `JSON.stringify(result, null, 2) + "\n"` to commander's
   `writeOut` — `configureOutput.writeOut` can intercept it (handy for
   tests).

When `--json` is passed alone (no value), step 1 is skipped and input is
collected from the regular CLI parse instead. Steps 3–5 are identical.

## Keeping stdout clean

The handler's second argument tells it which mode it runs in. In JSON mode,
anything else written to stdout corrupts the result, so spinners, colors and
progress output should check `context.json`:

```ts
.handler(async (input, context) => {
  const spinner = context.json ? undefined : startSpinner("Loading")
  // ...
})
```

## Errors

Without a hook, a value that is not JSON and input that fails the zod schema
are reported like a commander parse error, written to stderr with exit code 1:

```text
error: --json value is not valid JSON: ...
error: invalid --json input at 'a.b[0]': Invalid input: expected number, received string
```

With `exitOverride: true` they throw a `CommanderError` instead, coded
`fireargs.invalidJson` or `fireargs.invalidInput`. Output-schema failures and
handler exceptions reject the returned `Command`'s `parseAsync(...)`.

Set `renderError` in the command's or program's config to turn all of them
into output instead — the hook receives the original `SyntaxError` or
`ZodError` for input failures:

```ts
f.program({
  name: "myapp",
  renderError: (error, context) => {
    const message = error instanceof Error ? error.message : String(error)
    return context.json ? { error: message } : `error: ${message}`
  },
})
```

- In JSON mode a returned value is written as JSON to `writeOut`; otherwise a
  returned string is written to `writeErr`. Return nothing to write it
  yourself; rethrow to reject `parseAsync(...)` as before.
- `process.exitCode` is then set to `1`. The process is not exited, so a
  large payload still drains into a pipe — and `exitOverride` does not apply.
- It also catches `.render(...)` failures. The nearest hook wins: the leaf's
  own, then each enclosing program's.

Commander parse errors (unknown option, bad choice, missing positional, too
many arguments) happen before the run starts: they are written to stderr and
exit with code 1, or throw a `CommanderError` with `exitOverride: true`.

## Composes with subcommands

Every leaf in a program tree gets its own `--json`:

```bash
myapp greet --json '{"name":"world"}'
myapp api deploy --json '{"env":"prod"}'
```

The program (root) doesn't have its own `--json` — programs dispatch to
subcommands; only leaves take input. See [Programs](/typescript/programs/).

## Pairs with `--llms`

Together with [LLMs mode](/typescript/llms-mode/), `--json` is the call-time half of
fireargs's agentic interface: an LLM reads the `--llms` manifest to learn
the schemas, then calls back through `--json` with a value matching the
documented `inputSchema`.
