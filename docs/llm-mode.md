---
title: LLM mode
path: /llm-mode/
icon: bot
order: 5
description: Built-in --json and --llms flags for programmatic and LLM tool-use.
---

# LLM mode

Every fireargs command (and program) ships with two extra built-in flags:

- **`--json`** — drive the command with structured JSON instead of CLI
  args/options, and/or get its output as JSON on stdout.
- **`--llms`** — print an MCP-`tools/list`-shaped manifest describing the
  command (or every command in a program tree). Designed for an LLM agent
  to read once, then invoke with `--json`.

Both are on by default. Disable per-command via `jsonOption: false` /
`llmsOption: false` in the config; customize the flag string or description
by passing `{ flags?, description? }` instead of `false`.

## `--json [value]`

Three modes depending on whether you pass a value:

```bash
greet world                              # CLI in, no output  (current behavior)
greet world --json                       # CLI in, JSON out
greet --json '{"name":"world"}'          # JSON in, JSON out
```

When `--json` carries a JSON string value, fireargs:

1. `JSON.parse`'s the value.
2. Validates it through the input zod schema.
3. Calls the handler with the parsed input.
4. Validates the return through the output schema.
5. Writes `JSON.stringify(result, null, 2) + "\n"` to commander's
   `writeOut` (so `configureOutput.writeOut` can intercept).

When `--json` is passed alone (no value), step 1 is skipped — input comes
from the regular CLI parse — and the output is still JSON.

## `--llms`

Prints a manifest matching MCP's `tools/list` response shape:

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

The first entry is always a reserved `help` tool whose `description` carries
the calling convention. MCP descriptions are first-class and always
surfaced to the model, so this is the most reliable place to put guidance.
The schemas are empty so accidental invocation is a no-op.

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
- `required` array — derived from non-`optional` / non-`default` fields.

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
- `z.date()`'s schema is _unrepresentable_ in JSON Schema — Zod throws
  by default. Tracked in
  [issue #1](https://github.com/datisthq/fireargs/issues/1); workaround for
  now is to use `z.iso.datetime()` for any Date you want to expose via
  `--llms`.
