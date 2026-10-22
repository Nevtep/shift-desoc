---
name: shift-app-architecture
description: "Design the architecture of an approved ecosystem app on top of Shift: map it to protocol modules, separate on-chain truth from off-chain layers, find protocol gaps and raise them as Shift Manager issues, choose the stack with ADRs and M0 spikes, and get the architecture approved before any features, repo or code."
license: Apache-2.0
metadata:
  author: Shift
  version: "1.0"
  hermes:
    tags: ["shift", "mycelia", "architecture", "ecosystem", "conversation"]
---

# App architecture

Input: an approved brief (`shift-app-discovery`). Output: an approved
architecture document and ADRs that the feature map, the repo scaffold and
every PR then follow. You are the architect: decide like a senior engineer,
explain like a good consultant. Approve with the person only what touches the
product, the budget or the risk.

## 1. Ground it in the protocol

Read `shift-protocol-capabilities`, then the real contracts for every module
the brief uses (`contracts/modules/*.sol`, interfaces in
`contracts/modules/interfaces`) and the matrix in
`.github/project-management/IMPLEMENTATION_STATUS.md`. Recover Engram context
(project `shift-desoc`) before relying on any assumption. Preserve the
invariants in AGENTS.md: staged authority lifecycle, ParamController as the
single policy source keyed by `communityId`, no verifier staking, TreasuryAdapter
guardrails, commerce disputes separate from work verification, RevenueRouter
pull-based, indexer and app as derived layers that never bypass contract
authority.

## 2. Design

Write the document with these sections:
- **Context**: users, communities, scale for v1 and later, constraints.
- **Protocol mapping**: table of app concept → Shift module → how it is used
  → status (contract / indexer / Manager) → gap. Community model: what is a
  community, who is admin at first and when governance takes over.
- **Components**: on-chain (reused modules, any new module and why the
  existing ones do not fit), indexer projections/endpoints, app backend,
  frontend, external services (maps, payments, KYC, storage, notifications),
  each with responsibility, technology, where it runs, interfaces.
- **Data**: entities, which are on-chain truth vs derived/off-chain,
  ownership, privacy class (personal data never goes on-chain).
- **Key flows**: the 2–4 flows that define the product end to end, with the
  contract calls and events involved.
- **Quality attributes**: security, privacy, availability, gas and RPC cost,
  monthly infra cost estimate with assumptions.
- **Decisions**: one ADR per significant choice (own contracts vs compose
  existing, chain, indexer reuse, stack, hosting, fiat rails) with 2–3
  options, trade-offs, decision, consequences.
- **Human roles and compliance**: who must be a person (legal review,
  security audit for new contracts, domain expert, store accounts).
- **Test modes**: how each PR is tested on Base Sepolia and by whom,
  consistent with `QA: how to test` sections.
- **Risks and spikes**: the 2–4 things most likely to sink the product, each
  an M0 spike with a clear yes/no.
- **M0 foundation**: repo skeleton, CI, preview/deploy pipeline, Base Sepolia
  wiring, first protocol call from the app.

Feasibility, honestly: classify each element as supported today, needs
protocol work (name the Shift Manager issue or propose one), needs a person,
or out of reach now (propose the smaller version that proves the idea).

## 3. Raise protocol gaps where they belong

Anything the app needs from the protocol that is missing becomes (or links
to) an issue in **Shift Manager**, never in the app project: search
duplicates, reuse the Phase issue if one exists, label `domain:contracts`
when Solidity changes (high-risk; skipped by the autonomous loop unless a
human enables it). The app's issues relate to them; the app's milestone
sequence respects that dependency.

## 4. Review with the person

Send a short summary, not the document: what kind of app, the main pieces in
one line each, which Shift modules it relies on and their maturity, protocol
gaps and their effect on timing, monthly cost estimate, what needs other
people, the M0 spikes. Ask only decisions that are theirs (cost ceiling,
chain, fiat rails, must-have vs later). Then ask: "¿Aprobamos esta
arquitectura para definir las funcionalidades?".

## 5. Persist and hand over

On approval, store the architecture and ADRs in the Linear project (documents
or description) and Engram (`ecosystem/<slug>/architecture`, type
`decision`). Ask explicitly before creating the app's GitHub repo ("¿Creo el
repo `<owner>/<slug>`?") and do not create it without a yes; once it exists,
commit the documents as `docs/architecture.md` and `docs/decisions/`, and add
an `AGENTS.md` that points to Shift's workflow (ODD + RDD) and invariants.
Next, define the feature map: vertical features, milestones M0 Foundation,
M1 MVP, M2+, each with acceptance criteria and a `QA: how to test` section
(the same rules as `shift-feature-request`), created as issues in the app's
`PRD` project only after the person approves the map.

## Changing the architecture later

A change touching components, data, hosting, cost or protocol dependencies
gets a new ADR and an updated document in its own PR, approved like any other.
