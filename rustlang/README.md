# Fireargs

Define each command with typed input and output structs. Get composability, structured JSON I/O, and LLM-ready manifests baked in — for humans, agents, and scripts alike. Built on serde, schemars and clap; Rust 1.88+, edition 2024.

## Installation

```bash
cargo add fireargs
cargo add serde --features derive
cargo add schemars
```

## A first command

`f::command(config)` opens a builder: `.input::<I>()` takes the input struct, `.output::<O>()` the output type and `.handler(...)` the async function between them. Fields become arguments and options; a `#[schemars(extend("fireargs" = {...}))]` attribute carries the CLI config serde and schemars do not model. Import the module as `f` (`use fireargs as f;`), as here, or the names you use.

```rust title="greet.rs"
use std::process::ExitCode;

use fireargs::{self as f, CommandConfig, Error};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

// Typed input: doc comments, defaults and bounds become arguments and options
#[derive(Deserialize, JsonSchema)]
struct GreetInput {
    /// The user's name.
    #[schemars(extend("fireargs" = {"kind": "argument"}))]
    name: String,
    /// Repeat it n times.
    #[serde(default = "one")]
    #[schemars(range(min = 1))]
    times: u32,
    /// Use capitals.
    #[serde(default)]
    #[schemars(extend("fireargs" = {"kind": "option", "short": "s"}))]
    shout: bool,
}

fn one() -> u32 {
    1
}

// Typed output, validated on every run
#[derive(Serialize, JsonSchema)]
struct Greeting {
    greeting: String,
}

fn main() -> ExitCode {
    let config = CommandConfig {
        name: Some("greet".into()),
        description: Some("Greet someone politely.".into()),
        ..Default::default()
    };
    // A clap command, typed from the input and output structs
    let greet = f::command(config)
        .input::<GreetInput>()
        .output::<Greeting>()
        // Output for humans; --json prints the data instead
        .render(|output, _| Some(output.greeting.clone()))
        .handler(|input, _| async move {
            let words = vec![format!("hello {}", input.name); input.times as usize];
            let mut greeting = words.join(" ");
            if input.shout {
                greeting = greeting.to_uppercase();
            }
            Ok::<_, Error>(Greeting { greeting })
        });
    // Parse argv, run the handler and return the exit code
    greet.run()
}
```

That gets you:

```bash
$ greet world --times 2 -s        # CLI input, rendered output
HELLO WORLD HELLO WORLD
$ greet world --json              # CLI input, JSON output
{
  "greeting": "hello world"
}
$ greet --json '{"name":"world","times":2}'   # JSON input, JSON output
{
  "greeting": "hello world hello world"
}
$ greet world --times 0
error: option '--times <value>' argument '0' is invalid. 0 is less than the minimum of 1
```

`--help` comes from clap:

```text
Greet someone politely.

Usage: greet [OPTIONS] [name]

Arguments:
  [name]
          The user's name.

Options:
      --times <value>
          Repeat it n times. (default: 1)

  -s, --shout
          Use capitals. (default: false)

      --json [<value>]
          write output as JSON; pass a JSON string to also drive input

      --llms
          print this command's schema (name, input, output) as JSON for LLM tool-use

  -h, --help
          Print help (see a summary with '-h')
```

## A first program

Group leaves with `f::program(config).router([...])`:

```rust
// Composable commands: a router of leaves and nested programs
let cli = f::program(ProgramConfig {
    name: Some("myapp".into()),
    description: Some("My CLI".into()),
    version: Some("1.0.0".into()),
    ..Default::default()
})
.router([("greet", greet.into()), ("deploy", deploy.into()), ("db", db.into())]);

// Parse argv, run the selected leaf and return the exit code
cli.run()
```

That gives:

```bash
$ myapp --help
My CLI

Usage: myapp [OPTIONS] [COMMAND]

Commands:
  greet   Greet someone politely.
  deploy  Deploy the current build.
  db      Database tasks.
  help    Print this message or the help of the given subcommand(s)

Options:
      --llms
          print the program manifest (subcommand schemas) as JSON for LLM tool-use

  -h, --help
          Print help (see a summary with '-h')

  -V, --version
          Print version

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
$ greet world --times 2 --json        # CLI input, JSON output
{
  "greeting": "hello world hello world"
}
$ greet --json '{"name":"world","times":3,"shout":true}'   # JSON input, JSON output
{
  "greeting": "HELLO WORLD HELLO WORLD HELLO WORLD"
}
$ greet world --json | jq -r .greeting   # pipe it into other tools
hello world
$ greet --json '{"times":2}'           # input errors go to stderr, exit code 1
error: invalid --json input at 'name': "name" is a required property
$ greet --json '{"name":"world","times":"2"}'
error: invalid --json input at 'times': "2" is not of type "integer"
```

stdout only ever carries the data, so a script can parse it without checking for noise.

## LLMs mode

Every command and program ships with `--llms`, which prints an
MCP-`tools/list`-shaped manifest. For `greet.rs` above:

```json
{
  "tools": [
    {
      "name": "help",
      "description": "Documentation tool, not callable. Each `tools[].name` is the space-separated path beneath this binary. Invoke a tool with `<binary> <name> --json '<value>'` matching that tool's `inputSchema`; output is JSON on stdout matching `outputSchema`.",
      "inputSchema": { "type": "object", "properties": {} },
      "outputSchema": { "type": "object", "properties": {} }
    },
    {
      "name": "greet",
      "description": "Greet someone politely.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "description": "The user's name."
          },
          "times": {
            "type": "integer",
            "format": "uint32",
            "minimum": 1,
            "description": "Repeat it n times.",
            "default": 1
          },
          "shout": {
            "type": "boolean",
            "description": "Use capitals.",
            "default": false
          }
        },
        "required": ["name"],
        "$schema": "https://json-schema.org/draft/2020-12/schema"
      },
      "outputSchema": {
        "type": "object",
        "properties": { "greeting": { "type": "string" } },
        "required": ["greeting"],
        "$schema": "https://json-schema.org/draft/2020-12/schema"
      }
    }
  ]
}
```

An LLM agent reads the manifest, picks a tool, and invokes it with
`<binary> <name> --json '<value>'`. Output comes back as JSON on stdout.

## Learn more

- [Commands](/rust/commands/) — the `f::command(...)` builder and the leaf it builds.
- [Inputs](/rust/inputs/) — the input struct and per-field CLI config in `#[schemars(extend(...))]`.
- [Outputs](/rust/outputs/) — the output type, serialization, and JSON Schema in `--llms`.
- [Programs](/rust/programs/) — subcommand trees, nesting, and program-level config.
- [JSON mode](/rust/json-mode/) — `--json` for programmatic and pipeline use.
- [LLMs mode](/rust/llms-mode/) — `--llms` and the MCP-shaped manifest.
- [Composability](/rust/composability/) — share common params across commands by composing structs.
- [Agent Skills](/rust/agent-skills/) — teach your coding agent to write and drive Fireargs CLIs.
- [Contributing](/rust/contributing/) — local setup, conventions, release flow.

## License

MIT.
