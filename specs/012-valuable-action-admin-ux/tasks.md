# Tasks: ValuableAction Registry Admin UX + Projection Readiness

**Input**: Design documents from `/specs/012-valuable-action-admin-ux/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/valuable-action-admin.graphql`, `contracts/valuable-action-admin.openapi.yaml`

**No-ABI Baseline**: This plan is strict no-ABI. Do not modify `contracts/**` source, ABI JSON artifacts, or event definitions unless a new hard blocker is proven later and documented.

**Tests**: Cross-layer tests are required for indexer + app surfaces touched by this feature.

## Phase 1: Setup

**Purpose**: Lock scope, test commands, and no-ABI guardrails before implementation.

- [X] T001 Create implementation preflight checklist and scope guard notes in `specs/012-valuable-action-admin-ux/quickstart.md`
- [X] T002 Add no-ABI guard assertion to indexer compatibility tests in `apps/indexer/test/unit/abi-event-compatibility.test.ts`
- [X] T003 [P] Add web regression test command notes for this feature in `specs/012-valuable-action-admin-ux/quickstart.md`
- [X] T004 [P] Add indexer replay validation command notes for this feature in `specs/012-valuable-action-admin-ux/quickstart.md`

---

## Phase 2: Foundational (Blocking)

**Purpose**: Shared building blocks required before any user story work.

**Critical**: User story phases must not begin until these tasks are complete.

- [X] T005 Define Valuable Action projection entity schema (community-scoped, stable IDs, lifecycle metadata) in `apps/indexer/ponder.schema.ts`
- [X] T006 Define projection readiness model and status mapping (`healthy|lagging|unavailable`) in `apps/web/lib/community-overview/types.ts`
- [X] T007 [P] Add shared Valuable Action GraphQL result types and DTO mappers in `apps/web/lib/graphql/queries.ts`
- [X] T008 [P] Implement shared community boundary guard utility for action routes/payloads in `apps/web/hooks/useValuableActionBoundary.ts`
- [X] T009 Implement fail-closed authority mode evaluator (`direct_write|governance_required|blocked`) in `apps/web/hooks/useValuableActionAuthorityMode.ts`
- [X] T010 [P] Add unit tests for authority evaluator fail-closed behavior in `apps/web/tests/unit/hooks/use-valuable-action-authority-mode.test.tsx`
- [X] T011 [P] Add unit tests for community boundary guard behavior in `apps/web/tests/unit/hooks/use-valuable-action-boundary.test.tsx`
- [X] T012 [P] Add unit tests for readiness status mapping and stale handling in `apps/web/tests/unit/hooks/use-valuable-action-readiness.test.tsx`

**Checkpoint**: Foundational complete; user stories can proceed in priority order.

---

## Phase 3: User Story 1 - Browse Canonical Action Catalog (Priority: P1)

**Goal**: Deliver community-scoped Valuable Action catalog and detail views mapped to canonical projected/on-chain state.

**Independent Test**: In a single community, catalog and detail only show in-community actions, expose canonical lifecycle fields, and present readiness without shadow overrides.

### Tests (write first)

- [X] T013 [P] [US1] [indexer] Add lifecycle projection integration test for create/update/activate/deactivate ordering in `apps/indexer/test/integration/valuable-action-lifecycle-projection.test.ts`
- [X] T014 [P] [US1] [indexer] Add replay determinism test for Valuable Action projections in `apps/indexer/test/integration/valuable-action-replay-determinism.test.ts`
- [X] T015 [P] [US1] [indexer] Add community boundary projection test ensuring no cross-community leakage in `apps/indexer/test/integration/valuable-action-community-boundary.test.ts`
- [X] T016 [P] [US1] [app] Add catalog list rendering and empty-state tests in `apps/web/tests/unit/components/valuable-actions/valuable-action-list.test.tsx`
- [X] T017 [P] [US1] [app] Add action detail canonical field mapping tests in `apps/web/tests/unit/components/valuable-actions/valuable-action-detail.test.tsx`
- [X] T018 [P] [US1] [app] Add route boundary guard tests for cross-community action IDs in `apps/web/tests/unit/routes/community-valuable-action-boundary.test.tsx`

### Implementation

