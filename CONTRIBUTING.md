# Contributing

Fireargs is an open-source project and we'd love your help — whether that's fixing a bug, polishing the docs, or proposing a new feature. This guide walks through everything you need to get a change from your editor into a release.

## Quick start

You'll need [Node.js](https://nodejs.org/) 24+, [pnpm](https://pnpm.io/) 11+, for the Python package [uv](https://docs.astral.sh/uv/), and for the Rust package [rustup](https://rustup.rs/). Then:

```bash
git clone https://github.com/datisthq/fireargs.git
cd fireargs
pnpm install
pnpm start
```

`pnpm install` also syncs the Python environment when `uv` is on your `PATH` and fetches the Rust crates when `cargo` is. `pnpm start` boots the docs dev server so you can iterate on the site. To exercise every package:

```bash
pnpm test
```

## Repository layout

```
fireargs/
├── typescript/          # the npm package `fireargs`
│   ├── actions/         #   noun/verb action modules
│   │   ├── argument/    #     createArgument — tag fields as positional with per-field config
│   │   ├── command/     #     compileCommand, leaf builder, manifest builder
│   │   ├── field/       #     shared field-builder, meta read/write helpers
│   │   ├── option/      #     createOption — tag fields as --flags with per-field config
│   │   └── program/     #     compileProgram — wire subcommand trees
│   ├── models/          #   typed records: CommandConfig, ProgramConfig, ArgumentConfig, OptionConfig
│   ├── docs/            #   the TypeScript pages of the docs site (Markdown)
│   ├── skills/          #   shipped agent skills for people who use Fireargs (see AGENTS.md)
│   ├── index.ts         #   public API — exports the `f` namespace
│   ├── settings.ts      #   tunables (FIREARGS_META_KEY)
│   └── vite.config.ts   #   the package's test config
├── python/              # the PyPI package `fireargs`, a uv project
│   ├── fireargs/        #   the twin of typescript/: actions/, models/, __init__.py
│   ├── docs/            #   the Python pages of the docs site
│   └── skills/          #   shipped agent skills for Python users
├── rustlang/            # the crates.io package `fireargs`, a cargo project
│   ├── src/             #   the twin of typescript/: actions/, models/, lib.rs
│   ├── tests/           #   integration tests and the testsuite runner
│   ├── docs/            #   the Rust pages of the docs site
│   └── skills/          #   shipped agent skills for Rust users
├── testsuite/           # language-neutral cases every package must pass
├── .agents/skills/      # repo skills for coding agents (see AGENTS.md)
├── .livemark/           # docs-site escapes (theme, landing, screenshots)
├── .scripts/            # repo-wide guards and the `pnpm squash` script
├── livemark.config.ts   # config for the docs site
├── tsconfig.json
└── vite.config.ts       # vite-plus shared config (format, lint, the guards' tests)
```

The npm package ships `typescript/build/` (compiled by `tsgo`) and `typescript/skills/`; the PyPI package ships `python/fireargs/` and `python/skills/`; the crate ships `rustlang/src/` and `rustlang/skills/`. Everything else is for development. A change to shared behaviour lands in every package, with a `testsuite/` case.

## Local commands

Run these at the repo root; each chains into the language sections with `pnpm -C <section>`.

| Command            | What it does                                                             |
| ------------------ | ------------------------------------------------------------------------ |
| `pnpm install`     | Install dependencies                                                     |
| `pnpm build`       | Build `typescript/build/`, the Python wheel and the `.crate` package     |
| `pnpm check:types` | Type-check via `tsgo --noEmit`, `ty check` and `cargo check`             |
| `pnpm check:lint`  | Format check + lint (`vp fmt`, `vp lint`, `ruff`, `cargo fmt`, `clippy`) |
| `pnpm check`       | `pnpm check:lint && pnpm check:types`                                    |
| `pnpm format`      | Auto-fix formatting (`vp fmt`, `ruff format`, `cargo fmt`)               |
| `pnpm test:unit`   | Run the repo guards and every package's unit tests and testsuite         |
| `pnpm test`        | `pnpm check && pnpm test:unit`                                           |
| `pnpm start`       | Run the docs dev server                                                  |
| `pnpm build:docs`  | Production build of the docs site                                        |
| `pnpm scan`        | Secret and vulnerability scans (gitleaks, semgrep)                       |

A change is ready to push when `pnpm test` is green.

## Code conventions

- **TypeScript**: strict mode is on. Don't use `any`, `as`-casts, or non-null `!` without permission — flag it in the PR.
- **Imports**: use full ESM paths with the `.ts(x)` extension (`from "./foo.ts"`). `tsgo` rewrites them to `.js` on emit via `rewriteRelativeImportExtensions`.
- **Comments**: docstrings on exports only. Skip narrative `//` comments inside function bodies.
- **File layout**: high-level public items at the top, private helpers at the bottom.
- **Tests**: unit tests live next to the code as `<module>.unit.ts`; run one from `typescript/` with `vp test <file>`. No "Arrange/Act/Assert" comments — the structure should be obvious.
- **Formatting**: vite-plus via `pnpm format`. 2-space indent, no semicolons, double quotes (LF, UTF-8).
- **Python**: 3.12+, typed for `ty` without `Any`; tests beside the module as `<module>_unit.py`, run one with `uv run pytest <file>` from `python/`.
- **Rust**: edition 2024 on the pinned stable toolchain, clippy-clean with no `unwrap`/`expect` in library code; unit tests beside the module as `<module>_unit.rs`, run one with `cargo test <name>` from `rustlang/`.

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

Releases are driven by [release-please](https://github.com/googleapis/release-please): a `feat` or `fix` landing on `main` opens a Release PR, and merging it cuts the version, tags it and publishes to npm, PyPI and crates.io. Each package has its own version. Maintainers don't bump versions manually.

## Where to find help

- **Bugs and feature requests**: [GitHub Issues](https://github.com/datisthq/fireargs/issues)
- **Discussion / ideas**: [GitHub Discussions](https://github.com/datisthq/fireargs/discussions)
- **Source**: [github.com/datisthq/fireargs](https://github.com/datisthq/fireargs)

Thanks for helping make Fireargs better.
