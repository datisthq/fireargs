---
title: Interactive commands
path: /typescript/interactive-commands/
icon: message-circle-question
order: 10
description: Ask for missing values and confirmations without breaking scripts and agents.
---

# Interactive commands

Fireargs never reads stdin, so the handler is free to prompt the user. The
same command still serves scripts and LLM agents, which cannot answer a
prompt. Keep it working for both with four rules:

- **Optional in the schema.** A prompted field is `.optional()`, so a value
  given as a flag or through `--json` skips the prompt.
- **Never in JSON mode.** `context.json` is `true` under `--json`, and an
  agent waiting on JSON would hang on a question.
- **Only on a terminal.** `process.stdin.isTTY` is false in a pipe or CI.
  Fail there with an error that names the flag to pass.
- **Prompts go to stderr.** stdout carries the rendered or JSON output.

## Asking for a missing value

```ts
import { createInterface } from "node:readline/promises"
import { f } from "fireargs"
import { z } from "zod"

const name = f.option().schema(z.string().optional().describe("Asked for when left out."))

const init = f
  .command({
    name: "init",
    description: "Create a project.",
    renderError: error => `error: ${error instanceof Error ? error.message : error}`,
  })
  .input(z.object({ name }))
  .output(z.object({ name: z.string() }))
  .render(output => `Created ${output.name}`)
  .handler(async (input, context) => {
    let name = input.name
    if (name === undefined) {
      if (context.json || !process.stdin.isTTY) {
        throw new Error("--name is required when not run in a terminal")
      }
      name = await askQuestion("Project name")
    }
    return { name }
  })

async function askQuestion(question: string) {
  const readline = createInterface({ input: process.stdin, output: process.stderr })
  const answer = await readline.question(`${question}: `)
  readline.close()
  return answer.trim()
}

init.parseAsync(process.argv)
```

```bash
$ node init.ts                      # a terminal: asks
Project name: demo
Created demo
$ node init.ts --name demo          # the flag skips the prompt
Created demo
$ node init.ts < /dev/null          # no terminal: fails, exit code 1
error: --name is required when not run in a terminal
```

The handler is async, so it can `await` the answer. `renderError` turns the
thrown error into an `error: …` line instead of a stack trace — see
[JSON mode](/typescript/json-mode/) for its JSON-aware form.

## Confirming a destructive action

Give the command a `--yes` flag that answers the confirmation up front, so a
script never has to:

```ts
const yes = f.option({ short: "y" }).schema(z.boolean().default(false).describe("Skip the prompt."))

// in the handler
if (!input.yes) {
  if (context.json || !process.stdin.isTTY) {
    throw new Error("pass --yes to confirm when not run in a terminal")
  }
  const answer = await askQuestion(`Delete ${input.path}? [y/N]`)
  if (answer.toLowerCase() !== "y") return { deleted: false }
}
```

## Richer prompts

`node:readline` covers plain questions. For selects, checkboxes or masked
passwords, call a prompt library such as
[`@inquirer/prompts`](https://www.npmjs.com/package/@inquirer/prompts) from the
handler under the same rules; most of them take an `output` stream, which
should be `process.stderr`.

## In the manifest

The [`--llms` manifest](/typescript/llms-mode/) shows a prompted field as
optional, which is what an agent sees: it passes the value through `--json`,
or gets the error. Say in the field's `.describe(...)` that it is asked for
when left out, so a person reading `--help` knows too.
