---
name: shift-feature-request
description: "Handle requests for new functionality or changes in an existing product (the Shift protocol/Manager or an ecosystem app): refine outcome, acceptance criteria and QA steps with the person, check protocol feasibility, and record a vertical Feature/Improvement issue in the right Linear project."
license: Apache-2.0
metadata:
  author: Shift
  version: "1.0"
  hermes:
    tags: ["shift", "mycelia", "features", "linear", "conversation"]
---

# Feature request

Applies to a product that already exists. A brand-new product is
`shift-app-discovery`, not this skill.

## 1. Find the target

Contract changes → **Shift Protocol**. Manager app and indexer → **Shift
Manager**. Website → **Shift Marketing**. An ecosystem app → its **App: <name>**
project (all in team `SHI`; if it does not exist yet, this is an idea, not a
request: hand over to `shift-app-discovery`).

## 2. Shape it as one testable feature

Follow the backlog rules in AGENTS.md:
- **One issue = one testable feature**, a vertical slice: contract calls →
  indexer projection/endpoints → Manager route or app screen → a `QA: how to
  test (Base Sepolia)` section an admin can run. Projections, schemas and
  hooks are tasks inside the feature, never issues of their own.
- `Feature` for a new capability, `Improvement` for adjusting an existing
  one. Too big for one PR (days, not weeks) → propose a split into several
  features and confirm the split.

Propose a draft instead of interrogating field by field, then ask for
corrections:
- **Outcome**: what the user can do afterwards. **Why**: which goal it serves.
- **Acceptance criteria**: 3–7 numbered, observable statements including the
  main error and empty states.
- **QA: how to test**: numbered steps an admin can run on Base Sepolia.
- **Out of scope**.

## 3. Check feasibility against the protocol

Read `shift-protocol-capabilities`. For each part of the request, decide:
- **Supported**: contracts, indexer and UI exist → plain feature.
- **Contract exists, indexer/UI missing** → normal vertical slice; link the
  existing Phase issue instead of duplicating it (search first).
- **Needs contract change** → label `domain:contracts`, `workflow:needs-spec`,
  say it is high-risk and slower, and that the autonomous loop skips it unless
  a human enables it.
- **Conflicts with an invariant** (no verifier staking, TreasuryAdapter
  guardrails, ParamController as policy source, commerce disputes separate
  from work verification, staged authority lifecycle): say so honestly and
  propose the nearest design that respects the invariant. Never promise it.

## 4. Record it

Search for duplicates first; if one exists, comment on it. Otherwise create
the issue with `Feature` or `Improvement`, a readiness label
(`agent-ready` small and clear, `needs-spec` medium/large, `backlog` not yet
refined), project, the milestone of the phase it belongs to (Shift Manager and Shift Protocol;
phases 0–6 are the roadmap, lowest open phase first), and a priority the
person agrees with. Description: outcome, why, acceptance criteria,
QA section, out of scope, related issues. Use only existing labels.

## 5. Close the loop

Reply with the id, the readiness label and where it sits in the queue.
Explain that the dev loop works the lowest open phase first and Linear
priority within it, so a Medium feature in Phase 5 will not start before
earlier phases finish; offer to raise the priority only if the person gives a
reason. Do not start implementation yourself.
