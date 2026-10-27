---
name: fireargs-python-commands
description: Use when writing or editing a Python Fireargs command — @command(...) on a typed handler, how pydantic fields become arguments and --options, Argument()/Option() config and parse, renders, CommandConfig, and traps.
---

# Fireargs Python Commands

Guidance for defining a single CLI command with Fireargs for Python: one pydantic input model, one output type, one handler and an optional render for humans. Built on click; Python 3.12+.

## When to use this skill

Invoke when the user asks to:

- Add a new command or change an existing one's arguments, options or output.
- Make a field positional, give an option a short flag, an env-var fallback, choices or a default.
- Accept a shell-only syntax such as a comma list or a JSON string for one option.
- Mark options as conflicting, implied, hidden or grouped in `--help`.
- Print human-readable output, or keep a spinner quiet under `--json`.
- Customise help text, error handling, version flags or the built-in `--json` / `--llms` flags of one command.

## The decorator

`@command(**config)` turns a handler into a `Command`, a real click `Command`. The handler's first parameter annotation is the input model, its return annotation the output type; an optional second parameter receives `Context`. Without config, `@command` and `@command()` are the same.

```python
from typing import Annotated
from pydantic import BaseModel, Field
from fireargs import Argument, Option, command


Name = Annotated[str, Argument(description="The user's name.")]
Times = Annotated[int, Option(default=1, ge=1, description="Repeat it n times.")]
Verbose = Annotated[bool, Option(short="v", default=False)]


class GreetInput(BaseModel):
    name: Name
    times: Times
    verbose: Verbose


class GreetOutput(BaseModel):
    greeting: str


@command(description="Greet someone politely.")
def greet(input: GreetInput) -> GreetOutput:
    return GreetOutput(greeting=" ".join([f"hello {input.name}"] * input.times))


if __name__ == "__main__":
    greet()
```

- The input must be a pydantic `BaseModel`; a command without input takes an empty model. The output may be any type pydantic validates — `list[str]` writes a bare JSON array — but prefer a model when the CLI is served over MCP, whose `outputSchema` must be an object. Missing annotations raise `TypeError` at decoration.
- The return value is validated against the output type on every run: a matching `dict` is accepted, a mismatch raises `ValidationError`.
- The name defaults to the function name in kebab-case (`list_users` → `list-users`); a program's router key overrides it.
- Handlers may be `async def`; fireargs runs them with `asyncio.run`, so such a command cannot be invoked from inside a running event loop.
- `context.json` is `True` under `--json`, with or without a value. Anything else written to stdout then corrupts the result: skip spinners, colors and progress output.

## Human output: `@command.render`

Without `--json` nothing is printed unless the command has a render. It receives the validated output and, when it declares a second parameter, a `RenderContext[Input]` carrying `input`; a returned string is echoed with a newline, or it writes itself and returns `None`. It never runs under `--json`, so the handler just returns data:

```python
@list_names.render
def render_names(output: list[str]) -> str:
    return "\n".join(f"- {name}" for name in output)
```

## How input fields map to the CLI

Every field of the input model becomes a CLI field, shown in kebab-case (`dry_run` → `--dry-run`, `<dry-run>`). The handler, `--json` and `--llms` keep the field name — or its alias, when the model sets one.

| Pydantic                   | CLI                                                        |
| -------------------------- | ---------------------------------------------------------- |
| plain field                | `--key <value>` option                                     |
| `Annotated[T, Argument()]` | positional `<key>`, declared in field order before options |
| `bool`                     | `--key` flag, no value; `= True` adds `--no-key`           |
| `int` / `float`            | CLI string parsed as a number before pydantic validates    |
| `list[T]`                  | `--key <value>`, repeated; positional variadic `<key...>`  |
| `Literal[...]` / an `Enum` | choices, checked before pydantic validates                 |
| `tuple[A, B]`              | repeated, each value converted by its position             |
| a default                  | shown as `[default: …]` in `--help`; pydantic fills it     |
| `X \| None = None`         | optional; a positional shows as `[key]`                    |
| `description=`             | help text, and `description` in the `--llms` manifest      |

A field without a default is required. A missing positional fails with `error: missing required argument 'key'`, a missing option with `error: required option '--key <value>' not specified`; `--json '<value>'` and `--llms` runs need neither. Any other input that fails pydantic prints one commander-style `error: ...` line per field and exits 1. Click's own parse errors (unknown option, extra argument) keep click's wording and exit 2.

A number token is decimal — sign, digits, optional point and exponent, trimmed: `1e3` and `.5` parse, `int | float` too, `0x10`, `1_000`, `inf` and `NaN` exit 1 with `… is invalid. Not a number.` A choice is the JSON text of a value (`1`, `true`, `admin`) and maps back to that value; any other token exits 1 with `error: option '--key <value>' argument 'x' is invalid. Allowed choices are a, b.`

A `bool`'s `envvar` value is read as a word, trimmed and in any case: `1`, `true`, `yes`, `on`, `y`, `t` set it; `0`, `false`, `no`, `off`, `n`, `f` clear it, even over a `True` default; unset or empty leaves the default; anything else exits 1 with `error: option '--key' value '…' from env 'KEY' is invalid. Not a boolean.`

## `Argument()` and `Option()`

