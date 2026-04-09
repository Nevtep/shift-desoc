# Tasks: Governance Hub (Community-scoped) + Draft to Proposal Escalation

**Input**: Design documents from `/specs/009-governance-hub-escalation/`
**Prerequisites**: plan.md, spec.md, requirements.md, research.md, data-model.md, contracts/onchain-interactions.md, quickstart.md

**Tests**: Web unit tests are required for FR-016 and SC-001..SC-006.

**Organization**: Tasks are grouped by user story for independent implementation and validation.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare shared governance feature scaffolding and test harness updates.

- [x] T001 Build requirement-to-test traceability table for FR-001..FR-016 and SC-001..SC-006 in specs/009-governance-hub-escalation/checklists/requirements.md
- [x] T002 [P] Add reusable governance route test helpers and fixture builders for community-scoped hub/list/detail pages in apps/web/tests/unit/routes/community-governance-routes-helpers.tsx and apps/web/tests/unit/mocks/fixtures.ts
- [x] T003 [P] Extend MSW fixtures for community-scoped proposal scenarios in apps/web/tests/unit/mocks/fixtures.ts and apps/web/tests/unit/mocks/handlers.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build shared governance utilities required by all stories.

**⚠️ CRITICAL**: No user story implementation starts before this phase is complete.

- [x] T004 Add community governance top bar component with indexer health badge in apps/web/components/communities/governance-top-bar.tsx
- [x] T005 [P] Add proposal status normalization and display utilities in apps/web/lib/governance/proposal-status.ts
- [x] T006 [P] Add readiness derivation utility with stale detection in apps/web/lib/governance/proposal-readiness.ts
- [x] T007 [P] Add weighted vote bps math and percent-format helpers in apps/web/lib/governance/weighted-vote.ts
- [x] T008 Validate indexed proposal/vote field assumptions used by UI queries (CM-003) against current GraphQL responses in apps/web/lib/graphql/queries.ts and apps/web/tests/unit/mocks/handlers.ts
- [x] T009 Wire any new governance utility exports/import paths used by route pages in apps/web/components/governance/proposal-list.tsx and apps/web/components/governance/proposal-detail.tsx

**Checkpoint**: Shared governance foundation is ready.

---

## Phase 3: User Story 1 - Browse Community Governance Proposals (Priority: P1) 🎯 MVP

**Goal**: Deliver community-scoped governance hub, proposals list/detail routing, scoped data, and mismatch guard.

**Independent Test**: Visiting the three community governance routes renders scoped proposal data and blocks cross-community detail with correction link.

### Tests for User Story 1

- [x] T010 [P] [US1] Add route existence assertions for three governance routes in apps/web/tests/unit/routes/community-governance-routes-exist.test.ts
- [x] T011 [P] [US1] Add governance hub page assertions for community context, proposals card CTA target, and back link in apps/web/tests/unit/routes/community-governance-hub-page.test.tsx
- [x] T012 [P] [US1] Add proposal list scoping tests for communityId isolation in apps/web/components/governance/proposal-list.test.tsx
- [x] T013 [P] [US1] Add proposal detail mismatch guard tests with correction link in apps/web/components/governance/proposal-detail.test.tsx
- [x] T049 [P] [US1] Add explicit proposal status-pill mapping tests for all supported lifecycle states (Pending, Active, Succeeded, Defeated, Queued, Executed) across list/detail UI in apps/web/components/governance/proposal-list.test.tsx and apps/web/components/governance/proposal-detail.test.tsx

### Implementation for User Story 1

- [x] T014 [P] [US1] Create governance hub page route in apps/web/app/communities/[communityId]/governance/page.tsx
- [x] T015 [P] [US1] Create community-scoped proposals list page route in apps/web/app/communities/[communityId]/governance/proposals/page.tsx
- [x] T016 [P] [US1] Create community-scoped proposal detail page route in apps/web/app/communities/[communityId]/governance/proposals/[proposalId]/page.tsx
- [x] T017 [US1] Update GraphQL list/detail query contracts for community scoping and proposal detail fields in apps/web/lib/graphql/queries.ts
- [x] T018 [US1] Refactor proposals list to enforce route-community scoping and scoped links in apps/web/components/governance/proposal-list.tsx
- [x] T019 [US1] Implement proposal detail community mismatch guard and correction route in apps/web/components/governance/proposal-detail.tsx

**Checkpoint**: Community-scoped governance browsing is independently functional.

---

