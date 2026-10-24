---
name: python-development
description: Use when working in `python/` — the PyPI package built on click and pydantic. Covers its layout, the uv commands, typing rules, how it twins the TypeScript package and the shared conformance suite.
---

# Python development

`python/` is the PyPI package `fireargs`, the twin of `typescript/`: the same contract, built on
pydantic (for zod) and click (for commander). A uv project with one package; nothing else in the
repo is Python. Docs import its names directly (`from fireargs import Option, command`), as pydantic's are; TypeScript keeps the `f` namespace, beside zod's `z`.

## Commands

Run from the repo root; each wraps `uv run` in `python/package.json`:

```sh
pnpm -C python setup          # uv sync: the venv and dev tools
pnpm -C python check:lint     # ruff check + ruff format --check
pnpm -C python check:types    # ty check
pnpm -C python test:unit      # pytest
pnpm -C python build          # wheel + sdist into python/build/
```

A single test: `uv run pytest fireargs/actions/command/create_unit.py -k name` from `python/`.
The root `pnpm check` and `pnpm test:unit` chain these after the TypeScript ones.

## Layout

`python/fireargs/` mirrors `typescript/` module for module, with snake_case names:

- `actions/<entity>/<verb>.py` exports `verb_noun` (`actions/command/compile.py` →
  `compile_command`), the twin of `actions/<entity>/<verb>.ts`
- `models/` — the config `TypedDict`s, `Command`, `Program`, `Context`, the field meta
- `__init__.py` is the one façade. Every other `__init__.py` stays empty: no barrels
- Tests sit beside their module as `<module>_unit.py`, `class TestXxx` with `def test_...`;
  `fireargs/_test/` holds the conformance runner and its fixture CLI, left out of the wheel

## Typing

- Python 3.12+ syntax (`class Command[I, O]`, `type X = …`); no `Any`, no casts and no
  `# ty: ignore` without permission
- click's and pydantic's signatures are typed: pass their settings as explicit keyword
  arguments, or through a `TypedDict` splat. A `dict[str, object]` splat fails `ty`
- `@command` reads the input model and output type from the handler's annotations; its
  overloads in `actions/command/create.py` are what lets `ty` type `input` in a handler

## Twins

A behaviour change lands in every package in one branch (`AGENTS.md`). Translate rather than
copy:

| TypeScript                               | Python                                                  |
| ---------------------------------------- | ------------------------------------------------------- |
| `f.option({ short }).schema(z.number())` | `Annotated[int, Option(short=...)]`                     |
| zod `.optional()`                        | `X \| None = None` — left out of `--json` output        |
| shape spread / `.extend()`               | mixin models — `class C(A, B)` lists B's fields first   |
| commander pass-throughs                  | click pass-throughs (`envvar`, `flag_value`, `epilog`…) |
| variadic option `--tags a b`             | repeated flag `--tags a --tags b`                       |

Wire keys match only when the Python model uses the TypeScript names: give it a camelCase
`alias` or `alias_generator`. Error frames are fireargs' own and identical in both
(`actions/command/report.py`); validator details and click's own parser errors are not.

## Conformance

A behaviour the packages share gets a case in `conformance/tests/<area>/<feature>.json`
(schema: `conformance/test-schema.json`), run by `typescript/-test/conformance.unit.ts`,
`python/fireargs/_test/conformance_unit.py` and `rust/tests/conformance.rs` against the twin
fixture CLIs `typescript/-test/fixture.ts`, `python/fireargs/_test/fixture.py` and
`rust/tests/support/fixture.rs`. Change all three fixtures together. Cases compare `--json` output deep-equal, `stderr` by prefix and `--llms` schemas
semantically — by the `instances` each must accept or reject, never by their text.

## Releases

`python/` is its own release-please component: tags `python-vX.Y.Z`, its own changelog,
published by `uv publish` with PyPI trusted publishing (`release.yaml`, environment
`release`). A `feat` or `fix` touching `python/fireargs/` releases only the Python package.
