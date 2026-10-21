---
title: LLMs mode
path: /python/llms-mode/
icon: bot
order: 8
description: --llms publishes an MCP-shaped tools manifest for agentic use.
---

# LLMs mode

`--llms` prints a manifest describing every tool reachable through this
program, in the shape of MCP's [`tools/list`](https://modelcontextprotocol.io/)
response. An LLM agent reads the manifest once and then calls back through
[`--json`](/python/json-mode/) to actually invoke a tool.

Enabled by default on every command and program. Disable per command or
program with `llms_option=False`, or customize the flag and its help with
`llms_option={"flags": ..., "description": ...}`.

## Manifest shape

```json
{
  "tools": [
    {
      "name": "help",
      "description": "Documentation tool, not callable. Each `tools[].name` is the space-separated path beneath this binary. Invoke a tool with `<binary> <name> --json '<value>'` matching that tool's `inputSchema`; output is JSON on stdout matching `outputSchema`.",
      "inputSchema":  { "type": "object", "properties": {} },
      "outputSchema": { "type": "object", "properties": {} }
    },
    {
      "name": "greet",
      "inputSchema":  { "properties": { "name": { "description": "user's name", "title": "Name", "type": "string" }, ... }, "required": ["name"], "title": "GreetInput", "type": "object" },
      "outputSchema": { "properties": { "greeting": { "title": "Greeting", "type": "string" } }, "required": ["greeting"], "title": "Greeting", "type": "object" },
      "description": "Greet someone politely"
    }
  ]
}
```

MCP requires a tool's `outputSchema` to describe an object. A command with a
list or scalar output still gets a valid JSON Schema here, but an MCP client
that validates strictly will reject it: return a model from a CLI meant to be
served over MCP.

## The reserved `help` tool

The first entry is always a `help` tool whose `description` carries the
calling convention. MCP descriptions are first-class and always surfaced to
the model, so this is the most reliable place to put guidance. Its schemas
are empty so an accidental invocation is a no-op.

## How it composes for programs

The same shape comes back from a `Program`'s `--llms`. Each leaf in the tree
becomes a tool whose `name` is the space-separated path:

```bash
myapp api greet --json '{"name":"world"}'
```

⇒ `tools[]` entry with `"name": "api greet"`. Nested programs flatten the
same way — `myapp db migrate` becomes `"db migrate"`. A leaf mounted under two
router keys appears once per key; aliases add no tools.

## Why MCP shape

[MCP](https://modelcontextprotocol.io/) is the standard for exposing tools
to LLMs. Matching its `tools/list` shape means an MCP-aware client can
consume a fireargs CLI's `--llms` output directly, and the JSON Schemas
inside follow JSON Schema Draft 2020-12 — what every LLM tool-use framework
(Anthropic SDK, OpenAI function calling, …) already understands.

## What flows from pydantic into the manifest

`inputSchema` is the input model's `model_json_schema(mode="validation")`;
`outputSchema` is the output type's JSON Schema in serialization mode. Per
property they include:

- `type` — derived from the Python type; `X | None` is an `anyOf` with
  `null`.
- `title` — pydantic adds one per field and per model.
- `description` — from `description=` on `Field(...)`, `Argument(...)` or
  `Option(...)`.
- `default` — from the field's default.
- `enum` — from `Literal[...]`, or an `Enum` under `$defs`.
- `format`, `pattern`, `minimum`, `maxLength`, … — from the type
  (`datetime`, `UUID`, …) and the field's constraints.
- `required` array — fields without a default; in `outputSchema` defaulted
  fields too, except `X | None = None` ones.
- `$defs` and `$ref` — nested models and enums.

`inputSchema` describes what `--json` accepts: a defaulted field is optional
there, keys are field names or their aliases, and a field with a
[`parse`](/python/inputs/#parsing-cli-values) shows its own type, since
`parse` applies to CLI strings only. `outputSchema` describes the validated
value the handler's output becomes.

A type pydantic cannot describe — an arbitrary class allowed with
`arbitrary_types_allowed` — makes `--llms` fail with pydantic's
`PydanticInvalidForJsonSchema`. Keep input and output types to what JSON
Schema can express.

Fireargs config attached by `Argument()` / `Option()` (short flags,
env vars, conflicts, …) is **not** part of the JSON Schema in the manifest —
it's CLI-only and irrelevant to a JSON-mode call.

## Dates

Pydantic reads and writes `datetime`, `date` and `time` as ISO 8601 strings
and documents them with `format: date-time`, `date` or `time`, so a date
round-trips through `--json` and an agent learns the wire format from the
manifest. See [Outputs](/python/outputs/#serialization) for the other rich
types.
