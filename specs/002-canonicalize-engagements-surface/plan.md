# Implementation Plan: Canonicalize Engagements Surface

**Branch**: `002-canonicalize-engagements-surface` | **Date**: 2026-03-05 | **Spec**: `specs/002-canonicalize-engagements-surface/spec.md`
**Input**: Feature specification from `/specs/002-canonicalize-engagements-surface/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Canonicalize the monorepo work-verification surface from deprecated `Claims`
naming to canonical `Engagements`, using minimal, safe changes that preserve
current behavior and strict domain separation (`Engagements` for work
verification, `claims` reserved for economic payout semantics).

The implementation will focus on:
- Manager route/component/query/label canonicalization
- Contract/address/ABI wiring alignment (`engagements` key + `Engagements.json`)
- Compatibility wrappers/redirects for legacy `/claims` paths during transition
- Test updates and documentation/status synchronization

No new protocol logic, verifier mechanics, marketplace expansion, treasury
changes, or community-management feature work is included.

## Technical Context

**Language/Version**: TypeScript (Next.js 16 / React 19), Solidity (unchanged), Node 22 tooling  
**Primary Dependencies**: Next.js App Router, wagmi/viem, graphql-request/TanStack Query, Ponder 0.7.x (consumer surface only)  
**Storage**: Existing on-chain state + Ponder Postgres projection (no schema migration planned)  
**Testing**: Vitest + Testing Library + MSW (`apps/web`), Ponder build checks (`apps/indexer`), Foundry regression safety (`forge:test`)  
**Target Platform**: Web Manager app + existing indexer/deployment metadata pipeline
**Project Type**: Monorepo vertical slice (contracts/indexer/app/docs with app-heavy changes)  
**Performance Goals**: No measurable regression in existing work-verification UX responsiveness; no additional network calls in baseline flows  
**Constraints**: Minimal diffs, preserve existing behavior, retain backward compatibility for legacy links during migration window, no drift from `deployments/*.json` or ABI sync assumptions  
**Scale/Scope**: Limited to naming canonicalization and integration hardening for work-verification surfaces; no protocol expansion

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Protocol infrastructure first: Confirm protocol primitives stay generic and
  vertical-specific behavior is pushed to app layers unless truly shared.
- Contract-first authority: Confirm no indexer/app shadow-authority path for
  permissions or state transitions.
- Security/invariant preservation: Enumerate affected invariants and privileged
  mutation paths (Governor/Timelock/AccessManager).
- Event/indexer discipline: List event/ABI changes, replay or migration impact,
  reorg handling, and indexer health implications.
- Monorepo vertical-slice scope: Document required updates across contracts,
  indexer, Manager app, downstream integration surface, tests, and docs.
- Project-management docs sync: Confirm whether this feature changes status,
  risks, priorities, architecture expectations, or workflows and, if yes,
  require synchronized updates to
  `.github/project-management/IMPLEMENTATION_STATUS.md` and
  `.github/project-management/STATUS_REVIEW.md`.
- Compatibility discipline: Identify breaking interface/event risks and required
  migration/versioning strategy for downstream dApps.

Status:
- Protocol infrastructure first: PASS
  - No protocol primitive changes; this is a Manager/integration canonicalization slice.
- Contract-first authority: PASS
  - No permission/state authority moved into app/indexer. Existing on-chain authority remains untouched.
- Security/invariant preservation: PASS
  - Invariants preserved: timelock authority unchanged, engagement verification flow unchanged, commerce/work separation maintained, no new privileged path.
- Event/indexer discipline: PASS
  - No required event schema changes. Indexer naming consistency and references reviewed for drift only.
- Monorepo vertical-slice scope: PASS
  - Planned updates cover app wiring/read-write paths, compatibility handling, tests, and status docs. Contracts are touched only as ABI/address consumption assumptions (no logic changes).
- Project-management docs sync: PASS
  - `.github/project-management/IMPLEMENTATION_STATUS.md` and `.github/project-management/STATUS_REVIEW.md` will be updated in same change set.
- Compatibility discipline: PASS
  - Temporary route compatibility strategy and integration rename guidance included; no breaking protocol interface changes.

## Project Structure

### Documentation (this feature)

```text
specs/002-canonicalize-engagements-surface/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── engagements-surface-contract.md
└── tasks.md
```

### Source Code (repository root)
```text
apps/indexer/
apps/web/
deployments/
.github/project-management/
neuromancer/
contracts/FEATURES.md
```

**Structure Decision**:
- App-heavy canonicalization with limited integration hardening in `apps/web`.
- Indexer contracts/schema remain stable unless naming-only references need alignment.
- Deployment/ABI assumptions validated against existing canonical `engagements` key and `Engagements.json`.
- Documentation synchronization performed in project-management artifacts and canonical system docs.

## Monorepo Impact Matrix

| Layer | Impacted? | Paths | Contract / Event / API Compatibility Notes |
|-------|-----------|-------|--------------------------------------------|
| Protocol Contracts | No (logic) / Yes (consumption assumptions) | `apps/web/lib/contracts.ts`, `deployments/*.json`, `apps/web/abis/` | Must consume `addresses.engagements` and `Engagements.json`; no on-chain logic change |
| Indexer (Ponder) | Maybe (naming alignment only) | `apps/indexer/src/index.ts`, `apps/indexer/ponder.schema.ts`, `apps/indexer/ponder.config.ts` | Schema/events expected unchanged; verify no claim-domain mislabels in integration surface |
| Manager App (Next.js) | Yes | `apps/web/app/**`, `apps/web/components/**`, `apps/web/lib/graphql/queries.ts`, `apps/web/lib/contracts.ts`, tests | Canonical route/label/query symbol updates; preserve behavior and temporary compatibility |
| Downstream dApp Surface | Yes (naming/compat) | Manager-facing route/query/export names | Introduce migration-safe aliases/redirects where needed; avoid abrupt breaking changes |
| Documentation | Yes | `.github/project-management/*.md`, `neuromancer/SHIFT_SYSTEM.md`, `contracts/FEATURES.md` (if changed), feature docs | Keep implementation/strategic status synchronized; reinforce engagement/claim semantic boundary |

## Implementation Design Decisions

1. Canonical naming target
- Make `Engagements` the primary term for work verification in navigation, page titles, component names, and user labels.

2. Route strategy
- Introduce/keep canonical `/engagements` routes as primary.
- Keep temporary compatibility for `/claims` via redirect/wrapper to avoid breaking legacy links.

3. Contract wiring strategy
- Replace Manager `claims` contract key/import assumptions with canonical `engagements` mapping.
- Resolve address through `deployments/*.json` `addresses.engagements` only.

4. Query/type symbol strategy
- Rename claim-oriented GraphQL symbols to engagement-oriented equivalents.
- Provide temporary alias exports only where needed to reduce churn and maintain transitional stability.

5. Semantic boundary protection
- Do not rename valid economic claim/payout semantics.
- Apply targeted renaming only to work-verification domain references.

6. File-path rename strategy
- Prefer staged compatibility wrappers over immediate destructive renames for routes/components used by current links/tests.
- Component/file internal names can be migrated progressively with wrappers to keep import stability.

## Risks And Mitigations

- Risk: Over-renaming economic claim contexts.
  - Mitigation: Explicit scope map + exclusion list from `research.md`; targeted grep review before merge.

- Risk: Broken route links from `/claims` bookmarks.
  - Mitigation: Compatibility redirect/wrapper + route tests.

- Risk: Contract integration break from key mismatch (`claims` vs `engagements`).
  - Mitigation: Contract config tests + runtime smoke check using active `deployments/*.json` manifest key presence.

- Risk: Drift between docs and implementation after rename.
  - Mitigation: Mandatory paired update of both status artifacts and quickstart verification step.

## Validation Strategy

1. Static/diff validation
- Search for deprecated work-verification `Claims` terms in active Manager surfaces.
- Confirm remaining `claim` terms are economic-only contexts.

2. Unit/integration validation
- Update and run web unit tests for renamed routes/components/queries.
- Add compatibility tests for legacy `/claims` path behavior if wrappers/redirects are used.

3. Integration wiring validation
- Validate `apps/web/lib/contracts.ts` uses `Engagements.json` and `addresses.engagements`.
- Build indexer to ensure no downstream break from naming consistency updates.

4. Regression safety
- Run Foundry tests to ensure no accidental protocol-layer regressions from ABI/wiring updates.

5. Documentation validation
- Verify `.github/project-management/IMPLEMENTATION_STATUS.md` and `.github/project-management/STATUS_REVIEW.md` are synchronized and reflect reduced drift.

## Definition Of Done (Feature-Specific)

- `Engagements` is canonical in all in-scope work-verification user-facing Manager surfaces.
- Manager contract config for work verification resolves through canonical `engagements` deployment key and `Engagements.json` ABI.
- Existing submit/review work-verification flows remain functional.
- Legacy `/claims` access is handled by compatibility path (redirect/wrapper) or explicitly sunset with migration notice.
- No economic claim semantics are incorrectly renamed.
- Tests pass for updated routes/components/wiring.
- Indexer build remains green with no schema/event regressions introduced by this slice.
- Both project-management status documents updated and synchronized in same change set.

## Transition Sunset Tracking

- Legacy `/claims` compatibility remains temporary and must carry a sunset condition.
- Sunset progress must be tracked in `.github/project-management/STATUS_REVIEW.md` release notes when compatibility is narrowed or removed.

## Post-Design Constitution Re-Check

- Protocol infrastructure first: PASS
- Contract-first authority: PASS
- Security/invariant preservation: PASS
- Event/indexer discipline: PASS
- Monorepo vertical-slice scope: PASS
- Project-management docs sync: PASS
- Compatibility discipline: PASS

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitution violations requiring justification.
