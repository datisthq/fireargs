---
name: rust-development
description: Use when working in `rustlang/` — the crates.io package on clap, serde and schemars, and its fireargs-macros crate. Covers its layout, the cargo commands, how meta reaches a field, how it twins the other packages and the testsuite.
---

# Rust development

`rustlang/` is the crates.io package `fireargs`, the third twin of `typescript/`: the same
contract, built on serde and schemars (for zod) and clap (for commander). The folder is
`rustlang/`, the docs URLs are `/rust/…` and the release component is `rust`. Docs write
qualified paths — `fireargs::command()`, `#[fireargs::input]` — with no `use` lines: a
one-letter alias is not Rust style, and the macros remove every other import.

## Commands

Run from the repo root; each wraps cargo in `rustlang/package.json`:

```sh
pnpm -C rustlang setup          # cargo fetch
pnpm -C rustlang check:lint     # cargo fmt --all --check + clippy --workspace -D warnings
pnpm -C rustlang check:types    # cargo check --workspace --all-targets
pnpm -C rustlang test:unit      # cargo test --workspace: units, integration, the testsuite
pnpm -C rustlang build          # cargo package --workspace into rustlang/build/
```

`rustlang/` is a cargo workspace: the `fireargs` package at its root and the `fireargs-macros`
proc-macro crate in `rustlang/macros/`, one lockfile, one version. A bare `cargo test` or
`cargo clippy` covers the root package only, so the scripts pass `--workspace`. A single test:
`cargo test name` from `rustlang/`; the testsuite alone is
`cargo test --test testsuite`. `rustlang/rust-toolchain.toml` pins stable with clippy and
rustfmt, so rustup installs the right toolchain on first use — locally and in CI.

## Layout

`rustlang/src/` mirrors `typescript/` module for module, with snake_case names:

- `actions/<entity>/<verb>.rs` exports `verb_noun` (`actions/command/compile.rs` →
  `compile_command`); the module tree is declared inline in `lib.rs`, so there is no `mod.rs`
- `models/` — `Command<I, O>` and its erased `Leaf`, `Program`, `Route`, the config, `Context`,
  the errors, field meta, `Input` and the hidden pieces the macros expand to (`models/input.rs`)
- `lib.rs` is the one façade: `command`, `program`, the macros, the public types, and the
  `#[doc(hidden)] __private` module the expansions name (`::fireargs::__private::serde`, …)
- `macros/src/` — `input.rs`, `output.rs`, `value.rs` expand the three attributes; `attrs.rs`
  reads `#[fireargs(...)]`, `serde.rs` the serde attributes already on an item
- Unit tests sit beside their module as `<module>_unit.rs`, wired in with
  `#[cfg(test)] #[path = "<module>_unit.rs"] mod unit;`; `tests/` holds the integration tests,
  the testsuite runner and its fixture CLI (`tests/support/fixture.rs`)

## How a field gets its meta

There is no argument or option builder: a field is configured where it is declared. A field's
meta is JSON under the `fireargs` key of its property schema, with the TypeScript
`ArgumentConfig` / `OptionConfig` keys in camelCase; `read_fields` rejects unknown keys with a
panic, since a lenient read would turn a typo'd argument back into an option. The macros write
it, and a hand-written `#[schemars(extend("fireargs" = {...}))]` still works:

- `#[fireargs(...)]` on a field becomes a schemars `transform` that **merges** its keys into the
  meta already there, so a field overrides its `#[fireargs::value]` type's keys one by one.
  `extend` would replace the whole object
- `#[fireargs]` is no derive's helper attribute, so the macros must strip every one they read,
  and they are attribute macros because a derive cannot add the serde and schemars derives
- What a schema cannot hold — `parse` and a value type's default — travels through
  `Input::__fields()`. Each field asks its type with `(&&Probe::<T>::new()).read_spec()`:
  method lookup picks `ProbeValue` (on `&Probe<T>`, when `T: ValueSpec`) before `ProbePlain`
  (on `Probe<T>`). It only works on concrete types; a generic field type falls back silently
- A value type's default is applied at run time (`fill_defaults`) and patched into the
  schema (`apply_default`), since serde knows nothing of it

- The input schema is generated with `for_deserialize` (defaults leave `required`), the output
  with `for_serialize`, both with `inline_subschemas` so a field's meta sits on its property
- `serde_json`'s `preserve_order` feature is load-bearing: without it properties come back
  sorted and positionals are declared in the wrong order
- Nothing is required to clap. fireargs reads every value as a string, coerces it by the
  schema type, validates the JSON against the schema with `jsonschema` and words each failure
  like commander (`actions/command/report.rs`). clap's own parse errors keep clap's wording

## Twins

| TypeScript                             | Rust                                                           |
| -------------------------------------- | -------------------------------------------------------------- |
| `f.argument()` / `f.option({ short })` | `#[fireargs(argument)]` / `#[fireargs(short = 'v')]`           |
| a reusable `f.option(...)` value       | a `#[fireargs::value(...)]` newtype                            |
| zod `.optional()`                      | `Option<T>`; the macros skip it while `None`                   |
| `.default(v)`                          | `#[fireargs(default)]` or `#[fireargs(default = v)]`           |
| shape spread / `.extend()`             | `#[fireargs(flatten)]` — the meta of flattened fields survives |
| `.describe("...")`                     | a `///` doc comment                                            |
| `parse` in the option config           | `#[fireargs(parse = fn)]` on the field or the value type       |
| `renderError` returning a value        | `.render_error(..)` returning `Option<Value>`                  |
| the commander `Command` itself         | `.configure(\|clap\| ..)` on the declared clap command         |

The macros give structs camelCase keys so `--json` keys match the twins; flags are kebab-case
either way. `.handler(...)` takes an `AsyncFn` and types the command from it: the input from
the closure's annotation, the output from its `Ok`. `run()` blocks on it with pollster,
`run_async()` runs inside the caller's runtime, `try_run_from()` takes writers for tests.

## Testsuite

A behaviour every package shares gets a case in `testsuite/tests/<area>/<feature>.json`;
`rustlang/tests/testsuite.rs` runs each case in-process through `try_run_from` against
`rustlang/tests/support/fixture.rs`, the twin of `typescript/-test/fixture.ts` and
`python/fireargs/_test/fixture.py`. Change all three fixtures together.

## Releases

`rustlang/` is its own release-please component (`release-type: rust`): tags `rust-vX.Y.Z`, its
own changelog, published by `cargo publish --workspace` with crates.io trusted publishing
(`rust-lang/crates-io-auth-action` in `release.yaml`, environment `release`). The rust strategy
sees the `[workspace]` and bumps every member and the `fireargs-macros` dependency's version
together, so both crates always share one version; `cargo publish --workspace` publishes the
macros first. A new crate's first publish needs a crates.io token — trusted publishing only
covers crates that already exist. A `feat` touching
another section's files releases that section too, so land shared fixture and docs edits as a
separate `chore`.