- [X] T019 [US1] [indexer] Add `valuable_actions` projection table/entity and indexes in `apps/indexer/ponder.schema.ts`
- [X] T020 [US1] [indexer] Add ValuableActionRegistry lifecycle event handlers in `apps/indexer/src/index.ts`
- [X] T021 [US1] [indexer] Add catalog/detail REST endpoints with strict `communityId` scoping in `apps/indexer/src/index.ts`
- [X] T022 [US1] [indexer] Verify `apps/indexer/ponder.config.ts` already provides current ValuableActionRegistry coverage and document the verification result in `specs/012-valuable-action-admin-ux/quickstart.md`
- [X] T023 [US1] [app] Add Valuable Action catalog and detail GraphQL queries in `apps/web/lib/graphql/queries.ts`
- [X] T024 [US1] [app] Implement catalog data hook with deterministic empty-state handling in `apps/web/hooks/useValuableActionCatalog.ts`
- [X] T025 [US1] [app] Implement detail data hook with canonical projection/on-chain mapping in `apps/web/hooks/useValuableActionDetail.ts`
- [X] T026 [US1] [app] Build catalog list component with readiness badge in `apps/web/components/valuable-actions/valuable-action-list.tsx`
- [X] T027 [US1] [app] Build detail component with lifecycle and rule metadata in `apps/web/components/valuable-actions/valuable-action-detail.tsx`
- [X] T028 [US1] [app] Add community-scoped Valuable Actions route container in `apps/web/app/community/[id]/valuable-actions/page.tsx`

**Checkpoint**: US1 is independently testable and MVP-complete.

---

## Phase 4: User Story 2 - Create And Edit Action Definitions (Priority: P2)

**Goal**: Provide create/edit flows that route by authority mode and never imply unauthorized direct writes.

**Independent Test**: Create/edit attempts deterministically resolve to direct write, governance proposal authoring, or blocked with explicit reason.

### Tests (write first)

- [X] T029 [P] [US2] [app] Add authority routing matrix tests for create/edit modes in `apps/web/tests/unit/components/valuable-actions/valuable-action-admin-routing.test.tsx`
- [X] T030 [P] [US2] [app] Add governance-required routing tests to existing proposal entry flow in `apps/web/tests/unit/components/valuable-actions/valuable-action-governance-routing.test.tsx`
- [X] T031 [P] [US2] [app] Add blocked unauthorized operation feedback tests in `apps/web/tests/unit/components/valuable-actions/valuable-action-admin-blocked.test.tsx`
- [X] T032 [P] [US2] [app] Add form payload preview/validation tests before submit in `apps/web/tests/unit/components/valuable-actions/valuable-action-form-preview.test.tsx`

### Implementation

- [X] T033 [US2] [app] Implement Valuable Action create/edit form model and validators in `apps/web/components/valuable-actions/valuable-action-form.tsx`
- [X] T034 [US2] [app] Implement mutation orchestration for create/edit with authority-mode branching in `apps/web/hooks/useValuableActionAdminMutations.ts`
- [X] T035 [US2] [app] Route `governance_required` mode into existing proposal composer flow in `apps/web/components/valuable-actions/valuable-action-admin-panel.tsx`
- [X] T036 [US2] [app] Implement direct-write submission path only when mode is `direct_write` in `apps/web/components/valuable-actions/valuable-action-admin-panel.tsx`
- [X] T037 [US2] [app] Implement explicit fail-closed blocked state UX with reason codes in `apps/web/components/valuable-actions/valuable-action-admin-panel.tsx`
- [X] T038 [US2] [app] Add action summary payload preview component prior to submit/propose in `apps/web/components/valuable-actions/valuable-action-submit-preview.tsx`

**Checkpoint**: US2 independently works with authority-honest create/edit routing.

---

## Phase 5: User Story 3 - Manage Activation State Safely (Priority: P3)

**Goal**: Enable safe activate/deactivate actions with authority gating and deterministic projected-state reflection.

**Independent Test**: Activation toggles reflect proper authority mode, blocked users are denied with explicit reasons, and status changes become visible after projection catch-up.

### Tests (write first)

