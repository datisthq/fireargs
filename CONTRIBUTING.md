# Contributing

Fireargs is an open-source project and we'd love your help — whether that's fixing a bug, polishing the docs, or proposing a new feature. This guide walks through everything you need to get a change from your editor into a release.

## Quick start

You'll need [Node.js](https://nodejs.org/) 24+ and [pnpm](https://pnpm.io/) 10+. Then:

```bash
git clone https://github.com/datisthq/fireargs.git
cd fireargs
pnpm install
pnpm start
```

`pnpm start` boots the docs dev server so you can iterate on the site. To exercise the library itself:

```bash
pnpm test
```

## Repository layout

```
fireargs/
├── actions/           # noun/verb action modules
│   ├── argument/      #   createArgument — tag fields as positional with per-field config
│   ├── command/       #   compileCommand, leaf builder, manifest builder
│   ├── field/         #   shared field-builder, meta read/write helpers
│   ├── option/        #   createOption — tag fields as --flags with per-field config
│   └── program/       #   compileProgram — wire subcommand trees
├── docs/              # docs-site content (Markdown)
├── .livemark/         # docs-site escapes (theme, landing, screenshots)
├── models/            # typed records: CommandConfig, ProgramConfig, ArgumentConfig, OptionConfig
├── index.ts           # public API — exports the `f` namespace
├── settings.ts        # tunables (FIREARGS_META_KEY)
├── .agents/skills/    # repo skills for coding agents (see AGENTS.md)
├── skills/           # agent skills for people who use Fireargs (see AGENTS.md)
├── scripts/          # repo-wide guards and the `pnpm squash` script
├── livemark.config.ts # config for the docs site
├── tsconfig.json
└── vite.config.ts     # vite-plus shared config (lint, format, test)
```

The package ships only `build/` (compiled by `tsgo`). Everything else is for development.

## Local commands

| Command            | What it does                                         |
| ------------------ | ---------------------------------------------------- |
| `pnpm install`     | Install dependencies                                 |
| `pnpm build`       | Compile `actions/`, `models/`, `index.ts` → `build/` |
| `pnpm check:types` | Type-check via `tsgo --noEmit`                       |
| `pnpm check:lint`  | Format check + lint (`vp fmt --check && vp lint`)    |
| `pnpm check`       | `pnpm check:lint && pnpm check:types`                |
| `pnpm format`      | Auto-fix formatting (`vp fmt`)                       |
| `pnpm test:unit`   | Run unit tests (Vitest via `vp test`)                |
| `pnpm test`        | `pnpm check && pnpm test:unit`                       |
| `pnpm start`       | Run the docs dev server                              |
| `pnpm build:docs`  | Production build of the docs site                    |
| `pnpm scan`        | Secret and vulnerability scans (gitleaks, semgrep)   |

A change is ready to push when `pnpm test` is green.

## Code conventions

- **TypeScript**: strict mode is on. Don't use `any`, `as`-casts, or non-null `!` without permission — flag it in the PR.
- **Imports**: use full ESM paths with the `.ts(x)` extension (`from "./foo.ts"`). `tsgo` rewrites them to `.js` on emit via `rewriteRelativeImportExtensions`.
- **Comments**: docstrings on exports only. Skip narrative `//` comments inside function bodies.
- **File layout**: high-level public items at the top, private helpers at the bottom.
- **Tests**: unit tests live next to the code as `<module>.unit.ts`. No "Arrange/Act/Assert" comments — the structure should be obvious.
- **Formatting**: vite-plus via `pnpm format`. 2-space indent, no semicolons, double quotes (LF, UTF-8).

## Proposing a change

1. **Open an issue first** for anything bigger than a typo or a small bug. It's easier to align on direction before code.
2. **Branch from `main`** with a short descriptive name (e.g. `fix-json-default`, `feat-program-hooks`).
3. **Write a focused commit history**. Fireargs uses [Conventional Commits](https://www.conventionalcommits.org/) — the prefix drives release-please:
   - `fix:` — bug fix → patch release
   - `feat:` — new feature → minor release
   - `chore:`, `docs:`, `refactor:`, `test:`, `perf:` — no release
   - Only changes to the published package use `feat` or `fix`; never mark a commit breaking (`!` or a `BREAKING CHANGE:` footer)
4. **Run `pnpm test`** before pushing.
5. **Open a PR** against `main`. Describe the _why_ (link the issue), include CLI output for any UX-visible change, and call out anything reviewers should pay extra attention to.

## Releases

Releases are driven by [release-please](https://github.com/googleapis/release-please): a `feat` or `fix` landing on `main` opens a Release PR, and merging it cuts the version, tags it and publishes to npm. Maintainers don't bump versions manually.

## Where to find help

- **Bugs and feature requests**: [GitHub Issues](https://github.com/datisthq/fireargs/issues)
- **Discussion / ideas**: [GitHub Discussions](https://github.com/datisthq/fireargs/discussions)
- **Source**: [github.com/datisthq/fireargs](https://github.com/datisthq/fireargs)

Thanks for helping make Fireargs better.
