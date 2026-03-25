# Tasks: Community Overview Dashboard

**Input**: Design documents from `/specs/005-community-overview-dashboard/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: App-layer tests are REQUIRED for this feature per MR-004 (route scoping, indexer states, chain-read failures, authority gating, CTA routing correctness).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare feature-local scaffolding and shared route contracts used by all stories.

- [X] T001 Create overview routing contract constants in `apps/web/lib/community-overview/routes.ts`
- [X] T002 [P] Create overview UI/domain types in `apps/web/lib/community-overview/types.ts`
- [X] T003 [P] Add deterministic parameter mapping constants from spec table in `apps/web/lib/community-overview/parameter-mapping.ts`
- [X] T040 [P] Add `INDEXER_LAG_THRESHOLD_SECONDS = 600` shared constant for overview health in `apps/web/lib/community-overview/constants.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build shared read/composition primitives that all user stories depend on.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [X] T004 Implement indexer health resolver (`synced|lagging|error|unknown`) in `apps/web/hooks/useIndexerHealth.ts`
- [X] T005 [P] Implement deterministic parameter formatters (seconds/bps/integer + unavailable fallback) in `apps/web/lib/community-overview/formatters.ts`
- [X] T041 [P] Implement shared module address shortener formatter (`0x1234...abcd`) in `apps/web/lib/community-overview/formatters.ts`
- [X] T006 [P] Implement authority gating helper for `Edit parameters` in `apps/web/lib/community-overview/authority.ts`
- [X] T007 Implement activity preview query helpers (`N=3` and community-scoped filters) in `apps/web/lib/community-overview/activity.ts`
- [X] T008 [P] Extend GraphQL query exports for overview preview operations in `apps/web/lib/graphql/queries.ts`
- [X] T009 Add shared overview test fixtures/builders for health/modules/parameters/previews in `apps/web/tests/unit/community-overview/fixtures.ts`

**Checkpoint**: Foundational primitives are ready; user stories can proceed.

---

## Phase 3: User Story 1 - Community-Scoped Overview Hub (Priority: P1)

**Goal**: Render `/communities/[communityId]` as a strict community-scoped overview hub with authoritative config summaries and permission-aware actions.

**Independent Test**: Load multiple community IDs and verify header identity, health badge, modules summary, parameters summary, and disabled `Edit parameters` for unauthorized wallets.

### Tests for User Story 1

- [X] T010 [P] [US1] Add route-scope and no-default-leakage tests for overview page in `apps/web/tests/unit/routes/community-overview-page.test.tsx`
- [X] T011 [P] [US1] Add modules summary status tests (`present|missing`, no-bytecode -> missing) in `apps/web/tests/unit/community-overview/module-summary.test.tsx`
- [X] T012 [P] [US1] Add deterministic parameter summary tests (mapping + unavailable fallback + formatting) in `apps/web/tests/unit/community-overview/parameter-summary.test.tsx`
- [X] T013 [P] [US1] Add authority/action CTA tests for `View parameters` and `Edit parameters` route contract, disabled `Coming soon`, and non-navigation when unavailable in `apps/web/tests/unit/community-overview/authority-actions.test.tsx`
- [X] T042 [P] [US1] Add module address shortening format tests (`0x1234...abcd`) in `apps/web/tests/unit/community-overview/address-formatting.test.ts`
- [X] T043 [P] [US1] Add FR-012 regression test with href allowlist: internal links must start with `/communities/<id>` (or be empty/disabled), and external help/docs links are allowed only when explicitly marked external (for example `target="_blank"` or a dedicated external-link marker) in `apps/web/tests/unit/routes/community-overview-nav-allowlist.test.tsx`

### Implementation for User Story 1

- [X] T014 [P] [US1] Create overview header component (`communityId`, name fallback, network/environment, health, actions) in `apps/web/components/communities/overview/overview-header.tsx`
- [X] T015 [P] [US1] Create modules summary component with bytecode-backed status and deterministic shortened address rendering in `apps/web/components/communities/overview/module-summary.tsx`
- [X] T016 [P] [US1] Create parameter summary component with source markers and `last checked` in `apps/web/components/communities/overview/parameter-summary.tsx`
- [X] T017 [US1] Implement overview data composition hook (modules + parameters + authority + health) in `apps/web/hooks/useCommunityOverview.ts`
- [X] T018 [US1] Replace placeholder route with overview container wired strictly to route `communityId` in `apps/web/app/communities/[communityId]/page.tsx`
- [X] T019 [US1] Remove legacy non-community-scoped links from overview route implementation in `apps/web/app/communities/[communityId]/page.tsx`
- [X] T020 [US1] Add overview empty/unavailable state UI for not-found or partial chain failures in `apps/web/components/communities/overview/overview-state.tsx`

**Checkpoint**: User Story 1 is independently functional and testable.

---

## Phase 4: User Story 2 - Recent Activity Previews with Honest State (Priority: P2)

**Goal**: Show latest-3 Requests, Drafts, and Proposals with truthful synced/lagging/error/empty states and deterministic CTA behavior.

**Independent Test**: Simulate indexer `synced`, `lagging`, `error`, and empty datasets; verify row count, warnings/errors, retry affordance, and CTA targets.

### Tests for User Story 2

- [X] T021 [P] [US2] Add activity panel tests for synced state and exact `N=3` rows per panel in `apps/web/tests/unit/community-overview/activity-panels.test.tsx`
- [X] T022 [P] [US2] Add lagging/error/unknown state tests with retry affordance and threshold assertions using `INDEXER_LAG_THRESHOLD_SECONDS` in `apps/web/tests/unit/community-overview/activity-health-states.test.tsx`
- [X] T023 [P] [US2] Add CTA routing tests for Requests/Drafts/Proposals preview actions in `apps/web/tests/unit/community-overview/activity-cta-routing.test.tsx`

