# Tasks: Community Coordination Hub And Overview CTA Safety

**Input**: Design documents from `/specs/006-coordination-hub-cta-fix/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/ui-routing-contract.md`

**Tests**: Focused app-layer tests are REQUIRED for this feature (route existence, scoped links, create-form fixed community context, mismatch guards, and overview CTA non-navigation behavior).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Align implementation boundaries and test harness before feature coding.

- [X] T001 Confirm route single-source contract in `specs/006-coordination-hub-cta-fix/contracts/ui-routing-contract.md` and lock implementation to exactly 7 routes.
- [X] T002 Build implementation checklist from `specs/006-coordination-hub-cta-fix/plan.md` and `specs/006-coordination-hub-cta-fix/quickstart.md` for app-only scope.
- [X] T003 [P] Verify target files and baseline test locations in `apps/web/app/communities/[communityId]/coordination/**`, `apps/web/components/requests/**`, `apps/web/components/drafts/**`, and `apps/web/tests/unit/**`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared component extension points used across multiple stories.

**⚠️ CRITICAL**: No user story implementation starts until this phase is complete.

- [X] T004 Add scoped detail link-builder support in `apps/web/components/requests/request-list-item.component.tsx` and `apps/web/components/requests/request-list.container.tsx`.
- [X] T005 [P] Add scoped detail link-builder support in `apps/web/components/drafts/draft-list.tsx`.
- [X] T006 [P] Add fixed-community and redirect props in `apps/web/components/requests/request-create-form.tsx`.
- [X] T007 [P] Add fixed-community and redirect props in `apps/web/components/drafts/draft-create-form.tsx`.
- [X] T008 Add detail-level scoped link and mismatch extension props in `apps/web/components/requests/request-detail.container.tsx`, `apps/web/components/requests/request-detail-drafts.component.tsx`, and `apps/web/components/drafts/draft-detail.tsx`.

**Checkpoint**: Shared primitives for scoped wrappers, fixed community create flows, and mismatch rendering are ready.

---

## Phase 3: User Story 1 - Community Coordination Navigation Works End-To-End (Priority: P1) 🎯 MVP

**Goal**: Ensure all 7 community-scoped coordination routes exist and render correctly from Overview navigation.

**Independent Test**: Opening and navigating within `/communities/[communityId]/coordination` and its Requests/Drafts routes never returns 404 and shows expected wrapper-level UI.

### Tests for User Story 1

- [X] T009 [P] [US1] Add route existence coverage for all 7 routes in `apps/web/tests/unit/routes/community-coordination-routes-exist.test.ts`.
- [X] T010 [P] [US1] Add coordination hub rendering/cta contract test in `apps/web/tests/unit/routes/community-coordination-hub.test.tsx`.
- [X] T048 [P] [US1] Add equal-visual-importance assertion for Requests and Drafts hub cards in `apps/web/tests/unit/routes/community-coordination-hub.test.tsx` by verifying both cards share the same structural wrapper class/layout token.

### Implementation for User Story 1

- [X] T011 [US1] Implement coordination top bar component in `apps/web/components/communities/coordination-top-bar.tsx` with back-to-overview and health state.
- [X] T012 [US1] Implement hub route wrapper in `apps/web/app/communities/[communityId]/coordination/page.tsx`.
- [X] T013 [P] [US1] Implement requests list wrapper route in `apps/web/app/communities/[communityId]/coordination/requests/page.tsx`.
- [X] T014 [P] [US1] Implement request create wrapper route in `apps/web/app/communities/[communityId]/coordination/requests/new/page.tsx`.
- [X] T015 [P] [US1] Implement request detail wrapper route in `apps/web/app/communities/[communityId]/coordination/requests/[requestId]/page.tsx`.
- [X] T016 [P] [US1] Implement drafts list wrapper route in `apps/web/app/communities/[communityId]/coordination/drafts/page.tsx`.
- [X] T017 [P] [US1] Implement draft create wrapper route in `apps/web/app/communities/[communityId]/coordination/drafts/new/page.tsx`.
- [X] T018 [P] [US1] Implement draft detail wrapper route in `apps/web/app/communities/[communityId]/coordination/drafts/[draftId]/page.tsx`.
- [X] T019 [US1] Keep Community Overview Coordination tab enabled and routed in `apps/web/lib/community-overview/routes.ts` and `apps/web/lib/community-overview/availability.ts`.