## Phase 4: User Story 3 - Escalate Draft to Proposal (Priority: P1)

**Goal**: Allow draft escalation from community draft detail with gating, tx flow, receipt log parsing, and deterministic fallback navigation.

**Independent Test**: Escalating a valid draft either routes directly to proposal detail when proposalId is parsed from receipt logs or to proposals list with lag notice.

### Tests for User Story 3

- [x] T020 [P] [US3] Add escalation gating tests (wallet/network/community/action bundle including actionsHash presence) in apps/web/components/drafts/draft-detail.test.tsx
- [x] T021 [P] [US3] Add escalation success test parsing ProposalEscalated receipt event to detail navigation in apps/web/components/drafts/draft-detail.test.tsx
- [x] T022 [P] [US3] Add escalation fallback navigation test when proposalId is not derivable in apps/web/components/drafts/draft-detail.test.tsx

### Implementation for User Story 3

- [x] T023 [US3] Add escalation CTA placement and community-scoped governance destination links in apps/web/components/drafts/draft-detail.tsx
- [x] T024 [US3] Enforce escalation preconditions (wallet/network/community/action bundle with explicit actionsHash check) in apps/web/components/drafts/draft-detail.tsx
- [x] T025 [US3] Resolve DraftsManager via community modules and execute escalateToProposal tx in apps/web/components/drafts/draft-detail.tsx
- [x] T026 [US3] Implement tx receipt log decoding for ProposalEscalated event in apps/web/components/drafts/draft-detail.tsx
- [x] T027 [US3] Implement proposalId-derived redirect and list fallback with indexing-lag notice in apps/web/components/drafts/draft-detail.tsx
- [x] T028 [US3] Ensure community draft detail page integrates updated escalation flow in apps/web/app/communities/[communityId]/coordination/drafts/[draftId]/page.tsx

**Checkpoint**: Draft-to-proposal escalation works with deterministic success/fallback paths.

---

## Phase 5: User Story 2 - Vote and Track Proposal Lifecycle (Priority: P2)

**Goal**: Deliver weighted multi-choice vote UX, exact bps validation, two-decimal percentage rendering, and readiness fallback reads when stale/missing.

**Independent Test**: User can enter weighted allocations summing exactly 10,000 bps, submit vote tx with state feedback, and see readiness derived indexer-first with minimal chain fallback.

### Tests for User Story 2

- [x] T029 [P] [US2] Add weighted allocation validation tests for exact 10,000 bps in apps/web/components/governance/proposal-detail.test.tsx
- [x] T030 [P] [US2] Add percent rendering tests for exactly two decimal places in apps/web/components/governance/proposal-detail.test.tsx
- [x] T031 [P] [US2] Add vote submission state tests (pending, confirmed, error, rejected signature, wrong network) in apps/web/components/governance/proposal-detail.test.tsx
- [x] T032 [P] [US2] Add readiness fallback tests for stale/missing indexer readiness fields in apps/web/components/governance/proposal-detail.test.tsx

### Implementation for User Story 2

- [x] T033 [US2] Replace single-option multi-choice voting with weighted allocation inputs in apps/web/components/governance/proposal-detail.tsx
- [x] T034 [US2] Implement integer basis-points state model and exact sum validation (10,000) in apps/web/components/governance/proposal-detail.tsx and apps/web/lib/governance/weighted-vote.ts
- [x] T035 [US2] Render/edit allocations as percentages with two decimals while preserving bps internals in apps/web/components/governance/proposal-detail.tsx
- [x] T036 [US2] Implement castVoteMultiChoice submission with existing wallet/tx utilities and explicit tx state messaging in apps/web/components/governance/proposal-detail.tsx
- [x] T037 [US2] Derive execution readiness from indexer fields first and classify stale/missing readiness in apps/web/components/governance/proposal-detail.tsx and apps/web/lib/governance/proposal-readiness.ts
- [x] T038 [US2] Add minimal read-only chain fallback calls (state, proposalEta, proposalNeedsQueuing, optional totals/weights) only when stale/missing in apps/web/components/governance/proposal-detail.tsx

**Checkpoint**: Weighted voting and lifecycle readiness tracking are independently functional.

---

## Phase 6: User Story 4 - Access Governance from Community Overview (Priority: P2)

**Goal**: Enable proposals View all CTA routing without 404 and keep Create new and Parameters disabled non-links.

**Independent Test**: Community overview shows enabled proposals View all link to community governance proposals route, while Create new and Parameters remain disabled buttons.

