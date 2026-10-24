---
title: Outputs
path: /python/outputs/
icon: arrow-up-from-line
order: 5
description: How the output type validates handler returns and shapes JSON / LLM responses.
---

# Outputs

The handler's return annotation defines the shape of whatever it returns.
There's no `Argument()` / `Option()` equivalent for outputs — outputs
aren't CLI inputs, so click has no per-field surface to configure. The type
is pure data shape.

```python
from pydantic import BaseModel
from fireargs import command


class GreetInput(BaseModel):
    name: str


class GreetOutput(BaseModel):
    greeting: str
    iterations: int


@command()
def greet(input: GreetInput) -> GreetOutput:
    return GreetOutput(greeting=f"hello {input.name}", iterations=1)
```

Any type pydantic validates works: `list[str]` writes a bare JSON array
under `--json`, a scalar writes a scalar, and `None` writes `null`. Prefer a
model when the output may grow fields later — and when the CLI is exposed to
MCP clients, whose `outputSchema` must be an object.

## Where the output type is used

1. **Validation** — the handler's return value is validated against the type
   on every invocation, through a pydantic `TypeAdapter`. A matching `dict`
   is accepted for a model, validators run, and a mismatch raises
   `ValidationError`.
2. **`--json` serialization** — when `--json` is set, the validated value is
   dumped in pydantic's JSON mode, by alias, and written to stdout as JSON
   indented by two spaces. See [JSON mode](/python/json-mode/).
3. **Human rendering** — without `--json`, the validated value goes to the
   command's render when it has one. See [Commands](/python/commands/).
4. **`--llms` manifest** — the type's JSON Schema, in pydantic's
   serialization mode, is surfaced as the tool's `outputSchema`. See
   [LLMs mode](/python/llms-mode/).

## Optional fields

A field spelled `X | None = None` is Python's optional: while it is `None`
it is left out of the `--json` output instead of being written as `null`, and
the `outputSchema` does not require it — the same wire shape as a
TypeScript twin's `.optional()` field. Any other defaulted field is always
present, so the `outputSchema` marks it required.

```python
from pydantic import BaseModel


class Page(BaseModel):
    items: list[str]
    total: int = 0  # always written, required in outputSchema
    next_cursor: str | None = None  # left out while None
```

## Serialization

Pydantic's JSON mode does the work, so most standard types have a plain-JSON
wire form:

| Type                         | On the wire                     | In `outputSchema`                     |
| ---------------------------- | ------------------------------- | ------------------------------------- |
| `datetime` / `date` / `time` | ISO 8601 string                 | `string` with `format: date-time`, …  |
| `timedelta`                  | ISO 8601 duration (`"PT1M30S"`) | `string` with `format: duration`      |
| `Decimal`                    | string (`"1.5"`)                | `string`                              |
| `UUID` / `Path`              | string                          | `string` with `format: uuid` / `path` |
| `set[T]` / `tuple[T, ...]`   | array                           | `array`                               |
| `bytes`                      | UTF-8 string                    | `string` with `format: binary`        |
| `Enum`                       | its value                       | `enum` under `$defs`                  |
| a nested model               | object, by alias                | `$ref` into `$defs`                   |

A type pydantic cannot describe or serialize — an arbitrary class allowed
with `arbitrary_types_allowed` — fails the run under `--json` and fails
`--llms`. Convert it to a model or a JSON-native type in the handler.

fireargs deliberately stays plain JSON, so the wire is consumable by any LLM,
shell, or non-fireargs client.

## Dates round-trip

Unlike `JSON.stringify` and zod, pydantic writes a `datetime` as ISO 8601
and reads the same string back, and its JSON Schema says so with
`format: date-time`. A `datetime` field needs no workaround in either the
input or the output model.

## What flows to `--llms`

Per property, the JSON Schema in the manifest carries:

- `type`, `format`, `pattern` and bounds — derived from the Python type and
  the field's constraints.
- `title` — pydantic adds one per field and per model.
- `description` — from `description=` on `Field(...)`.
- `enum` — from `Literal[...]` and `Enum`.
- `required` — every field without a default, plus each defaulted field
  except `X | None = None` ones.

There's no CLI-side metadata on outputs — `Argument()` / `Option()` are
inputs-only — so every key pydantic emits passes through.

## Why no separate slots like `Argument()`/`Option()`?

Click's `Command` has no output abstraction. CLI users see whatever the
render prints (or what `--json` serializes); there's nothing for fireargs to
"wire" beyond running the validation. Keeping outputs as plain pydantic
types matches click's surface and avoids inventing concepts the runtime
can't honor.
