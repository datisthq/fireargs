# fireargs

Fireargs builds CLIs from schemas: typed input and output, JSON I/O and LLM-ready manifests. Three packages share one contract: TypeScript (zod on top of commander) in `typescript/`, Python (pydantic on top of click) in `python/`, Rust (serde and schemars on top of clap) in `rustlang/`. The repo root holds the tooling shared across languages, the shared `testsuite/` and Fireargs' own docs site, built with Livemark.

## Terminology

- **package** — what `npm install fireargs` gets (`typescript/build/` and `typescript/skills/`), `pip install fireargs` (`python/fireargs/` and `python/skills/`), or `cargo add fireargs` (`rustlang/src/` and `rustlang/skills/`)
- **twin** — the same behaviour's counterpart in another package: `compileCommand` ↔ `compile_command` ↔ `compile_command`, `f.option()` ↔ `Option()` ↔ `extend("fireargs" = {"kind": "option"})`
- **builder** — the `f` namespace: exported from `typescript/index.ts` (`f.command`, `f.argument`, `f.option`, `f.program`), in Python the names `fireargs` exports, imported directly (`command`, `Argument`, `Option`, `Program`), and in Rust `f::command` / `f::program` from `rustlang/src/lib.rs`, with no argument or option builder
- **docs site** — `python/docs/`, `typescript/docs/`, `rustlang/docs/` (served under `/rust/`), each section's README and its copy of `CONTRIBUTING.md`, built by `pnpm build:docs` and deployed to fireargs.dev
- **meta** — per-field metadata, the only contract between builder and compiler: in zod's registry under `FIREARGS_META_KEY` (`typescript/settings.ts`), in Python an `ArgumentMeta` / `OptionMeta` appended to the pydantic field's `metadata` (`python/fireargs/models/field.py`), in Rust a JSON object under the same `fireargs` key of the property's JSON Schema, set with `#[schemars(extend(...))]` (`rustlang/src/settings.rs`)

## Rules

- **Never commit unless asked to** — except that a session working directly on `main` commits each task once done. The root's index is shared, so always commit with a pathspec: `git commit -m "…" -- <your paths>` — `git add` new files first, since a pathspec commit silently skips untracked ones.
- **Never add co-authored by Claude Code to commits!**
- **Never mark a commit breaking** — no `!` and no `BREAKING CHANGE:` footer; release-please turns either into a major bump.
- **Never push main or pull requests to origin unless asked to.**
- **Never amend or rewrite existing commits unless asked** (`--amend`, `reset`, `rebase`, force-squash). Fold changes in with a follow-up commit.
- **Never change code unless asked to.** Usually just answer.
- When resolving a TODO, follow its instructions literally. Prefer LSP capabilities where available.
- Start a plan from a summary of the new or changed API (models and signatures) and the hardest points.
- **Every plan ends by asking how to work it** (`AskUserQuestion`, before finalising): **the current branch** or **a `.worktrees/<name>` branch** (**`worktree-workflow`**).
- **A behaviour change lands on every twin in the same branch**, with the same names (case-converted), defaults and output, and a behaviour they share gets a `testsuite/` case, not only a unit test per package. A twin left out on purpose is named in the commit body with why. **`python-development`** holds the Python side, **`rust-development`** the Rust one.
- **The meta key and the builder are public API.** Renaming `FIREARGS_META_KEY`, a builder method or a field-config option silently breaks every CLI built on the package. Treat it like an export change (**`change-review`**).
- Use full relative import paths with the `.ts` / `.tsx` extension. No barrel re-export files — `typescript/index.ts` is the one public façade.
- Each `actions/<entity>/<verb>.ts` holds one action, named after its verb (`actions/command/create.ts` exports `createCommand`); a new action gets its own file.
- Don't destructure props in the function signature — use `props.x`. Put higher-level items above the ones they compose, public before private.
- **Comments must not outnumber code**, and one is at most ~3 lines. The bar is: **name the specific mistake this prevents** — if you cannot, delete it. A file with none is normal. Rationale and history belong in git; only a non-obvious invariant (an ordering types cannot express, a failure that looks like success, a deliberate deviation from a rule here) earns lines.
- Typedoc comments only on public API — a brief line on what an exported function or model does; none on files and no `@param`.
- Update docs when a change requires it, and **after every task check whether a skill needs the lesson it taught** — update it in the same commit, or add one when no skill covers the area. Where a fact belongs: the **`human-documentation`** skill.
- **End every response that finishes a task with a status line: one bold sentence of about ten words, as the final paragraph, nothing after it** (e.g. **Ready to commit; lint, types and units green.**).

