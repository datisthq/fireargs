# Fireargs

Define each command with typed input and output schemas. Get composability, structured JSON I/O, and LLM-ready manifests baked in — for humans, agents, and scripts alike.

## Install

```bash
pnpm add fireargs
# or
npm install fireargs
```

## A first command

```ts title="greet.ts"
import { f } from "fireargs"
import { z } from "zod"

// Composable arguments and options
const name = f.argument().schema(z.string().describe("The user's name."))
const times = f.option().schema(z.number().min(1).default(1).describe("Repeat it n times."))
const shout = f.option({ short: "s" }).schema(z.boolean().default(false).describe("Use capitals."))

// Composable groups of them
const greetInput = z.object({ name, times, shout })

// Typed output, validated on every run
const greetOutput = z.object({ greeting: z.string() })

// A commander Command, typed from the schemas
const greet = f
  .command({ name: "greet", description: "Greet someone politely." })
  .input(greetInput)
  .output(greetOutput)
  // Output for humans; --json prints the data instead
  .render(output => output.greeting)
  .handler(input => {
    const greeting = Array(input.times).fill(`hello ${input.name}`).join(" ")
    return { greeting: input.shout ? greeting.toUpperCase() : greeting }
  })

// Use as a normal commander command, e.g. configure or apply plugins
greet.parseAsync(process.argv)
```

That gets you:

```bash
$ node greet.ts world --times 2 -s        # CLI input, rendered output
HELLO WORLD HELLO WORLD
$ node greet.ts world --json              # CLI input, JSON output
{
  "greeting": "hello world"
}
$ node greet.ts --json '{"name":"world","times":2}'   # JSON input, JSON output
{
  "greeting": "hello world hello world"
}
$ node greet.ts world --times 0
error: option '--times <value>' argument '0' is invalid. Too small: expected number to be >=1
```

`--help` comes from commander:

```text
Usage: greet [options] <name>

Greet someone politely.

Arguments:
  name             The user's name.

Options:
  --json [value]   write output as JSON; pass a JSON string to also drive input
  --llms           print this command's schema (name, input, output) as JSON for
                   LLM tool-use
  --times <value>  Repeat it n times. (default: 1)
  -s, --shout      Use capitals. (default: false)
  -h, --help       display help for command
```

## A first program

Group leaves with `f.program(...).router({ ... })`:

```ts
// Composable commands: a router of leaves and nested programs
const cli = f
  .program({ name: "myapp", description: "My CLI", version: "1.0.0" })
  .router({ greet, deploy, db: dbCli })

// Use as a normal commander command, e.g. configure or apply plugins
cli.parseAsync(process.argv)
```

That gives:

```bash
$ myapp --help
Usage: myapp [options] [command]

My CLI

Options:
  -V, --version           output the version number
  --llms                  print the program manifest (subcommand schemas) as
                          JSON for LLM tool-use
  -h, --help              display help for command

Commands:
  greet [options] <name>  Greet someone politely.
  deploy [options] <env>  Deploy the current build.
  db [options]            Database tasks.

$ myapp db migrate --json '{}'
{
  "applied": 0
}
```

Programs nest — `router` accepts other programs the same way it accepts
leaves. `myapp db migrate` routes through both levels.

## JSON mode

Every command takes `--json`. Bare, it switches the output to JSON; given a value, that value is
the input, checked against the input schema, so scripts never assemble argv:

```bash
$ node greet.ts world --json | jq -r .greeting
hello world
$ node greet.ts --json '{"name":"world","times":"2"}'
error: invalid --json input at 'times': Invalid input: expected number, received string
```

Input errors go to stderr with exit code 1, so stdout only ever carries the data.

## LLMs mode

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

- [Commands](/typescript/commands/) — the `f.command(...)` chainable builder.
- [Inputs](/typescript/inputs/) — `f.argument()` / `f.option()` and per-field commander config.
- [Outputs](/typescript/outputs/) — the output schema, serialization, and JSON Schema in `--llms`.
- [Programs](/typescript/programs/) — subcommand trees, nesting, and program-level config.
- [JSON mode](/typescript/json-mode/) — `--json` for programmatic and pipeline use.
- [LLMs mode](/typescript/llms-mode/) — `--llms` and the MCP-shaped manifest.
- [Composability](/typescript/composability/) — share common params across commands by composing zod schemas.
- [Contributing](/typescript/contributing/) — local setup, conventions, release flow.

## License

MIT.
