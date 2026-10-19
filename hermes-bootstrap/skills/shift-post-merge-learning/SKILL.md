---
name: shift-post-merge-learning
description: "After a Shift PR merges: sync the checkout, learn from the review comments and human fixes that landed between the audited commit and the merge, persist the lessons, then hand over to the development loop."
license: Apache-2.0
metadata:
  author: Shift
  version: "1.0"
  hermes:
    tags: ["shift", "learning", "github", "merge", "cron"]
---

# Post-merge learning

Triggered by the "Shift merge watcher" cron job. Its monitor output lists the
merged PRs not yet acknowledged under `PENDING_MERGED_PRS:`. Work only on
those. If the list is `(none)` or `STATUS=ERROR`, reply exactly `[SILENT]` and
do nothing else.

A PR stays pending until you acknowledge it (step 4), so an interrupted run is
retried automatically (`RETRY_ROUND=<n>` advances hourly). If the output says
`RETRY_EXHAUSTED=1`, do not start another attempt: report that learning for
those PRs keeps failing, with the last error you can find, and stop.

## 1. Sync the runtime

```bash
cd /workspace/shift
git fetch origin --prune
git switch main && git reset --hard origin/main
git worktree prune
/opt/data/scripts/shift-engram-import.sh /workspace/shift
```

`shift-engram-import.sh` imports the Engram chunks merged into `.engram/`
(teammates share learnings by committing them) from a temp copy, so the
checkout stays pristine. It is idempotent: already-imported chunks are
skipped. The merge watcher already ran it after its own sync; running it
again here covers a tick where the watcher could not sync. If it prints
`ENGRAM_IMPORT=ERROR`, include its output in the report but continue: the
learning steps do not depend on it. Report how many chunks were imported.

For every merged PR whose head branch is `feat/SHI-*` or `imp/SHI-*`:
remove its worktree (`git worktree remove --force .worktrees/<ISSUE_ID>` if
present) and the local branch (`git branch -D <branch>`). Never touch
branches that still have an open PR.

Skills are loaded from this checkout, so after the sync the next cycle runs
with the merged version of `hermes-bootstrap/skills/` and `.github/skills/`.
If a merged PR changed those files, say so in the report.

## 2. Learn from each merged PR

Gather, per PR, with `gh` (read-only):
- `gh pr view <n> --json title,body,headRefName,mergeCommit,mergedBy,commits,reviews,comments,files`
- review comments: `gh api repos/<owner>/<repo>/pulls/<n>/comments`
- the audited commit named in the PR body or the Linear comment (`auditedCommit`), and
  the commits that landed after it (human or Copilot-driven fixes).

Then classify, following `shift-learning-governance`:
- **Review findings accepted and fixed** (by the agent in convergence or by a
  human): what the implementer or auditor missed. Each becomes a concrete,
  reusable lesson ("when touching X, also Y", "the audit must check Z").
- **Review findings rejected**: record the rationale so the next cycle does not
  re-litigate them.
- **Human fixes after audit**: the strongest signal; derive what evidence the
  audit should have demanded.
- **Process observations**: time to merge, number of review rounds, CI
  failures, scope changes requested by the human.
- Non-product PRs (devops, workflow, skills): just note what changed in the
  runtime or skills; no product lesson.

Persist:
- concise lessons in Hermes memory (one entry per lesson, tagged with the PR
  and issue);
- project/technical lessons in Engram (project `shift-desoc`, type
  `decision`, `bugfix` or `discovery`, with file paths and the PR number);
- when a lesson recurs (same pattern in two or more PRs) or is high-confidence,
  open a **separate** skill-improvement proposal as `shift-learning-governance`
  prescribes — never edit skills silently, never mix it with product work.

Check the Linear side: the issue in the branch name should now be Done through
the native GitHub integration. If it is not, report it (do not close it
yourself unless the PR body carried the closing phrase and the integration
clearly missed it).

## 3. Hand over to the development loop

As the last action, trigger the development loop job so the next feature
starts while the backlog is fresh:

```bash
source /opt/data/shift/jobs.env   # DEV_LOOP_JOB_ID
nohup hermes cron run --accept-hooks "$DEV_LOOP_JOB_ID" >/opt/data/shift/dev-loop-trigger.log 2>&1 &
```

The loop has its own preflight (open-PR limit, auth, lock), so triggering it
is always safe; it will stop by itself when it must wait.

## 4. Acknowledge

Only after steps 1-3 succeeded for a PR (lessons persisted, dev loop
triggered), acknowledge it so the watcher stops handing it over:

```bash
/opt/data/scripts/shift-merge-ack.sh <pr-number> [<pr-number>...]
```

If any step failed, do not acknowledge that PR: it will be retried.

## Report

List per PR: lessons persisted (memory + Engram ids), rejected findings,
human fixes found, Linear state, and whether the dev loop was triggered. Keep
it short; it is delivered to Telegram.