### Implementation for User Story 2

- [X] T024 [P] [US2] Create activity preview panel component (identifier/title, status, timestamp, CTAs) in `apps/web/components/communities/overview/activity-panel.tsx`
- [X] T025 [P] [US2] Create activity previews section component for Requests/Drafts/Proposals in `apps/web/components/communities/overview/activity-previews.tsx`
- [X] T026 [US2] Implement activity preview data hook using GraphQL + health composition in `apps/web/hooks/useCommunityOverviewActivity.ts`
- [X] T027 [US2] Integrate activity previews into the overview route container in `apps/web/app/communities/[communityId]/page.tsx`
- [X] T028 [US2] Add/update MSW GraphQL and health handlers for overview activity scenarios in `apps/web/tests/unit/mocks/handlers.ts`

**Checkpoint**: User Story 2 is independently functional and testable.

---

## Phase 5: User Story 3 - Community Navigation with Capability Signaling (Priority: P3)

**Goal**: Provide all six community-scoped tabs, keep unavailable sections visible but disabled with `Coming soon`, and avoid dead-end CTAs to unimplemented routes.

**Independent Test**: Verify tab visibility/order/routes plus disabled state and `Coming soon` labeling for unavailable sections and unimplemented destinations.

### Tests for User Story 3

- [X] T029 [P] [US3] Add tab rendering tests for fixed order and visibility of all six sections in `apps/web/tests/unit/community-overview/section-tabs.test.tsx`
- [X] T030 [P] [US3] Add disabled `Coming soon` behavior tests for unavailable sections in `apps/web/tests/unit/community-overview/section-availability.test.tsx`
- [X] T031 [P] [US3] Add tests ensuring CTAs to unimplemented destinations are disabled/non-actionable in `apps/web/tests/unit/community-overview/unimplemented-cta-guard.test.tsx`

### Implementation for User Story 3

- [X] T032 [P] [US3] Create section tabs component with deterministic route contract in `apps/web/components/communities/overview/section-tabs.tsx`
- [X] T033 [US3] Implement availability matrix for tabs/CTAs with `Coming soon` labels in `apps/web/lib/community-overview/availability.ts`
- [X] T034 [US3] Integrate tabs and capability signaling into overview route container in `apps/web/app/communities/[communityId]/page.tsx`

**Checkpoint**: User Story 3 is independently functional and testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency checks, docs alignment, and validation passes across all stories.

- [X] T035 [P] Add overview-focused GraphQL query unit coverage for latest-3 helper usage in `apps/web/lib/graphql/queries.test.ts`
- [X] T036 [P] Add hook-level health behavior coverage for `useIndexerHealth` in `apps/web/tests/unit/community-overview/indexer-health.test.ts`
- [X] T037 Run web test suite and capture feature evidence updates in `specs/005-community-overview-dashboard/quickstart.md`
- [X] T038 [P] Update manager-app screen documentation for overview behavior and hybrid truth model in `docs/EN/Architecture.md`
- [X] T039 [P] Update `.github/project-management/IMPLEMENTATION_STATUS.md` and `.github/project-management/STATUS_REVIEW.md` together only if shipped behavior changes status/risk/workflow (DT-002)
- [X] T044 [P] Run lightweight compliance checks for Overview scope: terminology guard (no legacy terms), no protocol changes under `contracts/`, and no indexer schema/event semantic changes unless explicitly planned

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies.
- **Phase 2 (Foundational)**: Depends on Phase 1 and blocks all user stories.
- **Phase 3 (US1)**: Depends on Phase 2.
- **Phase 4 (US2)**: Depends on Phase 2.
- **Phase 5 (US3)**: Depends on Phase 2.
- **Phase 6 (Polish)**: Depends on completed target stories.

### User Story Dependencies

- **US1 (P1)**: Independent after foundational completion.
- **US2 (P2)**: Independent after foundational completion.
- **US3 (P3)**: Independent after foundational completion.

### Within Each User Story

- Tests must be written before implementation and should fail first.
- Data/model hooks before page integration.
- Page integration before story-level regression validation.

---

## Parallel Execution Examples

### User Story 1

- Run in parallel: `T010`, `T011`, `T012`, `T013`.
- Run in parallel: `T014`, `T015`, `T016`.

### User Story 2

- Run in parallel: `T021`, `T022`, `T023`.
- Run in parallel: `T024`, `T025`.

### User Story 3

- Run in parallel: `T029`, `T030`, `T031`.
- Run in parallel: `T032` with test tasks before final integration `T034`.

---

## Implementation Strategy

### Suggested execution order

1. Complete Phase 1 and Phase 2.
2. Deliver US1, US2, and US3 in priority order (or in parallel after foundational completion if capacity allows).
3. Validate strict route scoping, chain-backed summaries, lagging-threshold behavior, and authority gating before final polish.

### Incremental Delivery

1. Add US2 for activity previews with honest health/error behavior.
2. Add US3 for section tabs and capability signaling.
3. Finish with cross-cutting tests/docs and validation evidence updates.

### Validation Commands

- `pnpm -C apps/web test`
- `pnpm -C apps/web lint`
- `pnpm -C apps/web typecheck`

---

## Notes

- All overview routing in this feature is community-scoped under `/communities/[communityId]`.
- Legacy global home navigation and query-param scoped links are out of contract on this route.
- Contracts and indexer schema changes are out of scope unless strictly required by additive read compatibility.
