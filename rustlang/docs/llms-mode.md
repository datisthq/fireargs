---
title: LLMs mode
path: /rust/llms-mode/
icon: bot
order: 7
description: --llms publishes an MCP-shaped tools manifest for agentic use.
---

# LLMs mode

`--llms` prints a manifest describing every tool reachable through this
program, in the shape of MCP's [`tools/list`](https://modelcontextprotocol.io/)
response. An LLM agent reads the manifest once and then calls back through
[`--json`](/rust/json-mode/) to actually invoke a tool.

Enabled by default on every command and program. Disable per command or
program with `.llms_option(FlagConfig::Disabled)`, or rename the flag and its
help with `FlagConfig::Custom { long, description }`.

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
      "description": "Greet someone politely",
      "inputSchema":  { "type": "object", "properties": { "name": { "type": "string", "description": "user's name" }, ... }, "required": ["name"], "$schema": "https://json-schema.org/draft/2020-12/schema" },
      "outputSchema": { "type": "object", "properties": { "greeting": { "type": "string" } }, "required": ["greeting"], "$schema": "https://json-schema.org/draft/2020-12/schema" }
    }
  ]
}
```

MCP requires a tool's `outputSchema` to describe an object. A command with a
`Vec` or scalar output still gets a valid JSON Schema here, but an MCP client
that validates strictly will reject it: return a struct from a CLI meant to
be served over MCP.

The manifest types are exported as `fireargs::Manifest` and
`fireargs::Tool`.

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

## What flows from schemars into the manifest

`inputSchema` is the input struct's JSON Schema as schemars generates it for
deserialization; `outputSchema` is the output type's for serialization. Both
are draft 2020-12, with subschemas inlined. Per property they include:

- `type` — derived from the Rust type; `Option<T>` adds `"null"` to it.
- `description` — from the field's doc comment.
- `default` — from `#[fireargs(default)]`, `default = expr`, or a reusable type's
  `default`.
- `enum` — from a unit enum, after its `rename_all`.
- `format`, `pattern`, `minimum`, `maxLength`, … — from the type (`u32`
  gives `format: uint32` and `minimum: 0`) and the field's validation keys.
- `required` array — in `inputSchema`, fields without a default that are
  not `Option<T>`; in `outputSchema`, every field serde always writes.

`inputSchema` describes what `--json` accepts: a defaulted field is optional
there, keys are the camelCase wire keys (or a `rename_all`'s), and a field with a
[`parse`](/rust/inputs/#parsing-cli-values) shows its own type, since
`parse` applies to CLI strings only. `outputSchema` describes the value the
handler's output serializes to. The root schema's Rust type name (`title`)
is dropped.

The CLI config (short flags, env vars, conflicts, …) is **not** part
of the JSON Schema in the manifest — it's CLI-only and irrelevant to a
JSON-mode call, so fireargs strips it.

## Dates

With schemars' `chrono04` feature, a `chrono::DateTime` is documented as a
string with `format: date-time` and serde reads and writes it as RFC 3339, so
a date round-trips through `--json` and an agent learns the wire format from
the manifest. See [Outputs](/rust/outputs/#serialization) for the other rich
types.