**Checkpoint**: Coordination hub and all required community-scoped wrapper routes are reachable and render.

---

## Phase 4: User Story 2 - Requests And Drafts Flows Stay Community-Scoped (Priority: P1)

**Goal**: Keep list/create/detail workflows scoped to route community with read-only community context in create forms.

**Independent Test**: Requests/Drafts list rows and create flows on scoped routes only navigate within `/communities/[communityId]/coordination/**` and never leak to global routes.

### Tests for User Story 2

- [X] T020 [P] [US2] Add scoped request list row-link assertions in `apps/web/components/requests/request-list.test.tsx`.
- [X] T021 [P] [US2] Add scoped draft list row-link assertions in `apps/web/components/drafts/draft-list.test.tsx`.
- [X] T022 [P] [US2] Add request create fixed-community + redirect tests in `apps/web/components/requests/request-create-form.test.tsx`.
- [X] T023 [P] [US2] Add draft create fixed-community + redirect tests in `apps/web/components/drafts/draft-create-form.test.tsx`.

### Implementation for User Story 2

- [X] T028 [US2] Pass fixed community context and scoped success redirects from wrappers in `apps/web/app/communities/[communityId]/coordination/requests/new/page.tsx` and `apps/web/app/communities/[communityId]/coordination/drafts/new/page.tsx`.
- [X] T029 [US2] Pass scoped detail link builders from wrappers in `apps/web/app/communities/[communityId]/coordination/requests/page.tsx` and `apps/web/app/communities/[communityId]/coordination/drafts/page.tsx`.

**Checkpoint**: Scoped lists and create flows are route-bound and community input is non-editable in scoped pages.

---

## Phase 5: User Story 4 - Overview CTAs Avoid Dead Navigation (Priority: P1)

**Goal**: Ensure Overview CTAs never 404 by rendering only valid links for implemented paths and disabled non-link controls for out-of-scope destinations.

**Independent Test**: Requests/Drafts CTAs navigate to scoped routes; Proposals/View parameters are disabled Coming soon non-links; Edit parameters remains permission-gated and non-navigable when disabled.

### Tests for User Story 4

- [X] T030 [P] [US4] Add disabled proposals CTA non-navigation test in `apps/web/tests/unit/community-overview/activity-proposals-disabled.test.tsx`.
- [X] T031 [P] [US4] Add header action gating/non-navigation test in `apps/web/tests/unit/community-overview/authority-actions.test.tsx`.
- [X] T032 [P] [US4] Add activity panel enabled/disabled rendering contract test in `apps/web/components/communities/overview/activity-panel.test.tsx`.
- [X] T049 [P] [US4] Add routing-contract allowlist test in `apps/web/tests/unit/routes/community-routing-allowlist.test.ts` asserting Overview Requests/Drafts hrefs match exact scoped targets, Proposals/View parameters render as non-links, and no alternate coordination paths are emitted.

### Implementation for User Story 4

- [X] T033 [US4] Update overview action state types for structured CTA states in `apps/web/lib/community-overview/types.ts`.
- [X] T034 [US4] Set requests/drafts enabled and proposals disabled states in `apps/web/hooks/useCommunityOverviewActivity.ts`.
- [X] T035 [US4] Render disabled panel CTAs as disabled non-link controls in `apps/web/components/communities/overview/activity-panel.tsx`.
- [X] T036 [US4] Set `View parameters` disabled Coming soon and preserve edit permission-gating in `apps/web/hooks/useCommunityOverview.ts`.
- [X] T037 [US4] Render disabled header actions as disabled non-link controls in `apps/web/components/communities/overview/overview-header.tsx`.

**Checkpoint**: Overview CTA behavior is no-404 and contract-compliant for enabled and disabled actions.

---

## Phase 6: User Story 3 - Detail Pages Enforce Mismatch Safety (Priority: P2)

**Goal**: Add explicit mismatch guard behavior and keep cross-links between request and draft details community-scoped.

