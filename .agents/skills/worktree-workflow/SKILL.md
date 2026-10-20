---
name: worktree-workflow
description: Use when starting, running or finishing work in a `.worktrees/<name>` branch — bootstrap, its own docs server port, landing as one squashed commit, cleanup. Covers what `pnpm squash` does that `git merge --squash` does not.
---

# Working in a worktree

The root checkout is shared by several sessions, **including its index**. All branch work happens
in `.worktrees/<name>` inside the repo (gitignored), never in a sibling directory and never by
switching the root's branch.

## Bootstrap

```sh
git worktree add .worktrees/<name> -b <name>
cd .worktrees/<name>
pnpm install
```

`pnpm install` is not optional. A worktree has no `node_modules`, and its `prepare` script links
`.claude/skills` and installs lefthook; without it the repo skills are invisible to the session
and the pre-commit format never runs.

## Ports

The root owns the docs server's default port. `pnpm start` runs `livemark start`, which asks
Vite for it without `strictPort`, so a worktree server started while the root's runs lands on
the next free port, and the page still loads. Read
the URL the server prints and point Claude in Chrome and `curl` at that. Never type the port by
hand from a worktree, and never stop a process listening on a port you did not start: it is
another session's server.

## Running the docs site

Start the server from inside the worktree: `pnpm start` serves the worktree's own docs, and
`pnpm build:docs` writes into the worktree, never the root.

## Landing

"Land" means one squashed commit on **local** `main`. It never means push: a push to `main`
reaches release-please and CI, so it happens only when someone asks for it.

**Load `change-verification` before you start landing.** Its slice comes first: the rung the diff
reaches, plus the docs guard whenever the diff triggers it. That guard reads files from disk, so
nothing narrower selects it, and one failing in the full gate wastes the whole run.

```sh
# in the worktree, with the change-verification slice already green
git merge main          # reconcile
pnpm check              # lint and types over the whole package
pnpm test:unit          # or the cherry-picked slice change-verification describes
pnpm squash <branch> -m "<type(scope): subject>"
```

This is the commit gate (**`change-verification`**). Never run `pnpm test` here on top of it:
the whole suite runs at the pre-push hook and in CI. After the merge, `main...HEAD` holds only
this branch's change, and `main` was already gated.

`pnpm squash` builds the squash commit with plumbing, advances `main` by compare-and-swap, and
refreshes only the landed paths in the root. It refuses:

- a branch that is missing `main`;
- a subject marked breaking, or one that is not a Conventional Commit;
- a landed path that someone has dirty in the root.

Never run `git merge --squash` in the root: its commit takes everything any session has staged.
Never fast-forward or merge-commit a branch into `main` either, because both carry its WIP commits.

## Cleanup

Once a worktree **this session created** has landed:

```sh
git worktree remove .worktrees/<name>
git branch -d <name>
```

Never remove another session's worktree or branch.
