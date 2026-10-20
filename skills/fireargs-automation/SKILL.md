---
name: fireargs-automation
description: Use when driving a Fireargs CLI from a script, a test or an LLM agent — --json input and output, the --llms MCP-shaped tool manifest, customising or disabling those flags, and how errors and exits surface.
---

# Fireargs Automation

Guidance for the machine-facing half of a Fireargs CLI: JSON in and out, and the tool manifest an agent reads first.

## When to use this skill

Invoke when the user asks to:

- Call a Fireargs CLI from a script, a pipeline or another program.
- Expose a Fireargs CLI to an LLM agent as tools, or call one as an agent.
- Rename, redescribe or disable the built-in `--json` or `--llms` flag.
- Test a command or handle its errors without the process exiting.

## `--json`: three modes

Every leaf command gets `--json [value]`:

```bash
greet world                       # CLI in, .render output if any
greet world --json                # CLI in, JSON out
greet --json '{"name":"world"}'   # JSON in, JSON out
```

With a value, the run is: `JSON.parse` the value → parse it with the input schema → run the handler → parse the result with the output schema → write `JSON.stringify(result, null, 2)` and a newline through `writeOut` (stdout by default). The CLI's own arguments and options are ignored for input, so required positionals may be left off the command line.

- Only leaves have `--json`; a program dispatches. Call a nested leaf by its path: `myapp db migrate --json '{}'`.
- Keys the input schema does not declare are dropped by zod, not rejected.
- JSON input skips commander, so `env` fallbacks, choices checks, a field's `parse`, number coercion and commander defaults do not apply — zod's `.default(...)` still does. Send each value in its real type: `["a","b"]`, not `"a,b"`; `3`, not `"3"`.

## `--llms`: the manifest

Every command and program gets `--llms`, which prints a manifest and exits without running the handler. Its shape is MCP's `tools/list` result:

```json
{
  "tools": [
    {
      "name": "help",
      "description": "Documentation tool, not callable. ...",
      "inputSchema": {},
      "outputSchema": {}
    },
    {
      "name": "db migrate",
      "description": "Run pending migrations",
      "inputSchema": {
        "type": "object",
        "properties": { "...": {} },
        "required": ["..."]
      },
      "outputSchema": { "type": "object", "properties": { "...": {} } }
    }
  ]
}
```

- The first tool is always the reserved `help`: its description carries the calling convention (`<binary> <name> --json '<value>'`). Never call it.
- On a program, nested leaves are flattened and `name` is the space-separated path below the binary. `myapp db migrate --llms` prints only that leaf, named `migrate`: take tool names from the root's manifest.
- Schemas are JSON Schema draft 2020-12 from `z.toJSONSchema`: types, `.describe(...)` text, defaults, enums and formats. CLI-only config (flag names, short flags, env, conflicts, …) is stripped: properties are the input keys (`headerRows`), not the flags (`--header-rows`).
- `inputSchema` describes what `--json` accepts: a defaulted field is not `required`, and a `.transform()` field shows its pre-transform type. `outputSchema` describes the validated output.
- A type JSON Schema cannot express (`z.date()`, an output `.transform()`) appears as `{}`, meaning any value.

## Calling a Fireargs CLI as an agent

1. Run `<binary> --llms` once and keep the tool list.
2. Pick a tool, build a value matching its `inputSchema`.
3. Run `<binary> <name> --json '<value>'`, quoting the JSON for the shell.
4. Parse stdout as JSON matching `outputSchema`. A non-zero exit or stderr output means the call failed.

## Customising the flags

`jsonOption` and `llmsOption` in a command's config take `{ flags?, description? }` or `false`. A custom `flags` must keep the long names `--json` and `--llms`, because the parsed option keys are what Fireargs reads (`"-j, --json [value]"` works, `"--as-json"` does not). Programs take `llmsOption` only.

## Errors and exits

- A commander parse error (unknown option, bad choice, missing positional, too many arguments) prints to stderr and exits with code 1. With `exitOverride: true` it throws a `CommanderError` instead.
- Without a `renderError` hook, input failures take the same path: a `--json` value that is not JSON (`code: "fireargs.invalidJson"`) and input that fails the zod schema (`code: "fireargs.invalidInput"`), one `error: ...` line per field — `invalid --json input at 'a.b[0]': ...` in JSON mode, commander's own wording at the shell.
- A zod output failure or an exception from the handler or `.render` rejects the `parseAsync(...)` promise — unless a `renderError` hook is set.
- `renderError: (error, context) => value` on a command, or once on the root program for the whole tree (the nearest hook wins). It also receives input failures, as the original `SyntaxError` or `ZodError`. Under `--json` its return is written as JSON to `writeOut`; otherwise a returned string goes to `writeErr`. Then `process.exitCode` is set to 1 — the process is not exited and `exitOverride` does not apply. Rethrow to reject as before.

```ts
f.program({
  name: "myapp",
  renderError: (error, context) => {
    const message = error instanceof Error ? error.message : String(error)
    return context.json ? { error: message } : `error: ${message}`
  },
})
```

## Testing a command

```ts
let out = ""
const cmd = f
  .command({
    exitOverride: true,
    configureOutput: { writeOut: s => (out += s), writeErr: () => {} },
  })
  .input(z.object({ name: z.string() }))
  .output(z.object({ greeting: z.string() }))
  .handler(input => ({ greeting: `hello ${input.name}` }))

await cmd.parseAsync(["--json", '{"name":"world"}'], { from: "user" })
expect(JSON.parse(out)).toEqual({ greeting: "hello world" })
```

`writeOut` receives the `--json` result, the `--llms` manifest and `.render` text; `{ from: "user" }` passes arguments without the `node script` prefix. A test that triggers `renderError` asserts `process.exitCode` and resets it in `afterEach`.

## Rules of thumb

1. **Describe every field and command.** Descriptions are the only prose an agent sees in the manifest.
2. **Keep output schemas JSON-native.** Strings, numbers, booleans, arrays and objects round-trip; `Date`, `BigInt`, `Map` and `Set` do not (use `z.iso.datetime()`, strings, records and arrays).
3. **Keep stdout clean in JSON mode.** Check the handler's `context.json` and skip spinners and colored output; put human output in `.render`, which never runs under `--json`.
4. **Never parse `--help` text.** Use `--llms` for structure and `--json` for results.

## Verification

- `<binary> --llms | jq '.tools[].name'` lists every tool once, with the expected paths.
- Each tool runs with `--json` and a value built only from its `inputSchema`.
- A failing call exits non-zero, and stdout holds no result: it is empty, or only the `renderError` payload.

## References

- JSON mode: https://fireargs.dev/json-mode/
- LLMs mode: https://fireargs.dev/llms-mode/
- Outputs: https://fireargs.dev/outputs/
