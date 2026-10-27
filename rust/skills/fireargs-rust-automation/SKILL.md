---
name: fireargs-rust-automation
description: Use when driving a Rust Fireargs CLI from a script, a test or an LLM agent — --json input and output, the --llms MCP-shaped tool manifest, customising or disabling those flags, render_error, and how errors and exits surface.
---

# Fireargs Rust Automation

Guidance for the machine-facing half of a Fireargs for Rust CLI: JSON in and out, and the tool manifest an agent reads first.

## When to use this skill

Invoke when the user asks to:

- Call a Fireargs CLI from a script, a pipeline or another program.
- Expose a Fireargs CLI to an LLM agent as tools, or call one as an agent.
- Rename, redescribe or disable the built-in `--json` or `--llms` flag.
- Test a command or format its errors.

## `--json`: three modes

Every leaf command gets `--json [<value>]`:

```bash
greet world                       # CLI in, render output if any
greet world --json                # CLI in, JSON out
greet --json '{"name":"world"}'   # JSON in, JSON out
```

With a value, the run is: parse the value as JSON → validate it against the input struct's JSON Schema → fill in defaults and deserialize it → run the handler → serialize the result and validate it against the output's JSON Schema → print it indented by two spaces on stdout. The CLI's own arguments and options are ignored for input, so required positionals may be left off.

- Only leaves have `--json`; a program dispatches. Call a nested leaf by its path: `myapp db migrate --json '{}'`.
- Keys are the camelCase wire keys `#[fireargs::input]` gives (`headerRows`), or a `rename_all`'s. Keys the struct does not declare are ignored, unless it sets `#[serde(deny_unknown_fields)]`.
- JSON input skips clap, so env vars, a field's `parse`, number parsing, `conflicts` and `implies` do not apply — defaults and the schema's validation, choices included, still do. An invariant that must hold in both modes belongs in the handler: check it there and return an `Err`. Send each value in its real type, like zod: `["a","b"]`, not `"a,b"`; `3`, not `"3"`. A `chrono` date, a `Uuid` and a unit enum variant are still sent as strings.
- An `Option<T>` field of a `#[fireargs::output]` struct is left out while `None`; on a hand-derived output it is written as `null` unless it has `#[serde(skip_serializing_if = "Option::is_none")]`.

## `--llms`: the manifest

Every command and program gets `--llms`, which prints a manifest and exits without running the handler. Its shape is MCP's `tools/list` result:

```json
{
  "tools": [
    {
      "name": "help",
      "description": "Documentation tool, not callable. ...",
      "inputSchema": { "type": "object", "properties": {} },
      "outputSchema": { "type": "object", "properties": {} }
    },
    {
      "name": "db migrate",
      "description": "Run pending migrations",
      "inputSchema": {
        "type": "object",
        "properties": { "...": {} },
        "required": ["..."],
        "$schema": "https://json-schema.org/draft/2020-12/schema"
      },
      "outputSchema": {
        "type": "object",
        "properties": { "...": {} },
        "$schema": "https://json-schema.org/draft/2020-12/schema"
      }
    }
  ]
}
```

