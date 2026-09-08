---
name: shift-pr-review-convergence
description: "Use when converging an existing Shift PR to human-review readiness. Independently evaluate GitHub Copilot review feedback, apply only justified fixes, validate HEAD, re-audit, and drive bounded Copilot re-review cycles. NOT an auto-accept-suggestions workflow."
license: Apache-2.0
metadata:
  author: Shift
  version: "1.0"
  hermes:
    tags: ["shift", "pr-review", "copilot", "audit", "convergence"]
---

# Shift PR review convergence

Iteratively bring an EXISTING Shift pull request to a state suitable for final
human review by independently evaluating GitHub Copilot code-review feedback,
applying only technically justified fixes, validating the resulting HEAD, and
requesting/re-reading Copilot re-reviews.

This is NOT an automatic "accept Copilot suggestions" skill. Copilot output is
advisory evidence, never authority.

## 1. Automated-review authority

- Copilot review comments, inline comments, suppressed comments, review
  summaries, and "Needs a closer look" assessments are advisory evidence only.
- Never assume a Copilot finding is correct because Copilot produced it.
- Independently inspect the relevant implementation, contracts, ABI semantics,
  tests, surrounding architecture, issue scope, AGENTS.md, and the current PR
  diff before deciding.
- Classify every finding as exactly one of:
  - `accepted_actionable`
  - `already_fixed`
  - `false_positive`
  - `valid_but_out_of_scope`
  - `uncertain_human_input`
- Record evidence and rationale for every classification.
- Do not generalize a finding beyond its demonstrated technical context.

## 2. Review-source completeness

For the target PR, inspect ALL relevant GitHub review evidence:

- PR metadata and current HEAD;
- all review submissions, not only unresolved inline threads;
- inline review comments and their resolved/outdated state;
- review bodies containing suppressed comments;
- the latest Copilot review body;
- earlier Copilot findings, including resolved findings, to detect regressions;
- human replies and resolutions;
- current CI/check status.

Do NOT assume "0 new comments" means Copilot is satisfied: a review may
contain suppressed findings and still say "Needs a closer look".

## 3. Existing human decisions

- Treat previously resolved comments and human changes as evidence.
- Re-open the technical question only when current code or a later review
  provides new evidence.
- Do not undo a human decision merely because Copilot repeats a prior concern.
- Learn the concrete rationale behind accepted and rejected findings.

## 4. Existing PR ownership

- Work only on the existing PR branch and its existing Shift worktree.
- Never create a second PR for review remediation.
- Never merge or enable auto-merge.
- Never modify unrelated Linear issues.
- Preserve the original issue scope unless a correctness fix is strictly
  necessary for that scope.

## 5. Evaluation phase (before editing)

1. Fetch current `origin/main`.
2. Fetch current PR HEAD.
3. Verify the local worktree matches that HEAD.
4. Inspect every current Copilot finding.
5. Produce a review matrix with columns:
   finding | classification | evidence | proposed action | files affected |
   tests required.
6. If a finding depends on uncertain product/architecture intent, classify it
   `uncertain_human_input` rather than guessing.

## 6. Remediation phase

- Apply only `accepted_actionable` findings.
- Use a fresh implementation child session for code changes.
- Keep fixes minimal and issue-scoped.
- Add regression tests for accepted correctness findings where practical.
- Do not edit locked contract architecture merely to satisfy a generic
  reviewer concern; reason from the real contract execution semantics.

## 7. Validation

- Run the relevant targeted tests.
- Run the repository-required PR checks.
- Compare against a clean current `origin/main` baseline when claiming a
  failure is pre-existing.
- Never label a failing test "pre-existing" unless reproduced from a clean
  worktree at the exact current base SHA.

## 8. Independent audit

After any remediation commit:

- invalidate any previous completeness audit;
- delegate a NEW independent audit in a fresh child session (never the
  implementer);
- require `auditedCommit == current PR HEAD` and `safeToPublish=true` before
  pushing the reviewed result as ready for another external review.

## 9. Copilot convergence loop

After a validated remediation is pushed:

- obtain a new Copilot review when possible;
- if repository automatic Copilot reviews are configured for new pushes, wait
  for the new review;
- otherwise attempt to request Copilot as reviewer through GitHub if
  supported;
- if an automated re-review cannot be requested, STOP and tell the human to
  request Re-review from GitHub;
- inspect the NEW review completely, including suppressed comments;
- maximum remediation/re-review cycles per invocation: 3;
- never loop indefinitely.

## 10. Definition of Copilot-converged

A PR is Copilot-converged only when ALL hold:

- CI/checks for the current HEAD are green;
- the latest Copilot review was produced for the current or post-remediation
  HEAD;
- the latest Copilot review does not report "Needs a closer look" or an
  equivalent material warning;
- there are no unclassified actionable Copilot findings;
- unresolved findings, if any, are explicitly classified `false_positive`,
  `valid_but_out_of_scope`, or `uncertain_human_input` with evidence.

Copilot convergence does NOT authorize merge. Final human review remains
mandatory.

## 11. Learning

At the end of each invocation persist concise project-scoped learning to
Engram:

- accepted Copilot findings and why;
- rejected findings and why;
- recurring reviewer blind spots;
- human decisions already present in the PR;
- tests that caught or disproved findings;
- new patterns worth incorporating into future audits.

Never persist secrets. Do not automatically modify repo-local audit skills
from a single finding; propose such skill changes only when a reusable pattern
is demonstrated (per shift-learning-governance).

## 12. Delegation lifecycle

- Never finish while a required child is pending.
- Critical stages are sequential:
  review evidence -> classification -> remediation -> independent audit ->
  push -> Copilot re-review -> reevaluation.
- Retry an interrupted required child once; after a second failure stop for
  human input.

## Output contract

Each invocation must return:

- current PR/HEAD;
- the review matrix;
- changes made;
- tests and CI results;
- new audit result;
- latest Copilot state;
- remaining human decisions;
- final state: `copilot_converged`, `needs_another_iteration`, or
  `human_input_required`.