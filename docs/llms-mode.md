---
title: LLMs mode
path: /llms-mode/
icon: bot
order: 8
description: --llms publishes an MCP-shaped tools manifest for agentic use.
---

# LLMs mode

`--llms` prints a manifest describing every tool reachable through this
binary, in the shape of MCP's [`tools/list`](https://modelcontextprotocol.io/)
response. An LLM agent reads the manifest once and then calls back through
[`--json`](/json-mode/) to actually invoke a tool.

Enabled by default on every command and program. Disable per-command via
`llmsOption: false`, or customize the flag string/description with
`llmsOption: { flags?, description? }`.

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
      "inputSchema":  { "type": "object", "properties": { "name": { "type": "string", "description": "user's name" }, ... }, "required": ["name", ...] },
      "outputSchema": { "type": "object", "properties": { "greeting": { "type": "string" } }, "required": ["greeting"] }
    }
  ]
}
```

MCP requires a tool's `outputSchema` to describe an object. A command with an
array or scalar output still gets a valid JSON Schema here, but an MCP client
that validates strictly will reject it: use `z.object(...)` outputs for a CLI
meant to be served over MCP.

## The reserved `help` tool

The first entry is always a `help` tool whose `description` carries the
calling convention. MCP descriptions are first-class and always surfaced to
the model, so this is the most reliable place to put guidance. Its schemas
are empty so an accidental invocation is a no-op.

## How it composes for programs

The same shape comes back from `f.program(...)`'s `--llms`. Each leaf in
the tree becomes a `Tool` whose `name` is the space-separated path:

```bash
myapp api greet --json '{"name":"world"}'
```

⇒ `tools[]` entry with `"name": "api greet"`. Nested programs flatten the
same way — `myapp db migrate` becomes `"db migrate"`.

## Why MCP shape

[MCP](https://modelcontextprotocol.io/) is the standard for exposing tools
to LLMs. Matching its `tools/list` shape means an MCP-aware client can
consume a fireargs CLI's `--llms` output directly, and the JSON Schemas
inside follow JSON Schema Draft 2020-12 — what every LLM tool-use
framework (Anthropic SDK, OpenAI function calling, …) already understands.

## What flows from zod into the manifest

Per-property fields in `inputSchema` / `outputSchema` are emitted by Zod's
`z.toJSONSchema(...)` and include:

- `type` — derived from the zod constructor.
- `description` — from `.describe(...)` and any `.meta({ description })`.
- `default` — from `.default(...)`.
- `enum` — from `z.enum([...])`.
- `format`, `pattern`, etc. — from `z.iso.datetime()` and friends.
- `required` array — non-`optional` fields; in `inputSchema` a defaulted
  field is not required either.

`inputSchema` describes what `--json` accepts — the input side of each zod
schema. A defaulted field is optional there, a `.transform()` field shows
its pre-transform type, and a field with a [`parse`](/inputs/#parsing-cli-values)
shows its schema type, since `parse` applies to CLI strings only.
`outputSchema` describes the validated value the handler's output becomes.

A zod type that JSON Schema cannot express — `z.date()`, the result of an
output `.transform()` — is written as `{}` (any value) rather than failing
the whole manifest.

Fireargs metadata attached by `f.argument()` / `f.option()` (short flags,
env, conflicts, …) is **stripped** from the JSON Schema in the manifest —
it's CLI-only and irrelevant to a JSON-mode call.

## Round-trip caveat for `Date`

`JSON.stringify(new Date())` emits an ISO 8601 string via
`Date.prototype.toJSON()`, so a handler returning a `Date` serializes
correctly on the wire. The opposite direction is trickier:

- `z.date()` rejects an ISO string at parse time. For round-trip via
  `--json`, accept the wire format with `z.iso.datetime()` (validated
  ISO string passed through) or `z.coerce.date()` (string → `Date`).
- `z.date()`'s schema is _unrepresentable_ in JSON Schema, so the manifest
  shows it as `{}` and an agent learns nothing about it. Use
  `z.iso.datetime()` for any Date you want to expose via `--llms`.