## Skills

Depth lives in skills: this file carries invariants, the skills carry procedure. Reach for one before working in its area. **A repo skill beats a plugin skill on the same subject** — `change-verification` over verification-before-completion, `change-review` over a generic code review. Each is named `<subject>-<facet>`, subject first.

Repo skills live in `.agents/skills/` (reached by Claude Code through the `.claude/skills` symlink `pnpm install` creates) and are never published:

| skill                 | when                                                                    |
| --------------------- | ----------------------------------------------------------------------- |
| `change-review`       | reviewing a pull request or the working diff — also what CI review runs |
| `change-verification` | checking a change works — the smallest lint/type/unit slice and a look  |
| `human-documentation` | the docs-truth pass before a commit, and where a fact belongs           |
| `issue-resolution`    | taking one issue or bug report to one tested commit in a worktree       |
| `landing-screenshots` | changing the landing hero carousel or regenerating its screenshots      |
| `python-development`  | working in `python/` — layout, uv commands, typing, the testsuite twin  |
| `rust-development`    | working in `rustlang/` — layout, cargo commands, meta, the testsuite    |
| `worktree-workflow`   | starting, running and landing a `.worktrees/<name>` branch              |

Shipped skills live in `typescript/skills/`, `python/skills/` and `rustlang/skills/` and teach coding agents to **use** Fireargs; they are published in each package and on fireargs.dev under `/.well-known/agent-skills/`. Read the matching one before changing the behaviour it describes, and update it in the same commit:

| skill                        | when                                                                 |
| ---------------------------- | -------------------------------------------------------------------- |
| `fireargs-commands`          | writing a command — input/output schemas, arguments, options, config |
| `fireargs-programs`          | building a subcommand tree and sharing pieces across commands        |
| `fireargs-automation`        | driving a CLI through `--json` and `--llms`, testing it, its errors  |
| `fireargs-python-commands`   | the Python twin of `fireargs-commands`                               |
| `fireargs-python-programs`   | the Python twin of `fireargs-programs`                               |
| `fireargs-python-automation` | the Python twin of `fireargs-automation`                             |
| `fireargs-rust-commands`     | the Rust twin of `fireargs-commands`                                 |
| `fireargs-rust-programs`     | the Rust twin of `fireargs-programs`                                 |
| `fireargs-rust-automation`   | the Rust twin of `fireargs-automation`                               |

**There is exactly one `AGENTS.md`, at the root.** `.scripts/-test/docs.unit.ts` enforces that, along with every path and `pnpm` command these documents name and the two tables above.

## Commands

- `pnpm install` — dependencies, lefthook and the `.claude/skills` symlink
- `pnpm start` — the dev server over this repo's docs site · `pnpm build:docs` — its production build
- `pnpm build` — compile `typescript/build/` with `tsgo` (`typescript/tsconfig.build.json`), then the wheel and sdist into `python/build/` with `uv build`, then the `.crate` into `rustlang/build/` with `cargo package`
- `pnpm test` — full gate: lint + type + unit · `pnpm check` — lint + type
- `pnpm check:lint` — `vp fmt --check && vp lint`, then ruff, `cargo fmt --check` and clippy · `pnpm format` — `vp fmt`, `ruff format`, `cargo fmt` · `pnpm check:types` — `tsgo --noEmit`, `ty check`, `cargo check`
- `pnpm test:unit` — the repo guards, then each package's units and its `testsuite/` runner. Single test, from `typescript/`: `vp test path/to/file.unit.ts` or `vp test -t "name"`. While iterating, verify the slice the diff reaches, not the full gate (**`change-verification`**)
- `pnpm measure:coverage` — the unit tests with coverage, which `vp test` leaves off
- `pnpm scan:leaks` / `pnpm scan:vulns` / `pnpm scan` — gitleaks / semgrep / both
- `pnpm update:deps` — bump dependencies past a 7-day cooldown
- `pnpm -C typescript release` / `pnpm -C python release` / `pnpm -C rustlang release` — publish to npm / PyPI / crates.io; run by the release workflow only
- `pnpm squash <branch> -m "<subject>"` — land a worktree branch on local `main` as one commit (**`worktree-workflow`**)

## Code structure

The root is a private pnpm workspace (`package.json`, `pnpm-workspace.yaml`): format, lint, the docs site, the repo guards and the scripts that chain each language section with `pnpm -C <section>` — never `pnpm -r`. Each section is one published package.

