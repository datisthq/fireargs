---
name: rust-development
description: Use when working in `rustlang/` — the crates.io package built on clap, serde and schemars. Covers its layout, the cargo commands, how meta reaches a field, how it twins the other packages and the shared testsuite.
---

# Rust development

`rustlang/` is the crates.io package `fireargs`, the third twin of `typescript/`: the same
contract, built on serde and schemars (for zod) and clap (for commander). The folder is
`rustlang/`, the docs URLs are `/rust/…` and the release component is `rust`. Docs import it as
`use fireargs as f;`, so `f::command` and `f::program` read like the TypeScript `f`.

## Commands

Run from the repo root; each wraps cargo in `rustlang/package.json`:

```sh
pnpm -C rustlang setup          # cargo fetch
pnpm -C rustlang check:lint     # cargo fmt --check + clippy --all-targets -D warnings
pnpm -C rustlang check:types    # cargo check --all-targets
pnpm -C rustlang test:unit      # cargo test: units, integration tests, the testsuite
pnpm -C rustlang build          # cargo package into rustlang/build/
```

A single test: `cargo test name` from `rustlang/`; the testsuite alone is
`cargo test --test testsuite`. `rustlang/rust-toolchain.toml` pins stable with clippy and
rustfmt, so rustup installs the right toolchain on first use — locally and in CI.

## Layout

`rustlang/src/` mirrors `typescript/` module for module, with snake_case names:

- `actions/<entity>/<verb>.rs` exports `verb_noun` (`actions/command/compile.rs` →
  `compile_command`); the module tree is declared inline in `lib.rs`, so there is no `mod.rs`
- `models/` — `Command`, `Program`, `Route`, the configs, `Context`, the errors, field meta
- `lib.rs` is the one façade: `command`, `program` and the public types
- Unit tests sit beside their module as `<module>_unit.rs`, wired in with
  `#[cfg(test)] #[path = "<module>_unit.rs"] mod unit;`; `tests/` holds the integration tests,
  the testsuite runner and its fixture CLI (`tests/support/fixture.rs`)

## How a field gets its meta

There is no argument or option builder: a closure cannot live in a schema, and a derive macro
would be a second crate. A field's meta is JSON under the `fireargs` key of its property schema,
written with `#[schemars(extend("fireargs" = {"kind": "option", "short": "v"}))]`, with the
TypeScript `ArgumentConfig` / `OptionConfig` keys in camelCase. `read_fields` rejects unknown
keys with a panic, since a lenient read would turn a typo'd argument back into an option. The
one config that cannot be JSON, `parse`, is registered on the builder by input key.

- The input schema is generated with `for_deserialize` (defaults leave `required`), the output
  with `for_serialize`, both with `inline_subschemas` so a field's meta sits on its property
- `serde_json`'s `preserve_order` feature is load-bearing: without it properties come back
  sorted and positionals are declared in the wrong order
- Nothing is required to clap. fireargs reads every value as a string, coerces it by the
  schema type, validates the JSON against the schema with `jsonschema` and words each failure
  like commander (`actions/command/report.rs`). clap's own parse errors keep clap's wording

## Twins

| TypeScript                               | Rust                                                        |
| ---------------------------------------- | ----------------------------------------------------------- |
| `f.option({ short }).schema(z.number())` | `#[schemars(extend("fireargs" = {"kind": "option", ...}))]` |
| zod `.optional()`                        | `Option<T>` with `skip_serializing_if = "Option::is_none"`  |
| `.default(v)`                            | `#[serde(default)]` or `#[serde(default = "fn")]`           |
| shape spread / `.extend()`               | `#[serde(flatten)]` — the meta of flattened fields survives |
| `.describe("...")`                       | a `///` doc comment                                         |
| `parse` in the option config             | `.parse("key", \|text\| ...)` on the builder                |
| `renderError` returning a value          | `render_error` returning `Option<Value>`                    |

Give input structs `#[serde(rename_all = "camelCase")]` so `--json` keys match the twins; flags
are kebab-case either way. Handlers are async closures: `run()` blocks on them with pollster,
`run_async()` runs inside the caller's runtime, `try_run_from()` takes writers for tests.

## Testsuite

A behaviour every package shares gets a case in `testsuite/tests/<area>/<feature>.json`;
`rustlang/tests/testsuite.rs` runs each case in-process through `try_run_from` against
`rustlang/tests/support/fixture.rs`, the twin of `typescript/-test/fixture.ts` and
`python/fireargs/_test/fixture.py`. Change all three fixtures together.

## Releases

`rustlang/` is its own release-please component (`release-type: rust`): tags `rust-vX.Y.Z`, its
own changelog, published by `cargo publish` with crates.io trusted publishing
(`rust-lang/crates-io-auth-action` in `release.yaml`, environment `release`). A `feat` touching
another section's files releases that section too, so land shared fixture and docs edits as a
separate `chore`.
