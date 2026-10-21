# Fireargs

Define each command with typed input and output models. Get composability, structured JSON I/O, and LLM-ready manifests baked in — for humans, agents, and scripts alike. Built on pydantic and click; Python 3.12+.

## Install

```bash
pip install fireargs
# or
uv add fireargs
```

## A first command

The handler's first parameter annotation is the input model and its return annotation the output type. Fields become arguments and options; `Argument(...)` and `Option(...)` are pydantic `Field()`s that also carry CLI config. Import the names you use, as here, or the module (`import fireargs as fa`, then `fa.Option(...)`).

```python title="greet.py"
from typing import Annotated
from pydantic import BaseModel
from fireargs import Argument, Option, command


Name = Annotated[str, Argument(description="The user's name.")]
Times = Annotated[
    int, Option(default=1, ge=1, description="Repeat the greeting n times.")
]
Shout = Annotated[bool, Option(short="s", default=False, description="Use capitals.")]


class GreetInput(BaseModel):
    name: Name
    times: Times
    shout: Shout


class Greeting(BaseModel):
    greeting: str


@command(description="Greet someone politely.")
def greet(input: GreetInput) -> Greeting:
    greeting = " ".join([f"hello {input.name}"] * input.times)
    return Greeting(greeting=greeting.upper() if input.shout else greeting)


@greet.render
def render_greeting(output: Greeting) -> str:
    return output.greeting


if __name__ == "__main__":
    greet()
```

That gets you:

```bash
$ python greet.py world --times 2 -s        # CLI input, rendered output
HELLO WORLD HELLO WORLD
$ python greet.py world --json              # CLI input, JSON output
{
  "greeting": "hello world"
}
$ python greet.py --json '{"name":"world","times":2}'   # JSON input, JSON output
{
  "greeting": "hello world hello world"
}
$ python greet.py world --times 0
error: option '--times <value>' argument '0' is invalid. Input should be greater than or equal to 1
```

`--help` comes from click:

```text
Usage: greet.py [OPTIONS] <name>

  Greet someone politely.

Arguments:
  name  The user's name.

Options:
  --times <value>  Repeat the greeting n times.  [default: 1]
  -s, --shout      Use capitals.
  --json [value]   write output as JSON; pass a JSON string to also drive
                   input
  --llms           print this command's schema (name, input, output) as JSON
                   for LLM tool-use
  --help           Show this message and exit.
```

## Subcommand trees

Group leaves with `Program(router={...})`:

```python
cli = Program(
    name="myapp",
    description="My CLI",
    version="1.0.0",
    router={"greet": greet, "deploy": deploy, "db": db},
)

if __name__ == "__main__":
    cli()
```

That gives:

```bash
$ myapp --help
Usage: myapp [OPTIONS] [COMMAND] [ARGS]...

  My CLI

Options:
  -V, --version  output the version number
  --llms         print the program manifest (subcommand schemas) as JSON for
                 LLM tool-use
  --help         Show this message and exit.

Commands:
  greet   Greet someone politely.
  deploy  Deploy the current build.
  db      Database tasks.

$ myapp db migrate --json '{}'
{
  "applied": 0
}
```

Programs nest — `router` accepts other programs the same way it accepts
leaves. `myapp db migrate` routes through both levels.

## LLM tool-use

Every command and program ships with `--llms`, which prints an
MCP-`tools/list`-shaped manifest. For `greet.py` above:

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
      "inputSchema": {
        "properties": {
          "name": {
            "description": "The user's name.",
            "title": "Name",
            "type": "string"
          },
          "times": {
            "default": 1,
            "description": "Repeat the greeting n times.",
            "minimum": 1,
            "title": "Times",
            "type": "integer"
          },
          "shout": {
            "default": false,
            "description": "Use capitals.",
            "title": "Shout",
            "type": "boolean"
          }
        },
        "required": ["name"],
        "title": "GreetInput",
        "type": "object"
      },
      "outputSchema": {
        "properties": { "greeting": { "title": "Greeting", "type": "string" } },
        "required": ["greeting"],
        "title": "Greeting",
        "type": "object"
      },
      "description": "Greet someone politely."
    }
  ]
}
```

An LLM agent reads the manifest, picks a tool, and invokes it with
`<binary> <name> --json '<value>'`. Output comes back as JSON on stdout.

## Learn more

- [Commands](/python/commands/) — the `@command(...)` decorator and the leaf it builds.
- [Inputs](/python/inputs/) — `Argument()` / `Option()` and per-field click config.
- [Outputs](/python/outputs/) — the output type, serialization, and JSON Schema in `--llms`.
- [Programs](/python/programs/) — subcommand trees, nesting, and program-level config.
- [JSON mode](/python/json-mode/) — `--json` for programmatic and pipeline use.
- [LLMs mode](/python/llms-mode/) — `--llms` and the MCP-shaped manifest.
- [Composability](/python/composability/) — share common params across commands by composing pydantic models.
- [Agent Skills](/python/agent-skills/) — teach your coding agent to write and drive Fireargs CLIs.
- [Contributing](/python/contributing/) — local setup, conventions, release flow.

## License

MIT.
