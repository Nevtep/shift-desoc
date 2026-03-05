<!--
Sync Impact Report
- Version change: 1.0.0 -> 1.1.0
- Modified principles:
	- V. Monorepo Vertical-Slice Delivery (expanded with documentation synchronization mandate)
- Added sections:
	- None
- Removed sections:
	- None
- Templates requiring updates:
	- ✅ /Users/core/Code/shift/.specify/templates/plan-template.md
	- ✅ /Users/core/Code/shift/.specify/templates/spec-template.md
	- ✅ /Users/core/Code/shift/.specify/templates/tasks-template.md
	- ⚠ pending /Users/core/Code/shift/.specify/templates/commands/*.md (directory not present)
- Follow-up TODOs:
	- TODO(COMMAND_TEMPLATES): Add/update command templates if this repository introduces `.specify/templates/commands/` in the future.
-->

# Shift Monorepo Constitution

## Core Principles

### I. Protocol Infrastructure First
Shift MUST be developed as a protocol ecosystem, not as a single application.
The smart-contract layer is the shared infrastructure consumed by multiple
specialized dApps, including but not limited to the Next.js Manager.
Core protocol logic MUST remain generic, composable, and reusable across
verticals. Product-specific UX, workflows, and vertical policies MUST live in
apps unless they are true shared protocol primitives.

### II. Contract-First Authority
Smart contracts are the authoritative source of permissions, state transitions,
and business invariants. Indexers and applications MUST NOT become shadow
authority layers. Derived state in Ponder and app read models MUST be fully
reconstructible from chain state and canonical contract events.

### III. Security And Invariant Preservation
Security and invariant preservation MUST take precedence over feature velocity.
Privileged protocol mutations MUST flow through Governor/Timelock authority as
defined by deployed contract behavior. Implementations MUST preserve critical
invariants across governance, verification, commerce separation, treasury
controls, and revenue flows. Changes that increase unresolved risk MUST be
blocked unless explicitly accepted through governance and documented.

### IV. Event-Driven Deterministic Projection
Ponder is a deterministic projection layer and MUST be treated as non-
authoritative derived state. Contract events are a public integration surface;
event schema changes MUST include compatibility impact analysis, replay and
migration strategy, reorg-handling expectations, and indexer health visibility.
Any contract change affecting events MUST include corresponding indexer and app
impact handling before completion.

### V. Monorepo Vertical-Slice Delivery
Feature delivery MUST be defined and executed as monorepo vertical slices:
contracts, events/ABIs, indexer projections, Manager UX/tx flows, tests, and
documentation. No feature is complete if one layer is changed while dependent
layers remain inconsistent. The Manager MUST present only implemented protocol
capabilities and MUST tie high-impact actions to explicit contract calls and
real role boundaries. Documentation updates MUST keep `.github/project-management/IMPLEMENTATION_STATUS.md`
and `.github/project-management/STATUS_REVIEW.md` synchronized in the same
change set when status, risks, priorities, architecture expectations, or
workflow requirements change.

## Protocol Boundaries And Compatibility

- Breaking protocol interface/event changes MUST be rare, justified, and paired
	with explicit migration/compatibility plans for indexer and downstream dApps.
- Stable contract interfaces and event semantics SHOULD be preserved to support
	ecosystem dApps built on shared Shift primitives.
- Terminology in specs, code, docs, and UI MUST use current Shift language:
	Engagements (not Claims), ValuableActionSBT, VPS, PositionManager,
	RevenueRouter, RequestHub, Drafts, Governor/Timelock, and Target ROI.
- Conflict resolution order MUST be:
	1. Current smart contract behavior
	2. `neuromancer/SHIFT_SYSTEM.md`
	3. Accepted security requirements in `contracts/SECURITY_AUDIT.md` and
		 `specs/001-security-fixes/spec.md`
	4. `contracts/FEATURES.md`
	5. Feature-level approved specs

## Delivery, Testing, And Documentation Gates

- SpecKit-first is mandatory: work MUST start from a spec and maintain traceable
	contract/indexer/app/docs impact.
- Contracts MUST ship with unit/integration/security/invariant-minded tests for
	critical flows.
- Indexer changes MUST demonstrate deterministic replay viability, migration
	handling, reorg resilience, and operational health visibility.
- App changes MUST cover tx flows, role/permission gating, revert/error handling,
	and critical user paths tied to real contract support.
- `neuromancer/SHIFT_SYSTEM.md` and `contracts/FEATURES.md` MUST be kept aligned
	with shipped behavior; aspirational statements MUST NOT be presented as
	implemented functionality.

## Governance

This constitution governs the full Shift monorepo and supersedes conflicting
local conventions unless an explicit amendment is approved.

Amendment Policy:
- MAJOR: Remove/redefine core principles or alter authority/conflict order.
- MINOR: Add principles/sections or materially expand mandatory gates.
- PATCH: Clarify wording, examples, and non-semantic process details.

Compliance Review Expectations:
- Every feature plan MUST include constitution checks across protocol/indexer/app.
- Every task list MUST include cross-layer synchronization tasks where impacted.
- Reviews MUST reject changes that introduce authority drift, event/schema drift,
	or app behavior that exceeds actual contract support.
- Reviews MUST reject PRs that update one of
	`.github/project-management/IMPLEMENTATION_STATUS.md` or
	`.github/project-management/STATUS_REVIEW.md` without required companion
	updates when coordination-relevant content changed.

**Version**: 1.1.0 | **Ratified**: 2026-03-04 | **Last Amended**: 2026-03-05
