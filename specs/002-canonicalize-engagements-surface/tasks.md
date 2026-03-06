# Tasks: Canonicalize Engagements Surface

**Input**: Design documents from `/specs/002-canonicalize-engagements-surface/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/engagements-surface-contract.md`, `quickstart.md`

**Tests**: Cross-layer tests are required for impacted layers in this feature slice, with focus on Manager route compatibility, contract wiring smoke coverage, and engagement flow regression.

**Organization**: Tasks are grouped by user story so each story is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependencies)
- **[Story]**: User story label (`[US1]`, `[US2]`, `[US3]`)
- Every task includes explicit file path(s) and success check

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Lock feature scope and test targets before editing production code.

- [X] T001 Create a canonicalization scope map and exclusion list in `specs/002-canonicalize-engagements-surface/research.md`; Success: map explicitly marks work-verification surfaces to rename and economic claim contexts to preserve.
- [X] T002 [P] Capture impacted Manager files and compatibility targets in `specs/002-canonicalize-engagements-surface/plan.md`; Success: route, component, query, ABI, and docs paths match current repo structure.
- [X] T003 [P] Document execution commands in `specs/002-canonicalize-engagements-surface/quickstart.md`; Success: includes web tests, indexer build, forge regression, and grep/scan checks.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish compatibility and wiring strategy that all stories depend on.

**CRITICAL**: Complete this phase before user-story implementation.

- [X] T004 Define legacy route compatibility behavior for `/claims` in `specs/002-canonicalize-engagements-surface/contracts/engagements-surface-contract.md`; Success: redirect/wrapper strategy and sunset condition are explicit.
- [X] T005 [P] Add contract-wiring acceptance criteria in `specs/002-canonicalize-engagements-surface/contracts/engagements-surface-contract.md`; Success: requires `addresses.engagements` and `apps/web/abis/Engagements.json` with no `Claims.json` dependency.
- [X] T006 [P] Add terminology-boundary validation criteria in `specs/002-canonicalize-engagements-surface/data-model.md`; Success: rules explicitly forbid renaming economic/revenue claim semantics.
- [X] T007 Define grep baseline patterns and exclusion rules in `specs/002-canonicalize-engagements-surface/quickstart.md`; Success: includes canonical work-verification scan paths and explicit economic-claim exclusions without executing final gate.
- [X] T031 Add authority-drift validation in `specs/002-canonicalize-engagements-surface/quickstart.md`; Success: confirms no new privileged flows, no timelock/governor authority changes, and no app/indexer shadow-authority introduced by this feature.

**Checkpoint**: Foundation ready. User stories can proceed.

---

## Phase 3: User Story 1 - Engagements Language In User Flows (Priority: P1) 🎯 MVP

**Goal**: Canonicalize work-verification UX language to Engagements while preserving flow behavior.

**Independent Test**: Visiting canonical routes, submitting work, and reviewing items works unchanged except terminology; legacy `/claims` remains reachable via compatibility handling.

### Tests for User Story 1

- [X] T008 [P] [US1] [app] Add/extend route compatibility tests in `apps/web/tests/unit/routes/claims-compatibility.test.tsx`; Success: verifies `/claims` and `/claims/[claimId]` resolve via redirect/wrapper to canonical Engagements behavior.
- [X] T009 [P] [US1] [app] Update list/detail UI tests in `apps/web/components/claims/claim-list.test.tsx` and `apps/web/components/claims/claim-detail.test.tsx`; Success: assertions validate Engagements wording and preserved rendering/state behavior.
- [X] T010 [P] [US1] [app] Update submit flow regression test in `apps/web/tests/unit/components/claim-submit-form.test.tsx`; Success: submit action still succeeds with Engagements wording and unchanged transaction path assumptions.

### Implementation for User Story 1

