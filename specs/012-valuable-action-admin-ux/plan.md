# Implementation Plan: ValuableAction Registry Admin UX + Projection Readiness

**Branch**: `[012-valuable-action-admin-ux]` | **Date**: 2026-04-10 | **Spec**: `/Users/core/Code/shift/specs/012-valuable-action-admin-ux/spec.md`
**Input**: Feature specification from `/Users/core/Code/shift/specs/012-valuable-action-admin-ux/spec.md`

## Summary

Deliver a community-scoped Valuable Action admin surface in Manager that is authority-honest (direct write only when on-chain authority exists, otherwise governance path), projection-aware (healthy/lagging/unavailable), and deterministic against canonical on-chain/event sources. Initial implementation targets no protocol ABI/event changes unless Phase 0 findings prove a hard blocker.

## Technical Context

**Language/Version**: TypeScript (apps/web, apps/indexer), Solidity ^0.8.24 (reference-only unless hard blocker), Node 22  
**Primary Dependencies**: Next.js 16, React 19, Ponder 0.7.17, GraphQL, viem/wagmi, OpenZeppelin 5.x  
**Storage**: On-chain state + Ponder projected Postgres/GraphQL read model  
**Testing**: Vitest (web), indexer integration/replay tests, Foundry tests only if contract changes are required  
**Target Platform**: Base Sepolia staging (primary), monorepo web/indexer runtime
**Project Type**: Monorepo vertical slice (indexer + Manager app + docs; contracts conditional)  
**Performance Goals**: Catalog/detail load with readiness signal in under 2s p95 on healthy indexer; readiness transitions reflected within polling window  
**Constraints**: No shadow authority; Governor/Timelock invariants preserved; no protocol redesign unless hard blocker is documented; maintain community isolation  
**Scale/Scope**: One new Manager feature slice for Valuable Action list/detail/admin + readiness, compatible with future Engagement consumer flows

## Constitution Check (Pre-Research)

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Protocol infrastructure first: **PASS**. Scope is app/indexer composition over existing protocol primitives; no vertical policy added to contracts by default.
- Contract-first authority: **PASS**. Plan requires runtime authority-mode derivation from deployed capabilities and explicit governance fallback.
- Security/invariant preservation: **PASS**. Privileged mutations remain Governor/Timelock or existing restricted direct-authority paths; no new bypass role introduced.
- Event/indexer discipline: **PASS (Conditional)**. Default path is no ABI/event change. If changed, replay/backfill and compatibility docs become mandatory gate.
- Monorepo vertical-slice scope: **PASS**. Plan includes indexer projections, Manager UX, tests, and docs; contracts are conditional and explicitly tracked.
- Project-management docs sync: **PASS**. If status/risk/workflow changes, update both `.github/project-management/IMPLEMENTATION_STATUS.md` and `.github/project-management/STATUS_REVIEW.md` in same change set.
- Compatibility discipline: **PASS**. Prefer additive GraphQL/app surfaces; mark any ABI/event break as explicit with migration instructions.

## Project Structure

### Documentation (this feature)

```text
specs/012-valuable-action-admin-ux/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── valuable-action-admin.graphql
│   └── valuable-action-admin.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
contracts/modules/
apps/indexer/
apps/web/
test/
docs/EN/
.github/project-management/
scripts/
```

**Structure Decision**: Execute as a no-ABI first vertical slice across `apps/indexer` + `apps/web` with additive projections and authority-aware UX. Touch `contracts/modules` and `test/` only if research exposes a proven blocker.

## Monorepo Impact Matrix

| Layer | Impacted? | Paths | Contract / Event / API Compatibility Notes |
|-------|-----------|-------|--------------------------------------------|
| Protocol Contracts | Conditional | `contracts/modules/ValuableActionRegistry.sol`, `test/*.t.sol` | No planned ABI/event changes. If required, classify as breaking/non-breaking and ship replay/backfill plan. |
| Indexer (Ponder) | Yes | `apps/indexer/src/index.ts`, `apps/indexer/ponder.schema.ts`, `apps/indexer/ponder.config.ts` | Add deterministic projection for Valuable Action lifecycle; preserve mapping from events to projected state. |
| Manager App (Next.js) | Yes | `apps/web/lib/graphql/queries.ts`, `apps/web/components/**`, `apps/web/hooks/**`, `apps/web/tests/unit/**` | Add list/detail/admin + readiness UX with explicit authority mode and gated actions. |
| Downstream dApp Surface | Yes | GraphQL query additions + existing on-chain events | Additive read API by default. No event signature change expected in default path. |
| Documentation | Yes | `docs/EN/Architecture.md`, `contracts/FEATURES.md`, `neuromancer/SHIFT_SYSTEM.md`, `.github/project-management/*` | Sync behavior, readiness semantics, and shipped status/risk updates. |

## Phase 0: Research Plan

### Unknowns Extracted

1. Authority detection strategy for create/edit/activate flows without shadow authority.
2. Projection readiness model and thresholds for healthy/lagging/unavailable.
3. Compatibility decision framework for no-ABI versus ABI/event change path.

### Research Outputs Required

1. `research.md` with explicit decision/rationale/alternatives for each unknown.
2. Hard gate statement on whether contract/event changes are necessary.

## Phase 1: Design And Contracts Plan

### Outputs

1. `data-model.md` with entities, validation rules, and transitions.
2. `contracts/valuable-action-admin.graphql` query/mutation contract for Manager consumers.
3. `contracts/valuable-action-admin.openapi.yaml` REST contract for readiness and authority introspection surfaces.
4. `quickstart.md` with implementation and validation sequence.

### Agent Context Update

Run:

```bash
.specify/scripts/bash/update-agent-context.sh copilot
```

## Constitution Check (Post-Design)

- Protocol infrastructure first: **PASS**. Design remains protocol-consumer focused, avoids introducing vertical policy to contract primitives.
- Contract-first authority: **PASS**. Authority modes are derived from on-chain capabilities; governance path is explicit when direct authority is absent.
- Security/invariant preservation: **PASS**. No new privileged path bypasses Governor/Timelock or existing contract restrictions.
- Event/indexer discipline: **PASS**. Projection model is event-driven with explicit readiness states and replay considerations.
- Monorepo vertical-slice scope: **PASS**. Design artifacts cover indexer, web, tests, and docs with conditional contract branch.
- Project-management docs sync: **PASS**. Required in execution checklist for behavior/risk/status changes.
- Compatibility discipline: **PASS**. Default path is additive and backward-compatible; ABI/event change path explicitly requires migration notes.

## Complexity Tracking

No constitution violations require exception handling for this planning phase.
