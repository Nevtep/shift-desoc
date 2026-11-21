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

Contract tests (`pnpm forge:test`) also need the pinned Foundry libraries, which are
untracked (`/lib/` is gitignored), so every fresh worktree must run them once:

```bash
bash scripts/ci/install-foundry-dependencies.sh
```

Any change to a Solidity contract also needs the web bundle refreshed (CI "Web unit tests" fails with "Bundle is stale for: <Contract>" otherwise): run `pnpm hh:compile && node scripts/copy-web-deploy-artifacts.js`, confirm `node scripts/copy-web-deploy-artifacts.js --check` passes, and commit the changed `apps/web/lib/deploy/bundled-contracts/<Contract>.json` together with the contract change. Also run contract tests and `pnpm --filter @shift/web test:unit`. Do not commit docs/operations-cost-estimate.md.

Pre-mainnet policy (confirmed by the operator): this applies to ALL Shift development, not one issue. While Shift runs only on Base Sepolia with staging communities, contract changes may break ABI or storage compatibility (replace a method instead of adding an overload, redeploy). Existing test communities are disposable: create new ones and reindex from a recent block. No backwards-compatibility shims, overloads or migrations are needed. This changes at mainnet launch with real communities.

Issue selection (operator rule): before starting an issue, check open PRs (`gh pr list --json files`) and treat any open PR touching the same files (contract, bundled JSON, shared test file, Manager component) as a blocker. Set it in Linear (`blockedBy`) and pick another issue; never open a PR that will conflict. When a change alters what the Manager must show (a new revert reason, a new guard), make sure a Manager issue exists for the UI side (the wallet must be told why it cannot act, never left to sign a failing tx) and link it. Record findings in Linear as you go.

Contract changes and their consumers (operator rule, general): whenever a PR or issue modifies a contract, search the code for every integration and usage (Manager screens, hooks, indexer mappings, deploy wizard, and any other ecosystem app we know of) and make sure a Linear issue exists to update each one, proposing the best UX possible (prevent and explain, never let the user sign a failing tx). Do not mix those changes into the contract PR.

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
