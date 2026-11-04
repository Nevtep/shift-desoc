---
name: shift-bug-intake
description: "Handle bug reports sent in chat (Telegram or terminal): clarify, deduplicate, always record a Linear Bug in the right project (Shift Protocol for contracts, Shift Manager for the Manager/indexer, Shift Marketing for the website, the app's own project for an app), and tell the person the issue id. Never changes code."
license: Apache-2.0
metadata:
  author: Shift
  version: "1.0"
  hermes:
    tags: ["shift", "mycelia", "bugs", "linear", "conversation"]
---

# Bug intake

Rule zero: **every report becomes a Linear issue before any code changes**,
even a one-line fix. This skill only records and routes; fixing is done by
the normal ODD/RDD flow (`shift-autonomous-development`).

## 1. Understand the report

For each distinct problem in the message collect:
- **Where**: Manager route, contract/module, indexer endpoint, or which app
  and screen. Ask for the PR or preview link if unclear
  (`gh pr list --repo "${SHIFT_REPO_FULL_NAME:-Nevtep/shift-desoc}"` for Shift;
  for an app, resolve and query that app's own repository).
- **Steps** to reproduce, **expected vs actual**, evidence (screenshots,
  error text, tx hash, network, wallet address, community id).
- **Kind**: defect (does not do what was agreed) or change request (does
  what was agreed but they want otherwise). Check the related issue's
  acceptance criteria and `QA: how to test` section: a "bug" that matches the
  agreed behavior is a change request, so hand over to `shift-feature-request`
  and say so kindly.

Ask at most three questions at a time, only what you need. One message may
hold several problems: handle each as its own item.

## 2. Classify the surface

Use the code, not the UI, as truth (AGENTS.md): a missing button does not
prove a missing capability. Decide the layer:

| Symptom | Layer | Extra handling |
| --- | --- | --- |
| Reverts, wrong state, wrong event, access/role/treasury/ParamController behavior | contract | label `domain:contracts`, **priority at least High**, mention it is high-risk; never propose a fix in chat |
| Data missing/stale/wrong in Manager but chain is right | indexer | note the event/handler suspected |
| UI, wizard, route, copy | Manager | |
| An ecosystem app screen/flow | app | goes to that app's `App: <name>` project |

Security-looking reports (funds at risk, authority bypass, key exposure): do
not detail them in a public GitHub issue or PR. Create the Linear issue as
Urgent, write only what is needed to reproduce privately, and tell the
operator to look at it now.

## 3. Record it in Linear

- Search first (`list_issues` with `query`) in the target project; if the
  same problem exists, add the report as a comment and tell the person.
- Defect → label `Bug`. Change → `Improvement`, new capability → `Feature`.
  List labels first (`list_issue_labels`) and use only existing ones; never
  invent labels. Readiness: `workflow:agent-ready` when the fix is clear and
  small, `workflow:needs-spec` when design is needed, `workflow:backlog` when
  you could not gather enough to refine it.
- Project (always team `SHI`): contract bugs → **Shift Protocol**;
  Manager UI/wizards and indexer → **Shift Manager**; website → **Shift
  Marketing**; an app → its **App: <name>** project. Set the milestone of the
  phase the affected feature belongs to when the project has it.
- Title: the observable problem ("Housing reservation refund shows 0 for
  partial cancellation"), not the guessed cause.
- Description sections: `Reported by` (name, date, channel), `Steps to
  reproduce`, `Expected`, `Actual`, `Evidence`, `Environment` (network,
  commit/preview, community id), `Related` (parent issue, PR), `Acceptance
  criteria` (what "fixed" means), `QA: how to test (Base Sepolia)`.
- Priority from impact: loses/locks funds or breaks authority → Urgent;
  blocks the core loop → High; breaks a feature → High/Medium; annoying →
  Medium; cosmetic → Low. Relate to the parent feature issue ("related"), not
  as a sub-issue.

## 4. Close the loop

Reply per item with the Linear id and title right away, the priority you
set and why, and what governs when work starts. Do not promise a next-cycle
fix: the dev loop ranks Shift Manager and Shift Protocol issues by milestone
(lowest open phase first) and only then by priority, so a High bug in a later
phase can wait behind earlier-phase work; `domain:contracts` issues are
skipped unless `SHIFT_ALLOW_CONTRACT_ISSUES=true`; `needs-spec` ones get an
ODD document first; app bugs are outside this queue until that app has its
own development flow. Say plainly that you did not change any code. If the
person reports it is still broken after a fix, reopen the same issue with the
new evidence instead of creating another.