- [X] T011 [US1] [app] Create canonical routes in `apps/web/app/engagements/page.tsx` and `apps/web/app/engagements/[engagementId]/page.tsx`; Success: both pages render list/detail workflow with Engagements metadata/title copy.
- [X] T012 [US1] [compat] Convert legacy routes in `apps/web/app/claims/page.tsx` and `apps/web/app/claims/[claimId]/page.tsx` into compatibility wrappers/redirects; Success: old links keep working without presenting Claims as primary canonical naming.
- [X] T013 [US1] [app] Canonicalize in-scope home/navigation copy in `apps/web/app/page.tsx`; Success: work-verification entry point and labels use Engagements language.
- [X] T014 [US1] [app] Canonicalize work-verification component copy in `apps/web/components/claims/claim-list.tsx`, `apps/web/components/claims/claim-detail.tsx`, and `apps/web/components/claims/claim-submit-form.tsx`; Success: user-facing strings refer to Engagements and behavior is unchanged.
- [X] T015 [US1] [app] Update in-scope cross-link references that target work verification in `apps/web/app/marketplace/offers/[offerId]/page.tsx`; Success: links point to canonical Engagements route while preserving user navigation.

**Checkpoint**: User Story 1 is independently functional and testable.

---

## Phase 4: User Story 2 - Integration Surface Alignment (Priority: P2)

**Goal**: Align Manager integration-facing contract/query surfaces to canonical Engagements naming.

**Independent Test**: Contract config resolves via `addresses.engagements` + `Engagements.json`; query symbols and consumers align to engagement domain without breaking flows.

### Tests for User Story 2

- [X] T016 [P] [US2] [app] Add contract wiring smoke test in `apps/web/lib/contracts.test.ts`; Success: validates `getContractConfig("engagements")` resolves addresses from active `deployments/*.json` manifests and uses `apps/web/abis/Engagements.json` ABI.
- [X] T017 [P] [US2] [app] Add GraphQL symbol compatibility test in `apps/web/lib/graphql/queries.test.ts`; Success: engagement query exports are canonical and any transitional aliases remain functionally equivalent.
- [X] T018 [P] [US2] [indexer] Run naming-alignment verification on `apps/indexer/src/index.ts`, `apps/indexer/ponder.config.ts`, and `apps/indexer/ponder.schema.ts`; Success: produce a check result showing whether work-verification claim terminology appears in active indexer integration surface.

### Implementation for User Story 2

- [X] T019 [US2] [app] Replace deprecated contract mapping in `apps/web/lib/contracts.ts`; Success: removes `Claims.json` dependency, introduces canonical `engagements` contract entry, and reads `addresses.engagements` from deployment JSON.
- [X] T020 [US2] [app] Ensure ABI inventory consistency in `apps/web/abis/**`; Success: `Engagements.json` is the active work-verification ABI and no live import path requires `Claims.json`.
- [X] T021 [US2] [app] Canonicalize work-verification query/type exports in `apps/web/lib/graphql/queries.ts`; Success: Engagements-focused query/type names become primary while preserving safe transitional aliases where needed.
- [X] T022 [US2] [app] Update consumer imports/usages in `apps/web/components/claims/claim-list.tsx`, `apps/web/components/claims/claim-detail.tsx`, and route pages under `apps/web/app/**`; Success: all in-scope consumers compile against canonical Engagements query/type/contract names.
- [ ] T023 [US2] [indexer] If and only if T018 finds work-verification claim terminology in active indexer integration paths, apply naming-only alignment updates in `apps/indexer/src/index.ts`, `apps/indexer/ponder.config.ts`, and `apps/indexer/ponder.schema.ts`; Success: indexer build passes with unchanged schema/event behavior.

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Status And Documentation Synchronization (Priority: P3)

**Goal**: Keep implementation and strategy docs synchronized with canonical Engagements terminology.

**Independent Test**: Status and architecture/reference docs consistently describe Engagements for work verification and preserve economic claim semantics.

### Tests for User Story 3

- [X] T024 [P] [US3] [docs] Add a documentation consistency checklist entry in `specs/002-canonicalize-engagements-surface/quickstart.md`; Success: checklist explicitly verifies paired updates and terminology boundary correctness.

### Implementation for User Story 3

- [X] T025 [US3] [docs] Update implementation status in `.github/project-management/IMPLEMENTATION_STATUS.md`; Success: reflects Engagements canonicalization progress and resolved drift items.
- [X] T026 [US3] [docs] Update strategic status in `.github/project-management/STATUS_REVIEW.md`; Success: same release notes and risk posture as implementation status with updated date.
- [X] T027 [US3] [docs] Update canonical system references in `neuromancer/SHIFT_SYSTEM.md` and `contracts/FEATURES.md` where behavior wording changed; Success: documentation language matches shipped Engagements surface and keeps economic claims separate.

