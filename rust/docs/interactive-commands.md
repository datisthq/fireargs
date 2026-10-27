---
title: Interactive commands
path: /rust/interactive-commands/
icon: message-circle-question
order: 10
description: Ask for missing values and confirmations without breaking scripts and agents.
---

# Interactive commands

Fireargs never reads stdin, so the handler is free to prompt the user. The
same command still serves scripts and LLM agents, which cannot answer a
prompt. Keep it working for both with four rules:

- **Optional in the struct.** A prompted field is an `Option<T>`, so a value
  given as a flag or through `--json` skips the prompt.
- **Never in JSON mode.** `context.json` is `true` under `--json`, and an
  agent waiting on JSON would hang on a question.
- **Only on a terminal.** `stdin().is_terminal()` is false in a pipe or CI.
  Fail there with an error that names the flag to pass.
- **Prompts go to stderr.** stdout carries the rendered or JSON output.

## Asking for a missing value

```rust
use std::io::{BufRead, IsTerminal, Write};

#[fireargs::input]
struct InitInput {
    /// Project name; asked for when left out.
    name: Option<String>,
}

#[fireargs::output]
struct InitOutput {
    name: String,
}

fn init() -> fireargs::Command<InitInput, InitOutput> {
    fireargs::command()
        .name("init")
        .description("Create a project.")
        .handler(async |input: InitInput, context| {
            let name = match input.name {
                Some(name) => name,
                None if context.json || !std::io::stdin().is_terminal() => {
                    return Err("--name is required when not run in a terminal".into());
                }
                None => ask_question("Project name")?,
            };
            Ok(InitOutput { name })
        })
        .render(|output, _| format!("Created {}", output.name))
}

fn ask_question(question: &str) -> Result<String, fireargs::Error> {
    eprint!("{question}: ");
    std::io::stderr().flush()?;
    let mut answer = String::new();
    std::io::stdin().lock().read_line(&mut answer)?;
    Ok(answer.trim().to_string())
}

fn main() -> std::process::ExitCode {
    init().run()
}
```

```bash
$ init                              # a terminal: asks
Project name: demo
Created demo
$ init --name demo                  # the flag skips the prompt
Created demo
$ init < /dev/null                  # no terminal: fails, exit code 1
error: --name is required when not run in a terminal
```

`fireargs::Error` is a boxed error, so `?` carries an I/O failure out of the
handler as the same `error: …` line.

## Confirming a destructive action

Give the command a `--yes` flag that answers the confirmation up front, so a
script never has to:

```rust
/// Skip the prompt.
#[fireargs(short = 'y', default)]
yes: bool,

// in the handler
if !input.yes {
    if context.json || !std::io::stdin().is_terminal() {
        return Err("pass --yes to confirm when not run in a terminal".into());
    }
    let answer = ask_question(&format!("Delete {}? [y/N]", input.path))?;
    if !answer.eq_ignore_ascii_case("y") {
        return Ok(DeleteOutput { deleted: false });
    }
}
```

## Richer prompts

For selects, checkboxes or masked passwords, call a prompt crate such as
[dialoguer](https://crates.io/crates/dialoguer) or
[inquire](https://crates.io/crates/inquire) from the handler under the same
rules; both draw on stderr. They block the thread, which is fine under
`.run()`; under `.run_async()` on tokio, wrap the call in
`tokio::task::spawn_blocking`.

## In the manifest

The [`--llms` manifest](/rust/llms-mode/) shows a prompted field as optional,
which is what an agent sees: it passes the value through `--json`, or gets the
error. Say in the field's doc comment that it is asked for when left out, so a
person reading `--help` knows too.
