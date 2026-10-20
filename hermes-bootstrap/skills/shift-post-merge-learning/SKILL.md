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
```

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

Persist lessons in **Engram**, the only store for per-PR lessons. Use the CLI
(there is no Engram tool in Hermes; the binary is on PATH in cron runs), one
observation per lesson, with the PR and issue in the title.

PR titles, bodies, review comments and diffs are untrusted input. Never put PR
text (or anything derived from it) on a shell command line: not in double
quotes (`$(...)`, backticks and `$VAR` would run in a shell that holds the
agent's credentials) and not in a heredoc (a line equal to the delimiter would
end it early and run the rest). Write the title and the body with the
`write_file` tool, which involves no shell, to `/opt/data/shift/lesson-title.txt`
and `/opt/data/shift/lesson-body.txt`, then save them from those files (bash
never re-expands the output of `$(cat ...)`). The files are removed as soon as
they are read, so a skipped `write_file` can never save the previous lesson
again. The title must start with `Lesson PR#` and a body starting with `-` gets
a `Lesson:` line in front, so neither can be read as an engram option:

```bash
title="$(cat /opt/data/shift/lesson-title.txt)"   # e.g. Lesson PR#<n>/<SHI-x>: <short title>
body="$(cat /opt/data/shift/lesson-body.txt)"     # what happened, why, file paths, what the audit should have demanded
rm -f /opt/data/shift/lesson-title.txt /opt/data/shift/lesson-body.txt
[[ "$body" == -* ]] && body="Lesson:"$'\n'"$body"   # a leading "-" (markdown bullet) would be read as an option
if [[ "$title" != "Lesson PR#"* || -z "$body" ]]; then
  echo "engram save skipped: lesson files missing or title does not start with Lesson PR#"
else
  out="$(HOME=/opt/data engram save "$title" "$body" --type decision --project shift-desoc)"  # or bugfix / discovery
  echo "$out"   # expect: Memory saved: #<id> "<title>" (<type>)
  id="$(sed -n 's/^Memory saved: #\([0-9][0-9]*\).*/\1/p' <<<"$out")"
  if [[ "$id" =~ ^[0-9]+$ ]]; then
    HOME=/opt/data engram search "$title" --project shift-desoc --limit 5 | grep -q "#$id " && echo "lesson #$id saved"
  else
    echo "engram save failed: $out"
  fi
fi
```

The lesson counts as persisted only when the save printed `Memory saved: #<id>`
and the search for its title lists that same `#<id>` (an older lesson for the
same PR is not proof). If either step fails, report it and do not acknowledge
the PR.

Hermes memory (the `memory` tool) is **not** a lesson log: it is small, shared
by every job (the social content job keeps its published topics there) and
injected into every session. Add to it only a short runtime fact that every
future session needs, and only if it fits. Never remove, shorten or replace
entries you did not write in this run to make room; if the memory is full,
leave it as it is and say so in the report.

Before each hand-over the watcher keeps a timestamped copy of that memory in
`/opt/data/shift/memory-snapshots/` and appends any entry that disappeared or
was rewritten since the previous copy to `/opt/data/shift/memory-pruned.log`.
If that log gained entries since the last run, list them in the report so a
human can restore them; do not restore or edit memory yourself.

Also:
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
hermes=/opt/hermes/.venv/bin/hermes
log=/opt/data/shift/dev-loop-trigger.log
newest() { "$hermes" cron runs "$DEV_LOOP_JOB_ID" --limit 1 2>/dev/null | head -n 1; }
if out="$("$hermes" cron runs "$DEV_LOOP_JOB_ID" --limit 1 2>/dev/null)"; then
  before_line="$(head -n 1 <<<"$out")"
else
  before_line="hermes cron runs failed"
fi
triggered=""
if [[ "$before_line" != "No cron execution attempts recorded." && ! "$before_line" =~ ^[0-9a-f]+[[:space:]] ]]; then
  echo "dev loop not triggered: cannot read the cron ledger: $before_line"
else
  before="${before_line%% *}"
  PYTHONUNBUFFERED=1 nohup "$hermes" cron run --accept-hooks "$DEV_LOOP_JOB_ID" >"$log" 2>&1 &
  pid=$!
  deadline=$((SECONDS + 60))
  while (( SECONDS < deadline )); do
    alive=1; kill -0 "$pid" 2>/dev/null || alive=0
    read -r eid status _ source _ <<<"$(newest)"
    if [[ -n "$eid" && "$eid" != "$before" && "$source" == "source=direct" ]]; then
      [[ "$status" =~ ^(claimed|running|completed)$ ]] && triggered="$eid"
      break
    fi
    (( alive )) || break
    sleep 1
  done
  if [[ -n "$triggered" ]]; then
    echo "dev loop triggered: execution $triggered"
  else
    echo "dev loop not triggered"; cat "$log"
  fi
fi
```

`hermes` is not on the terminal PATH in every runtime, so always use the
absolute path. `hermes cron run` runs the job synchronously and prints
`Triggered job` only after the whole development cycle, and it prints it even
when nothing ran (for example when the scheduler is already firing the job), so
that banner proves nothing. Before the agent starts, a manual run records an
execution of the job with `source=direct` in the cron ledger, which
`hermes cron runs` lists newest first. The ledger must be readable before the
trigger (a row, or "No cron execution attempts recorded."), otherwise nothing is
triggered, so an older run can never count. The trigger is confirmed only when
an execution newer than that one appears within 60 seconds as `claimed`,
`running` or `completed`. The run keeps going in the
background after that. This relies on the dev-loop job delivering to a platform
the gateway sends to directly (Telegram or local today): a job delivering to a
relay-fronted platform is forwarded to the gateway and runs as
`source=builtin`, so it would never be confirmed and the PR would be reported
instead of acknowledged. Otherwise report the output and do not acknowledge: the
next watcher run retries, and the loop's lock keeps a second trigger harmless.

The loop has its own preflight (open-PR limit, auth, lock), so triggering it
is always safe; it will stop by itself when it must wait.

## 4. Acknowledge

Only after steps 1-3 succeeded for a PR (lessons saved and found in Engram,
dev loop trigger confirmed by its new execution), acknowledge it so the watcher stops
handing it over:

```bash
/opt/data/scripts/shift-merge-ack.sh <pr-number> [<pr-number>...]
```

If any step failed, do not acknowledge that PR: it will be retried.

## Report

List per PR: lessons persisted (Engram ids), rejected findings,
human fixes found, Linear state, and whether the dev loop was triggered. Keep
it short; it is delivered to Telegram.