**Checkpoint**: All user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Validation

**Purpose**: Final hardening and release-readiness checks across stories.

- [X] T028 [P] Run deprecated-term scan for work-verification surfaces and semantic-preservation check using grep targets from `specs/002-canonicalize-engagements-surface/quickstart.md`; Success: no canonical work-verification `Claims` naming remains in in-scope files, and economic claim contexts are intentionally preserved.
- [ ] T029 [P] Execute full validation commands and record outputs in `specs/002-canonicalize-engagements-surface/quickstart.md`; Success: `pnpm --filter @shift/web test:unit`, `pnpm --filter @shift/indexer build`, and `pnpm forge:test` pass.
- [X] T030 Final release notes/update summary in `specs/002-canonicalize-engagements-surface/plan.md`; Success: includes compatibility window status, migration guidance, and explicit non-goals confirmation.
- [X] T032 Finalize Engagements naming transition contract in `specs/002-canonicalize-engagements-surface/plan.md`; Success: documents temporary `/claims` compatibility window, deprecation notice, and explicit sunset condition for deprecated claim-named work-verification symbols.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies.
- **Phase 2 (Foundational)**: Depends on Phase 1 and blocks all user-story execution.
- **Phase 3 (US1)**: Depends on Phase 2.
- **Phase 4 (US2)**: Depends on Phase 2; can run in parallel with US1 if staffed.
- **Phase 5 (US3)**: Depends on US1 and US2 completion to document final shipped state.
- **Phase 6 (Polish)**: Depends on all user stories.

### User Story Dependencies

- **US1 (P1)**: Independent after Foundational; delivers MVP UX canonicalization.
- **US2 (P2)**: Independent after Foundational; aligns integration surfaces.
- **US3 (P3)**: Depends on US1 and US2 outputs for synchronized final status reporting.

### Within Each User Story

- Write/update tests first and ensure they fail for the intended pre-change condition.
- Apply implementation changes next.
- Re-run story-specific tests before moving to next story.

### Parallel Opportunities

- Setup tasks `T002-T003` can run in parallel.
- Foundational tasks `T005-T007` can run in parallel.
- US1 test tasks `T008-T010` can run in parallel.
- US2 test tasks `T016-T018` can run in parallel.
- Documentation updates `T025-T027` can run in parallel, then reconciled together.
- Polish tasks `T028-T029` can run in parallel.

---

## Parallel Example: User Story 1

```bash
# Parallel test prep for US1
T008 apps/web/tests/unit/routes/claims-compatibility.test.tsx
T009 apps/web/components/claims/claim-list.test.tsx + apps/web/components/claims/claim-detail.test.tsx
T010 apps/web/tests/unit/components/claim-submit-form.test.tsx
```

## Parallel Example: User Story 2

```bash
# Parallel integration checks for US2
T016 apps/web/lib/contracts.test.ts
T017 apps/web/lib/graphql/queries.test.ts
T018 apps/indexer/src/index.test.ts (or equivalent naming-alignment assertion)
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1 and Phase 2.
2. Deliver US1 (Phase 3) with compatibility route coverage.
3. Validate route and submit/review regression tests.
4. Demo canonical Engagements UX.

### Incremental Delivery

1. US1 canonical UX and compatibility routing.
2. US2 integration surface alignment (contracts + queries + consumers).
3. US3 synchronized status/docs updates.
4. Final scan and full command validation in Phase 6.

### Safety Guardrails

- Preserve behavior and avoid protocol expansion.
- Do not blur economic claim semantics.
- Keep deployment address resolution JSON-driven; never hardcode addresses.
- Keep `/claims` functional during compatibility window.

---

## Notes

- `[P]` tasks touch different files and can be run concurrently.
- This plan intentionally avoids unrelated refactors and broad renames outside scoped work-verification surfaces.
- `apps/indexer/*` changes are conditional and should be applied only when naming-alignment checks prove necessary.
