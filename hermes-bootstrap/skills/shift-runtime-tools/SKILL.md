---
name: shift-runtime-tools
description: "Safe deterministic Git, worktree, validation, push, and PR primitives for the Shift Hermes supervisor."
license: Apache-2.0
metadata:
  author: Shift
  version: "1.0"
  hermes:
    tags: ["shift", "git", "worktrees", "runtime"]
---

# Shift runtime primitives

These are tools, not the workflow supervisor. Use them only when directed by
`shift-autonomous-development`.

## Repository

Repository root: `/workspace/shift`.
Worktrees root: `/workspace/shift/.worktrees`.

## Safe commands

Synchronize main:

```bash
git fetch origin --prune
git switch main
test -z "$(git status --porcelain)"
git reset --hard origin/main
```

Create a worktree:

```bash
git worktree add -b <branch> .worktrees/<ISSUE_ID> origin/main
```

Install dependencies:

```bash
pnpm install --frozen-lockfile
gentle-ai skill-registry refresh --cwd "$PWD" --quiet
```

Commit only declared files:

```bash
git diff --check
git add -- <explicit file list>
git diff --cached --check
git commit -m "<type>(SHI-XXX): <summary>"
```

Push exact audited SHA:

```bash
git push origin <AUDITED_SHA>:refs/heads/<branch>
```

Verify remote SHA:

```bash
git ls-remote origin refs/heads/<branch>
```

Never:
- force-push;
- merge;
- delete remote branches before merge;
- stage undeclared files;
- use a different SHA than the auditor approved.
