---
name: review-changes
description: Review a pull request for correctness, security and repo conventions, posting findings as inline comments. Invoked by the review workflow and by a person; never fires on its own.
disable-model-invocation: true
---

# Review a pull request

Read the diff, judge it, post findings as inline comments. Be useful, not thorough-looking:
a review that flags twenty things teaches nothing, and the twenty-first — the real one — is lost
in it.

## What to look for

**Correctness**

- Logic that is wrong for an input the change makes reachable, not merely unusual.
- Error handling that swallows a failure or reports success on a partial write.
- Concurrency: two requests, two sessions, a retry, a replay.
- Performance where the change makes it structurally worse (a query in a loop, an unbounded
  scan), not where it is merely not optimal.

**Security — OWASP-shaped, but reported only when reachable**

- Injection (SQL and otherwise), XSS, SSRF, XXE, unsafe deserialisation.
- Broken authentication or access control: a route that skips the permission it needs, a scope
  resolved from user input, an id trusted because it came from the client.
- Sensitive data exposure: secrets in code or logs, PII widening, a credential recoverable from
  the database.
- Insecure cryptography, race conditions and TOCTOU, missing logging on a security-relevant
  action.

**This repo's own conventions** — these are where a generic reviewer is blind, and they matter
more than the generic checklist. Read `AGENTS.md` and the sibling skills before judging: a
change that violates a documented invariant is a finding even when the code is otherwise
correct.

## How to report

Rate each finding **CRITICAL / HIGH / MEDIUM / LOW**, and say what input or sequence produces
the failure. A finding that cannot name the case that breaks is a hunch: either verify it or
leave it out.

Post specific issues as inline comments on the lines they concern. Keep the summary short.
Silence on the parts that are fine is not laziness — it is what makes the flagged parts legible.

If the change is good, say so briefly and stop. Do not manufacture findings to justify the run.