- The first tool is always the reserved `help`: its description carries the calling convention (`<binary> <name> --json '<value>'`, or `<binary> --json '<value>'` when the manifest comes from a standalone command, which is itself the binary's only tool). Never call it.
- On a program, nested leaves are flattened and `name` is the space-separated path below the binary, at every level: `myapp --llms`, `myapp db --llms` and `myapp db migrate --llms` all name that leaf `db migrate`.
- Schemas are schemars' JSON Schema (draft 2020-12), subschemas inlined: `inputSchema` for deserialization, `outputSchema` for serialization. They carry types, formats, descriptions from doc comments, defaults, enums and validation bounds. The CLI config (flag names, short flags, env vars, conflicts, …) is stripped: properties are the wire keys (`headerRows`), not the flags (`--header-rows`).
- `inputSchema` describes what `--json` accepts: a defaulted or `Option<T>` field is not `required`. In `outputSchema` every field always written is required.

## Calling a Fireargs CLI as an agent

1. Run `<binary> --llms` once and keep the tool list.
2. Pick a tool, build a value matching its `inputSchema`.
3. Run `<binary> <name> --json '<value>'`, quoting the JSON for the shell.
4. Parse stdout as JSON matching `outputSchema`. A non-zero exit or stderr output means the call failed.

## Customising the flags

`.json_option(..)` and `.llms_option(..)` on a command take a `FlagConfig`: `Enabled` (the default), `Disabled`, or `Custom { long, description }` to rename the long flag (`long: "as-json".into()` gives `--as-json`). Programs take `.llms_option(..)` only.

## Errors and exits

- A clap parse error (unknown option, extra argument) prints clap's `error: ...` and usage to stderr and exits with code 1. An unknown subcommand prints only `error: unknown command 'nope'`, as in the twins. `--help` and `--version` print to stdout and exit 0.
- A missing required positional, a `conflicts` violation and a CLI value rejected by number parsing or a field's `parse` print one `error: ...` line in commander's wording and exit 1; none reaches `render_error`.
- Without a `render_error` hook, input failures exit 1 the same way: a `--json` value that is not JSON (`error: --json value is not valid JSON: ...`) and input that fails the schema, one line per field — `error: invalid --json input at 'a.b[0]': <message>` in JSON mode, commander's wording at the shell, which quotes each value as typed (`argument '011'`, not `11`) and names the env var a value came from (`value '0' from env 'TIMES'`).
- An error from the handler or an output that fails its schema ends the run: `.run()` prints `error: <message>` and exits 1; `.try_run_from(...)` returns it as `Err`.
- `.render_error(|error, context| ...)` on a command, or once on the root program for the whole tree (the nearest hook wins). The closure is `Fn(&fireargs::Error, &Context) -> Option<serde_json::Value>`. Input failures downcast to `fireargs::InputError` (`InvalidJson`, or `Invalid` with `Issue`s), output failures to `fireargs::OutputError`; a handler's error is the one it returned. Under `--json` a returned value is printed as JSON on stdout; otherwise a returned JSON string goes to stderr. The run then exits with code 1. Return `None` to write it yourself. Building the value with `json!` takes `serde_json` as a dependency of your own (`cargo add serde_json`).
- A handler that panics bypasses all of this: Rust prints the panic message to stderr and exits with code 101, and no `render_error` hook runs. Return an `Err` for every failure a caller should see.

```rust
use serde_json::json;

fn cli() -> fireargs::Program {
    fireargs::program()
        .name("myapp")
        .render_error(|error, context| {
            Some(match context.json {
                true => json!({"error": error.to_string()}),
                false => json!(format!("error: {error}")),
            })
        })
        .command("greet", greet())
}
```

## Testing a command

```rust
#[test]
fn greet_writes_json() {
    let (mut out, mut err) = (vec![], vec![]);
    let argv = ["greet", "--json", r#"{"name":"world"}"#];
    let greet = greet();
    let code = pollster::block_on(greet.try_run_from(argv, &mut out, &mut err)).unwrap();
    assert_eq!(code, 0, "{}", String::from_utf8_lossy(&err));
    let out: serde_json::Value = serde_json::from_slice(&out).unwrap();
    assert_eq!(out, serde_json::json!({"greeting": "hello world"}));
}
```

`try_run_from` takes the argv with the binary name first, and two writers: `out` holds the `--json` result, the `--llms` manifest, help and render text; `err` holds clap's errors, the input-error lines and `render_error` strings. It returns `Ok(exit_code)`, or `Err` for an error no hook handled. It is async: block on it with `pollster` (a dev-dependency) or await it in `#[tokio::test]`.

## Rules of thumb

1. **Describe every field and command.** Doc comments and `description` are the only prose an agent sees in the manifest.
2. **Keep output types JSON-native.** Structs, strings, numbers, booleans, `Vec`s and maps map directly; `chrono` and `uuid` types serialize as strings with a documented `format` under schemars' `chrono04` / `uuid1` features.
3. **Keep stdout clean in JSON mode.** Check the handler's `context.json` and skip spinners and colored output; put human output in the render, which never runs under `--json`.
4. **Never parse `--help` text.** Use `--llms` for structure and `--json` for results.

## Verification

- `<binary> --llms | jq '.tools[].name'` lists every tool once per router key, with the expected paths.
- Each tool runs with `--json` and a value built only from its `inputSchema`.
- A failing call exits non-zero, and stdout holds no result: it is empty, or only the `render_error` payload.

## References

- JSON mode: https://fireargs.dev/rust/json-mode/
- LLMs mode: https://fireargs.dev/rust/llms-mode/
- Outputs: https://fireargs.dev/rust/outputs/
