# Agents

This file provides guidance to coding agents when working with code in this repository.

## General

- **Never commit unless asked to**
- **Never add co-authored by Claude Code to commits!**
- **Never push main or pull requests to origin unless asked to**
- Prioritize using LSP capabilities if possible
- When resolving a TODO, follow its instructions literally
- Run type checking as part of your tasks
- Run specs as part of your tasks
- Run linting as part of your tasks
- Start plan from a summary a new/updated API summary (models/signatures) and most challenging points, continue plan using your default settings

## Skills

Depth lives in `skills/` (reached by Claude Code through the `.claude/skills` symlink), so
this file carries invariants and the skills carry procedure. Reach for one before working in
its area:

| skill            | when                                                          |
| ---------------- | ------------------------------------------------------------- |
| `review-changes` | reviewing a pull request — also what the review workflow runs |

## Commands

- Run `pnpm install` to install all dependencies
- Run `pnpm lint` to lint the code using Biome
- Run `pnpm format` to auto-fix formatting issues with Biome
- Run `pnpm type` to check TypeScript types
- Run `pnpm unit` to run only the Vitest tests
- Run `pnpm exec vitest run path/to/test.ts` to run a single test

## Formats

- Use 2-space indentation, UTF-8 encoding, and LF line endings
- Use PascalCase for classes and interfaces, and camelCase for methods and variables
- Place high-level public items first in a file and low-level private items last
- Use ES modules with full import paths including the ".ts(x)" file extension

## Types

- Use strict TypeScript with null checks but don't add explicit return types to functions
- Never use TypeScript `any`, type casting `as`, or `!` without permission

## Specs

- Place unit tests in `<module>.unit.ts` files and don't add useless comments like "Arrange", "Act", "Assert"

## Releases

Conventional Commits drive [release-please](https://github.com/googleapis/release-please): a
`feat` or `fix` landing on `main` opens a Release PR, and merging that PR cuts the version,
tags it and publishes. Merging is the gate — nothing ships without it.

- **IMPORTANT: only changes to the published package use `feat` or `fix`.** Everything else MUST be
  `chore` or `docs` — CI and workflows, release config, dependencies, tooling, `AGENTS.md`,
  the README, the docs site
- This is not a style preference. release-please reads the commit type: a `fix:` on a workflow
  file cuts a release and burns a version number on a change no consumer can observe. Version
  numbers can never be reused
- When in doubt, ask whether the change alters what someone installing the package gets.
  If it does not, it is `chore`
- Release config lives in `.release/config.json` and `.release/manifest.json`. The manifest
  holds the current version and release-please maintains it — never hand-edit it

## Docs

- Add Typedoc comments only for public APIs and don't add them for files or use @params directives
- Add brief docstrings for exporter functions and models (explain what it does)
- Don't write `//` comments in the code
