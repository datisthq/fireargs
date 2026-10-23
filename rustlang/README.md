# Fireargs

Define each command with typed input and output structs. Get composability, LLM-ready manifests, and structured JSON I/O baked in — for humans, agents, and scripts alike. Built on serde, schemars and clap; Rust 1.88+, edition 2024.

## Installation

```bash
cargo add fireargs
```

## A first command

Mark the input struct `#[fireargs::input]` and the output struct `#[fireargs::output]`: the macros add the serde and schemars derives, so `fireargs` is the only dependency. Fields become arguments and options, and `#[fireargs(...)]` carries the CLI config serde and schemars do not model. `fireargs::command()` opens a builder; `.handler(...)` takes the async function between the two structs and types the command from its signature.

```rust title="greet.rs"
// Typed input: doc comments, defaults and bounds become arguments and options
#[fireargs::input]
struct GreetInput {
    /// The user's name.
    #[fireargs(argument)]
    name: String,
    /// Repeat it n times.
    #[fireargs(default = 1, range(min = 1))]
    times: u32,
    /// Use capitals.
    #[fireargs(short = 's', default)]
    shout: bool,
}

// Typed output, validated on every run
#[fireargs::output]
struct Greeting {
    greeting: String,
}

// A clap command, typed from the handler's signature
fn greet() -> fireargs::Command<GreetInput, Greeting> {
    fireargs::command()
        .name("greet")
        .description("Greet someone politely.")
        .handler(async |input: GreetInput, _| {
            let words = vec![format!("hello {}", input.name); input.times as usize];
            let mut greeting = words.join(" ");
            if input.shout {
                greeting = greeting.to_uppercase();
            }
            Ok(Greeting { greeting })
        })
        // Output for humans; --json prints the data instead
        .render(|output, _| output.greeting.clone())
}

// Parse argv, run the handler and return the exit code
fn main() -> std::process::ExitCode {
    greet().run()
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

Group leaves with `fireargs::program()`, mounting each under its key:

```rust
// Composable commands: a router of leaves and nested programs
fn cli() -> fireargs::Program {
    fireargs::program()
        .name("myapp")
        .description("My CLI")
        .version("1.0.0")
        .command("greet", greet())
        .command("deploy", deploy())
        .program("db", db())
}

// Parse argv, run the selected leaf and return the exit code
fn main() -> std::process::ExitCode {
    cli().run()
}
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

Programs nest — `.program(...)` mounts one the way `.command(...)` mounts a leaf.
`myapp db migrate` routes through both levels.

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

## Learn more

- [Commands](/rust/commands/) — the `fireargs::command()` builder and the leaf it builds.
- [Inputs](/rust/inputs/) — `#[fireargs::input]` and per-field CLI config in `#[fireargs(...)]`.
- [Outputs](/rust/outputs/) — `#[fireargs::output]`, serialization, and JSON Schema in `--llms`.
- [Programs](/rust/programs/) — subcommand trees, nesting, and program-level config.
- [LLMs mode](/rust/llms-mode/) — `--llms` and the MCP-shaped manifest.
- [JSON mode](/rust/json-mode/) — `--json` for programmatic and pipeline use.
- [Composability](/rust/composability/) — reusable `#[fireargs::value]` types and flattened blocks.
- [Agent Skills](/rust/agent-skills/) — teach your coding agent to write and drive Fireargs CLIs.
- [Contributing](/rust/contributing/) — local setup, conventions, release flow.

## License

MIT.