**Independent Test**: When entity community differs from route community, detail page shows explicit mismatch banner and correction link; request<->draft cross-links stay scoped.

### Tests for User Story 3

- [X] T038 [P] [US3] Add request detail mismatch + scoped draft cross-link tests in `apps/web/components/requests/request-detail.test.tsx`.
- [X] T039 [P] [US3] Add draft detail mismatch + scoped request cross-link tests in `apps/web/components/drafts/draft-detail.test.tsx`.

### Implementation for User Story 3

- [X] T042 [US3] Pass expected community and cross-link builders from detail wrappers in `apps/web/app/communities/[communityId]/coordination/requests/[requestId]/page.tsx` and `apps/web/app/communities/[communityId]/coordination/drafts/[draftId]/page.tsx`.

**Checkpoint**: Detail mismatch safety and scoped cross-links are fully functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency checks, focused validation run, and documentation synchronization if status changed.

- [ ] T043 [P] Update shared test fixtures for community-aware draft/request payloads in `apps/web/tests/unit/mocks/fixtures.ts` and `apps/web/tests/unit/community-overview/fixtures.ts`.
- [X] T044 Run focused validation command from `specs/006-coordination-hub-cta-fix/quickstart.md` and resolve failures in `apps/web/tests/unit/**`.
- [X] T045 [P] Run scoped-link leakage audit in `apps/web/app/communities/[communityId]/coordination/**`, `apps/web/components/requests/**`, and `apps/web/components/drafts/**` ensuring no global `/requests/*` or `/drafts/*` links are emitted from scoped pages.
- [ ] T046 [P] If implementation status/risk posture changed, sync `.github/project-management/IMPLEMENTATION_STATUS.md` and `.github/project-management/STATUS_REVIEW.md` together.
- [ ] T047 Execute manual smoke path from `apps/web/app/communities/[communityId]/coordination/page.tsx` through create request/create draft and confirm scoped redirects to list pages.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: starts immediately.
- **Phase 2 (Foundational)**: depends on Phase 1 and blocks all user stories.
- **Phase 3 (US1)**, **Phase 4 (US2)**, **Phase 5 (US4)**, **Phase 6 (US3)**: start after Phase 2.
- **Phase 7 (Polish)**: starts after target user stories are complete.

### User Story Dependencies

- **US1 (P1)**: depends only on Foundational tasks.
- **US2 (P1)**: depends on Foundational; consumes wrapper routes from US1 for final scoped behavior.
- **US4 (P1)**: depends on Foundational; independent of US2/US3 business flows.
- **US3 (P2)**: depends on Foundational and detail wrapper availability from US1.

### Suggested Story Completion Order

1. US1 (MVP route surface/no-404 path availability)
2. US2 (scoped list/create behavior)
3. US4 (overview CTA no-404 hardening)
4. US3 (mismatch safety and cross-link correctness)

---

## Parallel Execution Examples

### US1 Parallel Example

- These can run in parallel after the hub wrapper exists: requests list/new/detail wrappers.
- These can run in parallel after the hub wrapper exists: drafts list/new/detail wrappers.

### US2 Parallel Example

- These can run in parallel: scoped link and create-form tests for requests and drafts.
- Wrapper-level route context wiring tasks can run in parallel: scoped create redirects and scoped list link builders.

### US4 Parallel Example

- These can run in parallel: proposals-disabled, header-gating, panel-rendering, and routing-allowlist tests.
- These can run in parallel before rendering integration checks: hook-level state tasks for activity and header actions.

### US3 Parallel Example

- These can run in parallel: request and draft mismatch/cross-link tests.
- Wrapper-level expected-community and cross-link builder wiring follows after component-level test expectations are set.

---

## Implementation Strategy

### Suggested Order (US1 first)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate route existence and hub navigation behavior before expanding.

### Incremental Delivery

1. Add US2 to guarantee scoped list/create flows.
2. Add US4 to guarantee no-404 Overview CTA behavior.
3. Add US3 mismatch safety for detail correctness.
4. Run polish validation and smoke checks.

### Scope Guardrails

- Do not add governance/proposals pages.
- Do not add parameters pages.
- Do not modify contracts or indexer schema.
- Reuse existing Requests/Drafts business logic through thin wrapper composition only.
