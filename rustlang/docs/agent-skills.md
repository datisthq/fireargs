---
title: Agent Skills
description: Teach your coding agent to write commands, build programs and drive Fireargs CLIs in Rust.
path: /rust/agent-skills/
icon: sparkles
order: 2
---

# Agent Skills

Fireargs ships [Agent Skills](https://agentskills.io/) that tell coding agents such as Claude Code, Cursor and Codex how a Fireargs CLI works. Once installed, your agent knows how serde fields become arguments and options, how to wire a subcommand tree and how to drive a CLI through `--json` and `--llms`. You don't have to explain any of it in the prompt.

| Skill                      | Your agent uses it when                                                         |
| -------------------------- | ------------------------------------------------------------------------------- |
| `fireargs-rust-commands`   | writing a command: input struct, output type, arguments, options and its config |
| `fireargs-rust-programs`   | building a subcommand tree and sharing parameters and commands across it        |
| `fireargs-rust-automation` | driving a CLI through `--json` and `--llms`, testing it and handling errors     |

## Install from the website

fireargs.dev publishes its skills under `/.well-known/agent-skills/`, so the [`skills` CLI](https://github.com/vercel-labs/skills) can install them from the site URL. Run this at your project root:

```bash
npx skills add https://fireargs.dev
```

It asks which skills and agents to install for; the site also serves the TypeScript and Python skills, so pick the `fireargs-rust-*` ones. To skip the prompts, pass them as flags:

```bash
npx skills add https://fireargs.dev --skill fireargs-rust-commands --agent claude-code
```

Add `--global` to install for your user instead of the project, and `--list` to see what's available without installing anything. Run `npx skills update` later to pull newer versions.

## Install from the package

The skills also ship inside the crate, at `skills/` in its source directory under Cargo's registry. Installing them from there keeps them matched to the Fireargs version in your `Cargo.lock`, while the website always serves the latest release:

```bash
manifest=$(cargo metadata --format-version 1 \
  | jq -r '.packages[] | select(.name == "fireargs") | .manifest_path')
npx skills add "$(dirname "$manifest")/skills"
```

Run it from your crate's directory; `cargo metadata` downloads the crate first when needed.

## Use them

You don't need to invoke a skill yourself. Agents read each skill's description and load it when a task matches. For example, asking for a new `deploy` command loads `fireargs-rust-commands`, and asking to group commands under a `db` subcommand loads `fireargs-rust-programs`. If your agent supports invoking skills by name, you can also call one directly, as with `/fireargs-rust-automation` in Claude Code.

## See also

- [LLMs mode](/rust/llms-mode/) — the `--llms` manifest an agent reads at runtime, rather than while writing code.