- [X] T039 [P] [US3] [indexer] Add activation transition projection test (deactivate->activate roundtrip) in `apps/indexer/test/integration/valuable-action-activation-roundtrip.test.ts`
- [X] T040 [P] [US3] [app] Add activation control mode gating tests in `apps/web/tests/unit/components/valuable-actions/valuable-action-activation-controls.test.tsx`
- [X] T041 [P] [US3] [app] Add unauthorized activation attempt blocked tests in `apps/web/tests/unit/components/valuable-actions/valuable-action-activation-blocked.test.tsx`
- [X] T042 [P] [US3] [app] Add post-change projection catch-up status tests in `apps/web/tests/unit/components/valuable-actions/valuable-action-activation-readiness.test.tsx`

### Implementation

- [X] T043 [US3] [app] Implement activation/deactivation action controls in `apps/web/components/valuable-actions/valuable-action-activation-controls.tsx`
- [X] T044 [US3] [app] Wire activation mutations through authority-mode brancher in `apps/web/hooks/useValuableActionAdminMutations.ts`
- [X] T045 [US3] [app] Implement deterministic optimistic/pending state with projection confirmation messaging in `apps/web/components/valuable-actions/valuable-action-admin-panel.tsx`
- [X] T046 [US3] [app] Enforce community boundary checks for all activation payloads in `apps/web/hooks/useValuableActionBoundary.ts`
- [X] T047 [US3] [indexer] Ensure lifecycle handlers persist activation timestamps and tx metadata for status traceability in `apps/indexer/src/index.ts`
- [X] T048 [US3] [app] Add Engagement compatibility adapter preserving stable `actionId` usage in `apps/web/lib/valuable-actions/engagement-compat.ts`

**Checkpoint**: US3 independently supports safe activation management.

---

## Phase 6: User Story 4 - Projection Readiness Transparency (Priority: P3)

**Goal**: Show truthful readiness (`healthy`, `lagging`, `unavailable`) across catalog/detail/admin operations.

**Independent Test**: Simulated lag/unavailable conditions produce explicit readiness and deterministic operator guidance; healthy state clears warnings.

### Tests (write first)

- [X] T049 [P] [US4] [indexer] Add readiness endpoint contract test for status transitions in `apps/indexer/test/integration/valuable-action-readiness-endpoint.test.ts`
- [X] T050 [P] [US4] [app] Add readiness banner rendering tests for all states in `apps/web/tests/unit/components/valuable-actions/valuable-action-readiness-banner.test.tsx`
- [X] T051 [P] [US4] [app] Add stale projection behavior tests ensuring no authoritative stale display in `apps/web/tests/unit/components/valuable-actions/valuable-action-stale-state-guard.test.tsx`
- [X] T052 [P] [US4] [app] Add governance-required routing while lagging tests in `apps/web/tests/unit/components/valuable-actions/valuable-action-governance-lagging.test.tsx`

### Implementation

- [X] T053 [US4] [indexer] Add Valuable Action readiness endpoint and watermark derivation in `apps/indexer/src/index.ts`
- [X] T054 [US4] [app] Implement readiness hook consuming indexer readiness + health in `apps/web/hooks/useValuableActionReadiness.ts`
- [X] T055 [US4] [app] Build readiness banner/panel with explicit operator guidance in `apps/web/components/valuable-actions/valuable-action-readiness-banner.tsx`
- [X] T056 [US4] [app] Integrate readiness gating into catalog/detail/admin containers in `apps/web/components/valuable-actions/valuable-action-admin-panel.tsx`
- [X] T057 [US4] [app] Add deterministic fallback read path for detail when projection unavailable in `apps/web/hooks/useValuableActionDetail.ts`
- [X] T058 [US4] [app] Ensure readiness state is surfaced on route-level page in `apps/web/app/community/[id]/valuable-actions/page.tsx`

**Checkpoint**: US4 independently verifies truthful readiness transparency.

---

## Phase 7: Polish & Docs

**Purpose**: Cross-story regression hardening, docs synchronization, and ship-readiness validation.

