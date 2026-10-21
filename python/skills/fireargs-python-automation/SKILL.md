---
name: fireargs-python-automation
description: Use when driving a Python Fireargs CLI from a script, a test or an LLM agent — --json input and output, the --llms MCP-shaped tool manifest, customising or disabling those flags, render_error, and how errors and exits surface.
---

# Fireargs Python Automation

Guidance for the machine-facing half of a Fireargs for Python CLI: JSON in and out, and the tool manifest an agent reads first.

## When to use this skill

Invoke when the user asks to:

- Call a Fireargs CLI from a script, a pipeline or another program.
- Expose a Fireargs CLI to an LLM agent as tools, or call one as an agent.
- Rename, redescribe or disable the built-in `--json` or `--llms` flag.
- Test a command or handle its errors without a traceback.

## `--json`: three modes

Every leaf command gets `--json [value]`:

```bash
greet world                       # CLI in, render output if any
greet world --json                # CLI in, JSON out
greet --json '{"name":"world"}'   # JSON in, JSON out
```

With a value, the run is: `json.loads` the value → `model_validate` it with the input model → run the handler → validate the result against the output type → dump it in pydantic's JSON mode, by alias, and print it indented by two spaces on stdout. The CLI's own arguments and options are ignored for input, so required positionals may be left off.

- Only leaves have `--json`; a program dispatches. Call a nested leaf by its path: `myapp db migrate --json '{}'`.
- Keys the input model does not declare are ignored, not rejected. Keys are field names, or aliases when the model sets them.
- JSON input skips click, so env vars, choices checks, a field's `parse` and number parsing do not apply — the model's defaults and validators still do. Input is validated in pydantic's strict mode, like zod: send each value in its real type — `["a","b"]`, not `"a,b"`; `3`, not `"3"`. An ISO 8601 `datetime`, a `UUID` and an `Enum` value are still sent as strings.
- A `X | None = None` output field is left out while `None`, rather than written as `null`.

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
      "inputSchema": {
        "properties": { "...": {} },
        "required": ["..."],
        "title": "MigrateInput",
        "type": "object"
      },
      "outputSchema": {
        "properties": { "...": {} },
        "title": "Migrated",
        "type": "object"
      },
      "description": "Run pending migrations"
    }
  ]
}
```

- The first tool is always the reserved `help`: its description carries the calling convention (`<binary> <name> --json '<value>'`). Never call it.
- On a program, nested leaves are flattened and `name` is the space-separated path below the binary. `myapp db migrate --llms` prints only that leaf, named `migrate`: take tool names from the root's manifest.
- Schemas are pydantic's JSON Schema (draft 2020-12): `inputSchema` in validation mode, `outputSchema` in serialization mode. They carry types, titles, descriptions, defaults, enums, formats, constraints and `$defs`. CLI-only config (flag names, short flags, env vars, conflicts, …) is not in them: properties are the field names or aliases (`header_rows`), not the flags (`--header-rows`).
- `inputSchema` describes what `--json` accepts: a defaulted field is not `required`. In `outputSchema` every defaulted field is required except `X | None = None` ones.
- A type pydantic cannot describe (an arbitrary class) makes `--llms` fail.

## Calling a Fireargs CLI as an agent

1. Run `<binary> --llms` once and keep the tool list.
2. Pick a tool, build a value matching its `inputSchema`.
3. Run `<binary> <name> --json '<value>'`, quoting the JSON for the shell.
4. Parse stdout as JSON matching `outputSchema`. A non-zero exit or stderr output means the call failed.

## Customising the flags

`json_option` and `llms_option` in a command's config take `{"flags": ..., "description": ...}` or `False`. Any flag names work (`{"flags": "-j, --as-json"}`); Fireargs reads the value under its own parameter name. Programs take `llms_option` only.

## Errors and exits

- A click parse error (unknown option, bad choice, extra argument) prints click's usage and `Error: ...` to stderr and exits with code 2.
- A missing required positional, a `conflicts` violation and a CLI value rejected by number parsing or a field's `parse` print one `error: ...` line in commander's wording and exit 1; none reaches `render_error`.
- Without a `render_error` hook, input failures exit 1 the same way: a `--json` value that is not JSON (`error: --json value is not valid JSON: ...`) and input that fails pydantic, one line per field — `error: invalid --json input at 'a.b[0]': <pydantic message>` in JSON mode, commander's wording at the shell.
- An output validation failure or an exception from the handler or render propagates out of the click command — a traceback and exit 1 in standalone mode — unless a `render_error` hook is set.
- `render_error=(error, context) -> value` on a command, or once on the root program for the whole tree (the nearest hook wins); `@cli.render_error` registers it as a decorator, and it may be async. It receives input failures as the original `json.JSONDecodeError` or `ValidationError`, and output, handler and render exceptions as raised. Under `--json` its return is printed as JSON on stdout; otherwise a returned string goes to stderr. The run then exits with code 1. Return `None` to write it yourself; raise to propagate.

```python
def render_error(error: Exception, context: fa.Context) -> object:
    return {"error": str(error)} if context.json else f"error: {error}"


cli = fa.Program(name="myapp", render_error=render_error, router={...})
```

## Testing a command

```python
import json
from click.testing import CliRunner


def test_greet():
    result = CliRunner().invoke(greet, ["--json", '{"name":"world"}'])
    assert result.exit_code == 0, result.output
    assert json.loads(result.stdout) == {"greeting": "hello world"}
```

`result.stdout` holds the `--json` result, the `--llms` manifest and render text; `result.stderr` holds the input-error lines and `render_error` strings; `result.exception` holds an exception that propagated. Pass `prog_name="myapp"` to fix the name in usage lines. A command with an async handler must be invoked from synchronous test code, not from inside a running event loop.

## Rules of thumb

1. **Describe every field and command.** Descriptions are the only prose an agent sees in the manifest.
2. **Keep output types JSON-native.** Models, strings, numbers, booleans, lists and dicts map directly; `datetime`, `UUID`, `Decimal` and `Path` serialize as strings with a documented `format`. Arbitrary classes do not serialize.
3. **Keep stdout clean in JSON mode.** Check the handler's `context.json` and skip spinners and colored output; put human output in the render, which never runs under `--json`.
4. **Never parse `--help` text.** Use `--llms` for structure and `--json` for results.

## Verification

- `<binary> --llms | jq '.tools[].name'` lists every tool once per router key, with the expected paths.
- Each tool runs with `--json` and a value built only from its `inputSchema`.
- A failing call exits non-zero, and stdout holds no result: it is empty, or only the `render_error` payload.

## References

- JSON mode: https://fireargs.dev/python/json-mode/
- LLMs mode: https://fireargs.dev/python/llms-mode/
- Outputs: https://fireargs.dev/python/outputs/