### Tests for User Story 4

- [x] T039 [P] [US4] Add overview proposals CTA behavior tests (View all enabled, Create disabled) in apps/web/tests/unit/community-overview/activity-proposals-enabled.test.tsx
- [x] T040 [P] [US4] Add/adjust parameter CTA disabled non-link test coverage in apps/web/tests/unit/routes/community-routing-allowlist.test.ts and apps/web/tests/unit/community-overview/unimplemented-cta-guard.test.tsx

### Implementation for User Story 4

- [x] T041 [US4] Enable proposals viewAll and keep create disabled in activity panel state generation in apps/web/hooks/useCommunityOverviewActivity.ts
- [x] T042 [US4] Keep deterministic community proposal route targets for overview CTAs in apps/web/lib/community-overview/routes.ts
- [x] T043 [US4] Validate activity panel non-link rendering for disabled CTAs in apps/web/components/communities/overview/activity-panel.tsx

**Checkpoint**: Overview governance CTA routing is independently functional and safe.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, regression safety, and scope guardrails.

- [x] T044 [P] Run quickstart targeted tests and full web unit suite from specs/009-governance-hub-escalation/quickstart.md
- [x] T045 [P] Verify no contract/indexer changes using repo diff guard for contracts/** and apps/indexer/** documented in specs/009-governance-hub-escalation/quickstart.md
- [x] T046 Update feature notes with final validation evidence in specs/009-governance-hub-escalation/checklists/requirements.md
- [x] T047 Add docs alignment check for shipped behavior and update docs when needed in neuromancer/SHIFT_SYSTEM.md and contracts/FEATURES.md
- [x] T048 If governance workflow/status deltas exist, apply synchronized project-management updates in .github/project-management/IMPLEMENTATION_STATUS.md and .github/project-management/STATUS_REVIEW.md

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): no dependencies.
- Foundational (Phase 2): depends on Setup.
- User Story phases (Phase 3-6): depend on Foundational completion.
- Polish (Phase 7): depends on completion of selected user stories.

### User Story Dependencies

- US1 (P1): starts after Phase 2.
- US3 (P1): starts after Phase 2; uses shared draft detail flow and can run in parallel with US1.
- US2 (P2): starts after Phase 2; depends on proposal detail baseline from US1.
- US4 (P2): starts after Phase 2; can run in parallel with US2.

### Within Each User Story

- Tests first, then implementation.
- Route/page scaffolds before component wiring.
- Data/query updates before behavior relying on those fields.
- Tx flow updates before navigation-success assertions.

## Parallel Opportunities

- Phase 1: T002 and T003 can run in parallel.
- Phase 2: T005, T006, T007, and T008 can run in parallel (T009 follows once utilities are in place).
- US1: T010, T011, T012, T013, and T049 can run in parallel; T014, T015, and T016 can run in parallel.
- US3: T020, T021, and T022 can run in parallel; T023 and T024 can run in parallel before T025-T028.
- US2: T029, T030, T031, and T032 can run in parallel; T034 and T037 can run in parallel after T033.
- US4: T039 and T040 can run in parallel; T041 and T042 can run in parallel before T043.
- Polish: T044 and T045 can run in parallel.

---

## Parallel Example: User Story 2

```bash
# Run test-writing tasks in parallel
T029 apps/web/components/governance/proposal-detail.test.tsx
T030 apps/web/components/governance/proposal-detail.test.tsx
T031 apps/web/components/governance/proposal-detail.test.tsx
T032 apps/web/components/governance/proposal-detail.test.tsx

# Run implementation tasks in parallel where files do not conflict
T034 apps/web/lib/governance/weighted-vote.ts
T037 apps/web/lib/governance/proposal-readiness.ts
```

---

## Implementation Strategy

### MVP First (US1 + US3)

1. Complete Phase 1 and Phase 2.
2. Deliver US1 for community-scoped governance browsing.
3. Deliver US3 for draft escalation with receipt-log proposal redirect.
4. Validate with targeted tests before moving to US2/US4.

### Incremental Delivery

1. Foundation complete.
2. Ship US1 (browse routes and scoping).
3. Ship US3 (escalation flow).
4. Ship US2 (weighted voting and readiness fallback).
5. Ship US4 (overview CTA routing polish).
6. Finalize with Phase 7 checks.

### Scope Guardrails

- Do not modify `contracts/**`.
- Do not modify `apps/indexer/**`.
- Keep fallback chain interactions read-only and only when stale/missing.
