# Implementation Plan: Community Overview Dashboard

**Branch**: `005-community-overview-dashboard` | **Date**: 2026-03-25 | **Spec**: `/specs/005-community-overview-dashboard/spec.md`
**Input**: Feature specification from `/specs/005-community-overview-dashboard/spec.md`

## Summary

Implement `/communities/[communityId]` as the strict community-scoped Overview hub with:
- deterministic routing contract for CTAs/tabs,
- hybrid truth model (indexer previews + on-chain authoritative config),
- explicit authority gating for privileged actions,
- honest lag/error handling that never hides chain-backed config when available.

No protocol mutation logic is added; this is a read-focused Manager vertical slice.

## Technical Context

**Language/Version**: TypeScript (Next.js App Router, React 19), Node 22  
**Primary Dependencies**: Next.js 16, React, wagmi/viem, TanStack Query, graphql-request  
**Storage**: N/A for feature state (reads from chain + indexer projection)  
**Testing**: Vitest + Testing Library (apps/web), existing integration tests  
**Target Platform**: Web (desktop + mobile responsive) on Base Sepolia-connected Manager app
**Project Type**: Monorepo web feature slice (`apps/web` + optional additive indexer surface)  
**Performance Goals**: Overview remains interactive with bounded list payloads (`N=3` per panel), no unbounded loops on client  
**Constraints**: Must preserve contract-first authority, no default-community leakage, no legacy `?communityId=` links from overview, no protocol behavior change  
**Scale/Scope**: Single overview route + community navigation contract + read model composition

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase 0 Gate

- Protocol infrastructure first: **PASS**. No new protocol primitive; behavior remains app-layer composition.
- Contract-first authority: **PASS**. Privileged affordances are gated from on-chain/wiring authority signals; indexer is non-authoritative.
- Security/invariant preservation: **PASS**. No privileged mutation path added; Governor/Timelock/AccessManager invariants unchanged.
- Event/indexer discipline: **PASS**. No required event/ABI changes. Health/read usage is additive and backward-compatible.
- Monorepo vertical-slice scope: **PASS**. Scope explicitly includes app route, hybrid reads, tests, and docs updates when needed.
- Project-management docs sync: **PASS (conditional)**. If status/risk/workflow changes from shipped behavior, update both project-management docs together.
- Compatibility discipline: **PASS**. No breaking interface/event changes planned.

## Project Structure

### Documentation (this feature)

```text
specs/005-community-overview-dashboard/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── community-overview.graphql
│   └── community-overview.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
apps/web/
  app/communities/[communityId]/
  components/communities/
  hooks/
  lib/graphql/
apps/indexer/
  src/index.ts
contracts/
docs/
test/
```

**Structure Decision**: Implement as a Manager-first route composition in `apps/web`, reusing existing hooks (`useCommunityModules`, `useGraphQLQuery`) and existing GraphQL query surface. Keep contracts untouched; indexer changes additive only if strictly required for health/freshness signaling.

## Monorepo Impact Matrix

| Layer | Impacted? | Paths | Contract / Event / API Compatibility Notes |
|-------|-----------|-------|--------------------------------------------|
| Protocol Contracts | No (read-only) | `contracts/**` (reference only) | No ABI/event changes; no authority surface changes |
| Indexer (Ponder) | Maybe (additive only) | `apps/indexer/src/index.ts` | Existing GraphQL and `/api/health` already usable; any change must be additive |
| Manager App (Next.js) | Yes | `apps/web/app/communities/[communityId]/page.tsx`, `apps/web/components/communities/**`, `apps/web/hooks/**`, `apps/web/lib/graphql/queries.ts` | Enforce routing contract and hybrid read strategy; no legacy navigation on overview |
| Downstream dApp Surface | No breaking change | GraphQL operations + `/api/health` usage | Read contract only; compatible with current query schema |
| Documentation | Yes (feature docs) | `specs/005-community-overview-dashboard/*`, conditional `.github/project-management/*` | Project-management docs updated together if status/risk/workflow changes |

## Phase Plan

### Phase 0: Research Completion
- Resolved all clarifications for data truth model, authority gating, route contract enforcement, and indexer health strategy.
- Output: `research.md`.

### Phase 1: Design And Contracts
- Produce explicit data entities, validation rules, and state transitions for overview UI.
- Define read contracts for GraphQL preview queries and health endpoint usage.
- Output: `data-model.md`, `contracts/community-overview.graphql`, `contracts/community-overview.openapi.yaml`, `quickstart.md`.

### Phase 2: Implementation Planning (stop point for this command)
- Define concrete implementation tasks (later via `/speckit.tasks`) for:
  - route shell replacement,
  - header/health/actions composition,
  - modules + parameter summaries,
  - previews + tabs + CTA routing,
  - authority and failure-state tests.

## Post-Design Constitution Check

- Protocol infrastructure first: **PASS**. Design remains app composition; no protocol broadening.
- Contract-first authority: **PASS**. `CommunityRegistry` and `ParamController` remain authoritative.
- Security/invariant preservation: **PASS**. No new privileged mutation path introduced.
- Event/indexer discipline: **PASS**. Contracts unchanged; indexer usage is additive/read-only.
- Monorepo vertical-slice scope: **PASS**. App + tests + docs captured; optional indexer adjustments bounded.
- Project-management docs sync: **PASS (conditional)**. Explicitly retained requirement to sync both files together if changed.
- Compatibility discipline: **PASS**. No breaking API/event surface planned.

## Complexity Tracking

No constitution violations requiring justification.