Both return a pydantic `FieldInfo` — what `Field()` returns — with Fireargs config attached; use them inside `Annotated[T, ...]`. They accept pydantic's `Field` settings (`default`, `default_factory`, `alias`, `title`, `description`, `examples`, `gt`/`ge`/`lt`/`le`, `multiple_of`, `min_length`/`max_length`, `pattern`, `strict`, `deprecated`) plus their own. Plain fields are already options — reach for `Option()` only when a slot below is needed.

`Option(...)`:

| Field                 | Effect                                                         |
| --------------------- | -------------------------------------------------------------- |
| `name`                | long flag without dashes: `"to"` gives `--to`                  |
| `short`               | `"v"` adds `-v` alongside `--verbose`                          |
| `envvar`              | environment variable(s) used when the flag is absent           |
| `show_envvar`         | list the env var in `--help`                                   |
| `conflicts`           | field name(s) of options that may not be combined with this    |
| `implies`             | `{"other_field": value}` set when this option is given         |
| `hidden`              | leave out of `--help`                                          |
| `flag_value`          | value used when the flag is given alone: `--key [value]`       |
| `help_group`          | heading this option is listed under in `--help`, e.g. `"Logs"` |
| `default_description` | text shown for the default in `--help` instead of the literal  |
| `parse`               | `(value: str) -> value` for the CLI string; see below          |

Click's own `is_flag`, `count`, `show_default`, `metavar`, `prompt`, `hide_input` and `confirmation_prompt` pass through. `Argument(...)` takes only `name`, `parse`, `envvar`, `metavar` and `default_description` beyond the pydantic settings; a positional's default shows under `Arguments` as `[default: …]`.

## Parsing CLI strings

`parse` turns the string from argv or the env var into the field's value; pydantic then validates it. It never runs on `--json` input, so the model — and the `--llms` manifest — describe the real value:

```python
missing_values: Annotated[
    list[str] | None, Option(parse=lambda value: value.split(","))
] = None
props: Annotated[dict[str, int], Option(parse=json.loads)] = {}
```

- A field with `parse` takes exactly one value (`--key <value>`), even for a list or bool type, and skips the choices check.
- An exception raised by `parse` becomes `error: option '--key <value>' argument '…' is invalid. <message>` and exit 1; it never reaches `render_error`.

## `CommandConfig`

Every keyword of `@command(...)` is optional:

- **Identity:** `name`, `description`, `aliases` (extra names the parent program routes here), `help_group`, `version`; `version_option={"flags": "-v, --version"}` renames the version flag (default `-V, --version`).
- **Built-in flags:** `json_option` and `llms_option` — `{"flags": ..., "description": ...}` or `False`. See `fireargs-python-automation`.
- **Errors:** `render_error=(error[, context]) -> value`, or `@command.render_error`, turns a failed run into output and exit code 1. See `fireargs-python-automation`.
- **Click pass-throughs:** `context_settings`, `epilog`, `short_help`, `options_metavar`, `add_help_option`, `no_args_is_help`, `hidden`, `deprecated`.

Anything else click supports can be done on the returned command, which is a real `click.Command`.

## Rules of thumb

1. **Give booleans a default.** An absent flag is not sent to pydantic, so a `bool` without a default fails whenever the flag is left off. Write `verbose: bool = False`.
2. **Spell optional as `X | None = None`.** That spelling is left out of `--json` output while `None` and not required in either schema — the wire shape of a TypeScript `.optional()`. `X | None` without a default is still required.
3. **Use `parse`, not a `BeforeValidator`, for shell syntax.** A validator is part of the model, so `--json` callers go through it too and `--llms` cannot show the string syntax. `int` and `float` need neither: fireargs parses their CLI strings.
4. **Write snake_case fields; set `name` only to change the flag.** `header_rows` already gives `--header-rows`. Reach for `name` for a shorter flag (`to_path` → `--to`) or to keep an existing verbatim flag (`name="dryRun"`). A `bool` defaulting to `True` gets `--no-…` to clear it, the last flag winning; a `no_…` field gets none and stays a plain `--no-…` flag, `True` when passed. `conflicts` and `implies` name fields, not flags.
5. **Share wire keys with a TypeScript twin through aliases.** `alias="headerRows"`, or `ConfigDict(alias_generator=to_camel, validate_by_name=True)` on a base model, makes `--json` and `--llms` use camelCase while the flag stays `--header-rows`.
6. **Order positionals required first.** They are declared in field order — including fields inherited from mixin bases, which come first — so an optional one before a required one takes the first value. A variadic that may be empty needs `= []`.
7. **Define reusable fields as `Annotated` aliases** (`Limit = Annotated[int, Option(short="l", ge=1)]`) and give the default at the use site.

## Verification

- Run the command with `--help` and check every argument, option, default, choice and group is listed as intended.
- Run it once at the shell and once with `--json '<value>'`, including a case that omits each optional field. Under `--json`, stdout holds the JSON and nothing else. For a field with `parse`, the shell gets the string syntax and `--json` the parsed value.
- `click.testing.CliRunner().invoke(command, [...])` drives a command from a unit test without exiting the process.

## References

- Commands: https://fireargs.dev/python/commands/
- Inputs: https://fireargs.dev/python/inputs/
- Outputs: https://fireargs.dev/python/outputs/
