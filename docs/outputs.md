---
title: Outputs
path: /outputs/
icon: arrow-up-from-line
order: 4
description: How the output schema validates handler returns and shapes JSON / LLM responses.
---

# Outputs

`.output(z.object({...}))` defines the shape of whatever the handler
returns. There's no `f.argument()` / `f.option()` equivalent for outputs —
outputs aren't CLI inputs, so commander has no per-field surface to
configure. The schema is pure data shape.

```ts
.output(z.object({
  greeting: z.string(),
  iterations: z.number(),
}))
```

The output schema must be a `z.object(...)`. Returning a primitive (string,
number, etc.) directly isn't supported — wrap it in an object so JSON
output is always navigable by key.

## Where the output schema is used

1. **Validation** — the handler's return value is parsed through the schema
   on every invocation. Type mismatches throw at runtime through
   commander's `parseAsync`. Zod's transforms apply, so
   `z.string().transform(s => s.toUpperCase())` post-processes the return.
2. **`--json` serialization** — when `--json` is set, the validated value
   is serialized via `JSON.stringify(value, null, 2)` and written to
   commander's `writeOut`. See [JSON mode](/json-mode/).
3. **`--llms` manifest** — the schema is run through `z.toJSONSchema(...)`
   and surfaced as the tool's `outputSchema`. See [LLMs mode](/llms-mode/).

## Serialization

`JSON.stringify` does most of the work. Native types that need attention:

| Type                | What `JSON.stringify` does          | Recommendation                                                                   |
| ------------------- | ----------------------------------- | -------------------------------------------------------------------------------- |
| `Date`              | calls `.toJSON()` → ISO 8601 string | use `z.iso.datetime()` to document the wire shape (and accept the same on input) |
| `BigInt`            | throws (`TypeError`)                | use `z.coerce.bigint()` and stringify yourself, or store as string in the schema |
| `Map`/`Set`         | become `{}` / `[]` (lossy)          | model as `z.record(...)` / `z.array(...)`                                        |
| `undefined`         | property dropped                    | use `.optional()` deliberately; `null` if you want presence                      |
| `Function`/`Symbol` | property dropped                    | don't return these from a handler                                                |

If a richer wire format is needed (preserve `Date`/`BigInt` round-trip
faithfully), the right place is _not_ the output schema — it's a
serialization layer like superjson. fireargs deliberately stays plain-JSON
so the wire is consumable by any LLM, shell, or non-fireargs client.

## Round-trip caveat for `Date`

`z.date()` makes round-trip with `--json` awkward and is unrepresentable
in `z.toJSONSchema(...)` (Zod throws). Prefer:

```ts
.output(z.object({
  createdAt: z.iso.datetime(),  // ISO string in, ISO string out
}))
```

…or transform on output:

```ts
.output(z.object({
  createdAt: z.string(),
}))
.handler(() => ({ createdAt: new Date().toISOString() }))
```

Tracked in [issue #1](https://github.com/datisthq/fireargs/issues/1).

## What flows to `--llms`

Per-property, the JSON Schema in the manifest carries:

- `type`, `format`, `pattern` — derived from the zod constructor.
- `description` — from `.describe(...)` and `.meta({ description })`.
- `enum` — from `z.enum([...])`.
- `required` — derived from non-`optional` / non-`default` fields.

There's no CLI-side metadata to strip on outputs — `f.argument()` /
`f.option()` are inputs-only — so every key zod emits passes through.

## Why no separate slots like `f.argument()`/`f.option()`?

Commander's `Command` has no output abstraction. CLI users see whatever
your handler prints (or what `--json` serializes); there's nothing for
fireargs to "wire" beyond running the validation. Keeping outputs as plain
zod schemas matches commander's surface and avoids inventing concepts the
runtime can't honor.
