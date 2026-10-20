---
name: change-review
description: Review a pull request, or the local branch before it lands, for correctness, security and repo conventions — inline PR comments, or a ranked list locally. Invoked by the review workflow or a person; never fires on its own.
disable-model-invocation: true
---

# Review a change

Read the diff, judge it, post findings as inline comments. Be useful, not thorough-looking:
a review that flags twenty things teaches nothing, and the twenty-first — the real one — is lost
in it.

## What to look for

**Correctness**

- Logic that is wrong for an input the change makes reachable, not merely unusual.
- Error handling that swallows a failure or reports success on a partial write.
- Concurrency: an async handler awaited twice, `parseAsync` racing a stdout write, two
  subcommands sharing mutable builder state.
- Performance where the change makes it structurally worse (a schema re-walk per field, a
  manifest rebuilt per call), not where it is merely not optimal.

**Security — OWASP-shaped, but reported only when reachable**

- Injection (SQL and otherwise), XSS, SSRF, XXE, unsafe deserialisation: argv or `--json`
  input reaching a shell, `eval` or a prototype key (`__proto__`) without passing the zod schema.
- Broken validation: an input path that skips the command's schema, or output written without
  passing the output schema.
- Sensitive data exposure: secrets in code or logs, or an option value echoed into a manifest or
  error message.
- Insecure cryptography, race conditions and TOCTOU, missing logging on a security-relevant
  action.

**This repo's own invariants** — these are where a generic reviewer is blind, and they matter
more than the generic checklist:

- a change to `index.ts`, the `exports` map, the `f` namespace or a public model type that
  breaks an existing CLI built on the package;
- a renamed `FIREARGS_META_KEY` (`settings.ts`) or a changed meta shape, which silently drops
  every field's argument/option tagging;
- a builder method, field-config option or CLI behaviour (JSON mode, LLM manifest) added or
  changed with the matching `docs/` page or shipped skill (`skills/`) left as it was;
- a commit typed `feat` or `fix` that does not change what an installer gets, or a package change
  typed `chore`;
- a commit marked breaking (`!` or a `BREAKING CHANGE:` footer);
- `AGENTS.md`, a skill or `CONTRIBUTING.md` that the diff made untrue (**`human-documentation`**).

The relevant skill explains each of these — `human-documentation`, `change-verification`.

## How to report

Rate each finding **CRITICAL / HIGH / MEDIUM / LOW**, and say what input or sequence produces
the failure. A finding that cannot name the case that breaks is a hunch: either verify it or
leave it out.

Post specific issues as inline comments on the lines they concern. Keep the summary short.
Silence on the parts that are fine is not laziness — it is what makes the flagged parts legible.

If the change is good, say so briefly and stop. Do not manufacture findings to justify the run.

## Reviewing locally

With no pull request — a person running `/change-review` in a checkout, or `issue-resolution` before
it commits — the change is everything this branch adds over `main`: `git diff main...HEAD` plus the
uncommitted and untracked files. Judge it by the same rules, then print the findings in the terminal,
worst first, each with its `file:line`. Post nothing, and edit nothing unless the caller asks for the
fixes.
