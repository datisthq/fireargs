---
name: change-verification
description: Use when checking a change works before calling it done — the smallest lint/type/unit slice and visual check for the diff, not the full gate. Covers check costs, the slice ladder, the docs guard related cannot see, and the commit gate.
---

# Verifying a change

**Verify the diff, not the repo.** `pnpm test` is lint + type + unit over everything: about
6 s and 12 core-seconds. A docs fix cannot break the command compiler, so running every unit
test checks nothing. While iterating, run the **slice** that could catch this
diff breaking. The full gate belongs to the lefthook pre-push hook and CI. A local session runs
`pnpm test` only for a build-shaped diff (rung 4); a commit runs the **commit gate** below.

- Never re-run a check that passed if nothing it covers has changed.
- Never chain two heavy commands in one call. One that fails hides the cost of the other.
- Say in the report which slice ran (e.g. "fmt+lint on 3 files, tsgo, command create tests").
  Never write "tests pass" for a slice.

## What each check costs

| check                                        | wall | core-s | catches                               |
| -------------------------------------------- | ---- | ------ | ------------------------------------- |
| `vp fmt --check <files>` / `vp lint <files>` | ~1 s | ~2     | format, oxlint                        |
| `pnpm check:lint`                            | ~2 s | ~6     | format and lint everywhere            |
| `pnpm check:types`                           | ~1 s | ~2     | types everywhere                      |
| `vp test <file or dir>`                      | ~2 s | ~3     | the tests named                       |
| `vp test related <files> --run`              | ~2 s | ~3     | every test importing the files        |
| `pnpm test:unit`                             | ~3 s | ~5     | every unit test, including the guards |
| `pnpm build`                                 | ~1 s | ~2     | the `tsgo` emit consumers' Node loads |
| `pnpm build:docs`                            | ~8 s | ~16    | the real build over this repo's docs  |

These run from the repo root (or the worktree root), except `vp test` over the package's own
tests: the root config collects only the guards, so run those from `typescript/`
(`pnpm -C typescript exec vp test …`). Raw `vitest` fails to collect `vite-plus/test` suites. The changed files come from `git diff --name-only main...` plus
`git status --short`.

## The ladder

Pick the **highest** rung the diff reaches, and run everything that rung lists.

1. **Markdown, copy, CSS.** `vp fmt --check` on the files. For `AGENTS.md`, `README.md`,
   `CONTRIBUTING.md` or a skill in either directory, add `vp test .scripts/-test/docs.unit.ts`:
   it checks every backticked path and `pnpm` command those documents name.
2. **The docs site's own UI** — a file under `.livemark/` or `livemark.config.ts`. fmt + lint on
   the files, `pnpm check:types`, and **look at it**: `pnpm start`, then open the page in Claude
   in Chrome, in light and dark and at a phone width. No unit test renders the page.
3. **Logic** — an action or model. Add `vp test related <files> --run`. A new or changed test
   runs on its own first (`vp test <file>`), and fails before the fix. When the change is
   visible from a terminal (help text, `--json`, the LLM manifest), also run a scratch CLI built
   with `f` and look at its output.
4. **Build-shaped** — `typescript/index.ts`, `typescript/settings.ts`, dependencies, a
   `vite.config.ts`, a `tsconfig`.
   Run `pnpm test`, then `pnpm build`; add `pnpm build:docs` when docs-site dependencies or
   `livemark.config.ts` changed. No cherry-picking here.

## Python and the testsuite

A diff under `python/` runs `pnpm -C python check:lint`, `pnpm -C python check:types` and the
tests it reaches (`uv run pytest <file>` from `python/`). A behaviour both packages share, or
anything under `testsuite/` or either fixture CLI, also runs both runners:
`pnpm -C typescript exec vp test ./-test/testsuite.unit.ts` and
`uv run pytest fireargs/_test` from `python/`.

## Guards `related` cannot see

`.scripts/-test/docs.unit.ts` reads documents from disk and imports nothing, so
`vp test related` never selects it. Add it by path whenever the diff touches `AGENTS.md`,
`README.md`, `CONTRIBUTING.md`, a skill, a renamed path or a renamed script.

## Worked example

The diff is `typescript/actions/option/create.ts` (a new `short` alias check):

```sh
vp fmt --check typescript/actions/option/create.ts
vp lint typescript/actions/option/create.ts
pnpm check:types
pnpm -C typescript exec vp test related actions/option/create.ts --run
```

Then run a scratch CLI with the new option and read its `--help`. The slice covers types and
the tests that import the file; only the scratch run shows what a user sees.

## The commit gate

A commit on `main`, and landing a worktree branch (**`worktree-workflow`**), run the **commit
gate** once, at the end: `pnpm check` always, then a unit half **you choose**.

- `pnpm check` = `check:lint` + `check:types`, 5–15 s over the whole package.
- **`pnpm test:unit`** when the diff is build-shaped, changes shared code many modules import
  (`typescript/settings.ts`, a model, `typescript/actions/field/`), or you are unsure.
- **Cherry-pick** otherwise: `vp test related <files> --run` plus every guard above the diff
  triggers.
- Unsure? Run `pnpm test:unit`. Pre-push and CI run everything, but a break they catch has already
  landed on `main` under somebody else's work.
- The report names the path taken: "check + test:unit", or "check + related, docs guard".

## When the slice is not enough

- **The slice fails somewhere unexpected.** The diff reaches further than you thought. Go up a
  rung; do not narrow the slice until it passes.
- **Snapshots.** A changed snapshot under `fixtures/generated/` is part of the diff; read it,
  never update it blindly with `-u`.
