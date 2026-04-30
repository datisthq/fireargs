# Fireargs

Build CLIs from zod schemas. Fireargs is a thin layer over
[commander](https://github.com/tj/commander.js): you describe each command
with a zod input/output schema and a handler, and fireargs hands you a
fully-wired commander `Command` — with `--help`, `--json` for programmatic
calls, and `--llms` for LLM tool-use baked in.

## Install

```bash
pnpm add fireargs zod commander
# or
npm install fireargs zod commander
```

## A first command

```ts title="greet.ts"
import { f } from "fireargs"
import { z } from "zod"

const greet = f
  .command({ name: "greet", description: "Greet someone politely." })
  .input(
    z.object({
      name: f.argument().string().describe("The user's name."),
      times: z.number().default(1).describe("Repeat the greeting n times."),
      verbose: f.option({ short: "v" }).boolean(),
    }),
  )
  .output(z.object({ greeting: z.string() }))
  .handler(input => ({
    greeting: `hello ${input.name}`.repeat(input.times),
  }))

greet.parseAsync(process.argv)
```

That gets you:

```bash
$ greet world --times 3
$ greet world --json                 # CLI input, JSON output
$ greet --json '{"name":"world"}'    # JSON input, JSON output
$ greet --llms                       # MCP-shaped manifest for LLMs
$ greet --help
```

## Subcommand trees

Group leaves with `f.program(...).commands({ ... })`:

```ts
const cli = f
  .program({ name: "myapp", description: "My CLI", version: "1.0.0" })
  .commands({ greet, deploy, db: dbCli })

cli.parseAsync(process.argv)
```

Programs nest — `commands` accepts other programs the same way it accepts
leaves. `myapp db migrate --json '...'` routes through both levels.

## LLM tool-use

Every command and program ships with `--llms`, which prints an
MCP-`tools/list`-shaped manifest:

```json
{
  "tools": [
    { "name": "help", "description": "Documentation tool, not callable. ...", "inputSchema": {}, "outputSchema": {} },
    { "name": "greet",      "description": "...", "inputSchema": { ... }, "outputSchema": { ... } },
    { "name": "db migrate", "description": "...", "inputSchema": { ... }, "outputSchema": { ... } }
  ]
}
```

An LLM agent reads the manifest, picks a tool, and invokes it with
`<binary> <name> --json '<value>'`. Output comes back as JSON on stdout.

## Documentation

- [Commands](/commands/) — the `f.command(...)` chainable builder.
- [Inputs](/inputs/) — `f.argument()` / `f.option()` and per-field commander config.
- [Programs](/programs/) — subcommand trees, nesting, and program-level config.
- [JSON mode](/json-mode/) — `--json` for programmatic and pipeline use.
- [LLMs mode](/llms-mode/) — `--llms` and the MCP-shaped manifest.
- [Contributing](/contributing/) — local setup, conventions, release flow.

## License

MIT.