- [X] T059 [P] Add cross-story regression suite for boundary guards, readiness, and authority routing in `apps/web/tests/unit/components/valuable-actions/valuable-action-regression-suite.test.tsx`
- [X] T060 [P] Add indexer compatibility smoke test for Valuable Action schema/API additions in `apps/indexer/test/integration/valuable-action-schema-compatibility-smoke.test.ts`
- [X] T061 Run web unit test gate and capture results in `specs/012-valuable-action-admin-ux/quickstart.md`
- [X] T062 Run indexer integration/replay test gate and capture results in `specs/012-valuable-action-admin-ux/quickstart.md`
- [X] T063 Update architecture/verification docs for shipped Valuable Action admin and readiness behavior in `docs/EN/Architecture.md`
- [X] T064 Update feature inventory for Manager/indexer Valuable Action admin surfaces in `contracts/FEATURES.md`
- [X] T065 Update system narrative for no-ABI implementation outcome in `neuromancer/SHIFT_SYSTEM.md`
- [X] T066 [P] If implementation status/risk changed, synchronize `.github/project-management/IMPLEMENTATION_STATUS.md` and `.github/project-management/STATUS_REVIEW.md`
- [X] T067 Define and document indexer replay/backfill runbook for Valuable Action projection schema additions in `specs/012-valuable-action-admin-ux/quickstart.md`
- [X] T068 Measure and document catalog/detail readiness p95 performance against plan target in `specs/012-valuable-action-admin-ux/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1) has no dependencies.
- Foundational (Phase 2) depends on Setup and blocks all user stories.
- User stories (Phases 3-6) depend on Foundational completion.
- Polish (Phase 7) depends on all selected user stories being complete.

### User Story Dependencies

- US1 (P1) depends only on Foundational and is the MVP.
- US2 (P2) depends on US1 catalog/detail surfaces for context and action selection.
- US3 (P3) depends on US1 detail surfaces and US2 authority routing primitives.
- US4 (P3) depends on US1 projection data and can run in parallel with late US2/US3 work after foundational readiness primitives exist.

### Strict Story Order for Single-Thread Execution

1. US1
2. US2
3. US3
4. US4

### Parallel Opportunities

- `[P]` tasks within each phase can run concurrently when file touch points do not overlap.
- Indexer and web test tasks in each story can be run in parallel before implementation tasks.
- US4 readiness endpoint/hook work can proceed in parallel with US3 activation UX once shared authority/boundary utilities are stable.

---

## Parallel Execution Examples

### US1

- Task T013 in `apps/indexer/test/integration/valuable-action-lifecycle-projection.test.ts`
- Task T016 in `apps/web/tests/unit/components/valuable-actions/valuable-action-list.test.tsx`
- Task T018 in `apps/web/tests/unit/routes/community-valuable-action-boundary.test.tsx`

### US2

- Task T029 in `apps/web/tests/unit/components/valuable-actions/valuable-action-admin-routing.test.tsx`
- Task T031 in `apps/web/tests/unit/components/valuable-actions/valuable-action-admin-blocked.test.tsx`
- Task T032 in `apps/web/tests/unit/components/valuable-actions/valuable-action-form-preview.test.tsx`

### US3

- Task T039 in `apps/indexer/test/integration/valuable-action-activation-roundtrip.test.ts`
- Task T040 in `apps/web/tests/unit/components/valuable-actions/valuable-action-activation-controls.test.tsx`
- Task T042 in `apps/web/tests/unit/components/valuable-actions/valuable-action-activation-readiness.test.tsx`

### US4

- Task T049 in `apps/indexer/test/integration/valuable-action-readiness-endpoint.test.ts`
- Task T050 in `apps/web/tests/unit/components/valuable-actions/valuable-action-readiness-banner.test.tsx`
- Task T052 in `apps/web/tests/unit/components/valuable-actions/valuable-action-governance-lagging.test.tsx`

---

## Implementation Strategy

### MVP First (US1)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1) end to end.
3. Validate independent test criteria for US1 before continuing.

### Incremental Delivery

1. Ship US1 catalog/detail.
2. Add US2 create/edit authority routing.
3. Add US3 activation management.
4. Add US4 readiness transparency hardening.
5. Finish Phase 7 cross-cutting regressions and docs sync.

### Validation Gates

- No contract source modifications under `contracts/**` for this feature.
- No ABI/event surface changes in `apps/web/abis/**` or `apps/indexer/abis/**`.
- Community boundary guard tests pass.
- Indexer replay determinism tests pass.
- Readiness state tests pass for `healthy|lagging|unavailable`.
- Governance-required routing tests pass.
- Blocked unauthorized operation tests pass.
- Activation state change projection tests pass.
- Engagement compatibility tests preserve stable action identifiers.
