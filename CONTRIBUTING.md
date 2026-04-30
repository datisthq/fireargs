# Contributing

Fireargs is an open-source project and we'd love your help — whether that's fixing a bug, polishing the docs, or proposing a new feature. This guide walks through everything you need to get a change from your editor into a release.

## Quick start

You'll need [Node.js](https://nodejs.org/) 24+ and [pnpm](https://pnpm.io/) 10+. Then:

```bash
git clone https://github.com/datisthq/fireargs.git
cd fireargs
pnpm install
pnpm docs:start
```

`pnpm docs:start` boots the docs dev server so you can iterate on the site. To exercise the library itself:

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
├── .livemark/         # docs-site overrides (theme, includes)
├── models/            # typed records: CommandConfig, ProgramConfig, ArgumentConfig, OptionConfig
├── index.ts           # public API — exports the `f` namespace
├── settings.ts        # tunables (FIREARGS_META_KEY)
├── livemark.config.ts # config for the docs site
├── tsconfig.json
└── vite.config.ts     # vite-plus shared config (lint, format, test)
```

The package ships only `build/` (compiled by `tsgo`). Everything else is for development.

## Local commands

| Command           | What it does                                                |
| ----------------- | ----------------------------------------------------------- |
| `pnpm install`    | Install dependencies                                        |
| `pnpm build`      | Compile `actions/`, `models/`, `index.ts` → `build/`        |
| `pnpm type`       | Type-check via `tsgo --noEmit`                              |
| `pnpm lint`       | Format check + lint via Biome (`vp fmt --check && vp lint`) |
| `pnpm format`     | Auto-fix formatting (`vp fmt`)                              |
| `pnpm unit`       | Run unit tests (Vitest via `vp test`)                       |
| `pnpm test`       | `pnpm lint && pnpm type && pnpm unit`                       |
| `pnpm docs:start` | Run the docs dev server                                     |
| `pnpm docs:build` | Production build of the docs site                           |

A change is ready to push when `pnpm test` is green.

## Code conventions

- **TypeScript**: strict mode is on. Don't use `any`, `as`-casts, or non-null `!` without permission — flag it in the PR.
- **Imports**: use full ESM paths with the `.ts(x)` extension (`from "./foo.ts"`). `tsgo` rewrites them to `.js` on emit via `rewriteRelativeImportExtensions`.
- **Comments**: docstrings on exports only. Skip narrative `//` comments inside function bodies.
- **File layout**: high-level public items at the top, private helpers at the bottom.
- **Tests**: unit tests live next to the code as `<module>.unit.ts`. No "Arrange/Act/Assert" comments — the structure should be obvious.
- **Formatting**: Biome via `pnpm format`. 2-space indent, no semicolons, double quotes (LF, UTF-8).

## Proposing a change

1. **Open an issue first** for anything bigger than a typo or a small bug. It's easier to align on direction before code.
2. **Branch from `main`** with a short descriptive name (e.g. `fix-json-default`, `feat-program-hooks`).
3. **Write a focused commit history**. Fireargs uses [Conventional Commits](https://www.conventionalcommits.org/) — the prefix drives semantic-release:
   - `fix:` — bug fix → patch release
   - `feat:` — new feature → minor release
   - `fix!:` / `feat!:` or a `BREAKING CHANGE:` footer → major release
   - `chore:`, `docs:`, `refactor:`, `test:`, `perf:` — no release
4. **Run `pnpm test`** before pushing.
5. **Open a PR** against `main`. Describe the _why_ (link the issue), include CLI output for any UX-visible change, and call out anything reviewers should pay extra attention to.

## Releases

Releases are driven by [semantic-release](https://semantic-release.gitbook.io/) on every push to `main`. Conventional commit messages decide the next version automatically. Maintainers don't need to bump versions manually.

For a local version bump (e.g. preparing a non-semantic-release branch), use `pnpm setversion <new-version>` — it sets the version without creating a git tag.

## Where to find help

- **Bugs and feature requests**: [GitHub Issues](https://github.com/datisthq/fireargs/issues)
- **Discussion / ideas**: [GitHub Discussions](https://github.com/datisthq/fireargs/discussions)
- **Source**: [github.com/datisthq/fireargs](https://github.com/datisthq/fireargs)

Thanks for helping make Fireargs better.