- `typescript/` — the npm package. `tsgo` compiles it into `typescript/build/`, which ships with `typescript/skills/` and nothing else; `typescript/vite.config.ts` holds only its `test` block
  - `actions/<entity>/<verb>.ts` — the **operations**: `argument/`, `option/` and `field/` build and read per-field meta; `command/` creates, compiles and describes (manifest) a command; `program/` wires a subcommand tree
  - `models/<entity>.ts` — types for each builder's config; `index.ts` the public façade, `settings.ts`
  - Unit tests sit beside their module as `<module>.unit.ts`; `docs/` the section's pages, `skills/` its shipped skills
- `python/` — the PyPI package, a uv project; `python/fireargs/` mirrors `typescript/` module for module, with `docs/` and `skills/` beside it (**`python-development`**)
- `rustlang/` — the crates.io package, a cargo project on the toolchain `rustlang/rust-toolchain.toml` pins; `rustlang/src/` mirrors `typescript/` module for module (`actions/<entity>/<verb>.rs`, `models/`, `lib.rs` the façade), integration tests and the testsuite runner in `rustlang/tests/` (**`rust-development`**)
- `testsuite/` — language-neutral JSON cases every package runs against twin fixture CLIs
- `README.md`, `CONTRIBUTING.md` and `livemark.config.ts` — the GitHub overview, the contributor guide (copied into each section for its docs-site page; the docs guard keeps the copies equal) and the docs site's config

Dot-directories hold non-package code: `.agents/` repo skills, `.livemark/` the docs site's escapes, `.release/` release-please config, `.scripts/` repo-wide guards (`.scripts/-test/`) and the `pnpm squash` script, whose tests the root `vite.config.ts` runs.

## Conventions

- pnpm `^11`, Node `^24`, ES Modules; vite-plus format and lint (2-space, LF, UTF-8, no semicolons, 90 columns)
- Strict TypeScript with null checks; no explicit return types. Never use `any`, an `as` cast or `!` without permission
- PascalCase types, interfaces and classes; camelCase values. Function names are **verbNoun** (`compileCommand`), never a bare verb or noun; factories are `create*` / `build*` / `make*`
- `package.json` script names are `verb[:object]` (`check:lint`, `build:docs`), never noun-first; a `verb:x` script is a part or a scoped run of `verb`
- Specs: Vitest via `vite-plus/test`, `<module>.unit.ts`, no "Arrange / Act / Assert" comments
- Python: 3.12+, uv, ruff (90 columns), `ty`; snake_case **verb_noun** functions, the same no-`Any` rule (**`python-development`**)
- Rust: edition 2024, rustfmt (90 columns), clippy with `-D warnings`; snake_case **verb_noun** functions; no `unwrap` / `expect` / `unsafe` in library code (**`rust-development`**)
- Commits: Conventional Commits, typed by what an installer gets (below)

## Releases

Conventional Commits drive [release-please](https://github.com/googleapis/release-please): a `feat` or `fix` landing on `main` opens a Release PR, and merging that PR cuts the version, tags it and publishes. Merging is the gate — nothing ships without it.

- **IMPORTANT: only changes to a published package use `feat` or `fix`** — `typescript/actions/`, `typescript/models/`, `typescript/index.ts`, `typescript/settings.ts`, the `exports` and `files` in `typescript/package.json`, the shipped `typescript/skills/`; `python/fireargs/`, the `[project]` table of `python/pyproject.toml` and the shipped `python/skills/`; `rustlang/src/`, the `[package]` and `[dependencies]` tables of `rustlang/Cargo.toml` and the shipped `rustlang/skills/`. Everything else MUST be `chore` or `docs`: CI and workflows, release config, dependencies, tooling, `AGENTS.md`, `.agents/skills/`, the README, the docs site
- This is not a style preference. release-please reads the commit type: a `fix:` on a workflow file cuts a release and burns a version number on a change no consumer can observe. Version numbers can never be reused
- When in doubt, ask whether the change alters what someone installing the package gets. If it does not, it is `chore`
- release-please assigns a commit to every component whose path it touches: a `feat` spanning two sections releases both, so land a change that only moves or shares files as `chore`
- Release config lives in `.release/config.json` and `.release/manifest.json`. Each section is its own release-please component, keyed by its path, with its own version and changelog (a `CHANGELOG.md` in each section; tags `vX.Y.Z` for TypeScript, `python-vX.Y.Z` for Python, `rust-vX.Y.Z` for Rust), and all of them ship through one combined Release PR. The manifest holds the current versions and release-please maintains it — never hand-edit it
