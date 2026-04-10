# Tasks: Direct Proposal Creation

**Input**: Design documents from `/specs/011-direct-proposal-creation/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/*.schema.json`

**Tests**: Web/unit tests are REQUIRED for this feature. Add tests before implementation tasks in each user story phase.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Phase 1: Setup

- [X] T001 Create direct proposal route shell in `apps/web/app/communities/[communityId]/governance/proposals/new/page.tsx`
- [X] T002 Add direct proposal test fixture module in `apps/web/tests/unit/components/governance/direct-proposal-create.fixtures.ts`
- [X] T003 [P] Add direct proposal test utilities in `apps/web/tests/unit/components/governance/direct-proposal-create.test-utils.tsx`

---

## Phase 2: Foundational (Blocking)

- [X] T004 Add failing unit tests for proposal ID recovery order in `apps/web/tests/unit/lib/governance/proposal-id-recovery.test.ts`
- [X] T005 Add failing unit tests for community/governor preflight guards in `apps/web/tests/unit/lib/governance/direct-proposal-guards.test.ts`
- [X] T006 Add proposal ID recovery helper implementing event decode -> deterministic read -> unresolved in `apps/web/lib/governance/proposal-id-recovery.ts`
- [X] T007 Add direct proposal guard helpers enforcing exact community/governor resolution and allowlist checks in `apps/web/lib/governance/direct-proposal-guards.ts`
- [X] T008 Add shared direct proposal flow types in `apps/web/lib/governance/direct-proposal-types.ts`
- [X] T009 Add deterministic post-submit routing helper in `apps/web/lib/governance/direct-proposal-routing.ts`

**Checkpoint**: Foundational helpers and tests are in place; user stories can proceed.

---

## Phase 3: User Story 1 - Submit Direct Proposal (Priority: P1) 🎯 MVP

**Goal**: Allow governance users to create proposals directly via `ShiftGovernor` from the community governance UI using existing allowlist-constrained composer output.

**Independent Test**: From `/communities/[communityId]/governance/proposals/new`, submit a valid binary and multi-choice proposal and confirm the app calls `propose(...)`/`proposeMultiChoice(...)` and reaches a successful post-submit state.

### Tests for User Story 1

- [X] T010 [P] [US1] Add failing component test for binary direct submit calling `propose(...)` in `apps/web/tests/unit/components/governance/direct-proposal-create.submit-binary.test.tsx`
- [X] T011 [P] [US1] Add failing component test for multi-choice direct submit calling `proposeMultiChoice(...)` in `apps/web/tests/unit/components/governance/direct-proposal-create.submit-multichoice.test.tsx`
- [X] T012 [P] [US1] Add failing component test proving composer reuse (no parallel composer path) in `apps/web/tests/unit/components/governance/direct-proposal-create.composer-reuse.test.tsx`

### Implementation for User Story 1

- [X] T013 [US1] Implement community-scoped create page composition in `apps/web/app/communities/[communityId]/governance/proposals/new/page.tsx`
- [X] T014 [US1] Implement direct proposal create container with existing allowlist-constrained guided/expert composer integration in `apps/web/components/governance/direct-proposal-create.container.tsx`
- [X] T015 [US1] Implement presentational sections for direct proposal creation UI in `apps/web/components/governance/direct-proposal-create.component.tsx`
- [X] T016 [US1] Implement governor write path dispatch for `propose(...)` and `proposeMultiChoice(...)` in `apps/web/lib/governance/direct-proposal-submit.ts`
- [X] T017 [US1] Wire direct proposal create route into governance surface links in `apps/web/app/communities/[communityId]/governance/proposals/page.tsx`

**Checkpoint**: US1 is independently functional and testable.

---

## Phase 4: User Story 2 - Resilient Post-Submit Navigation (Priority: P2)

**Goal**: Keep post-submit navigation deterministic and community-scoped under indexer lag.

**Independent Test**: After successful submit, confirm routing prefers community detail when `proposalId` resolves and falls back to community list with `txHash` context when unresolved.

### Tests for User Story 2

- [X] T018 [P] [US2] Add failing unit tests for event-log-first proposalId recovery in `apps/web/tests/unit/lib/governance/proposal-id-recovery.event-first.test.ts`
- [X] T019 [P] [US2] Add failing unit tests for deterministic read fallback after missing event in `apps/web/tests/unit/lib/governance/proposal-id-recovery.read-fallback.test.ts`
- [X] T020 [P] [US2] Add failing unit tests for unresolved fallback to list with `txHash` context in `apps/web/tests/unit/lib/governance/proposal-id-recovery.unresolved-fallback.test.ts`
- [X] T021 [P] [US2] Add failing route-scoping tests for post-submit navigation paths in `apps/web/tests/unit/routes/community-governance-proposal-create-routing.test.tsx`
- [X] T041 [US2] Add failing integration test for successful submit -> proposalId recovery -> detail-or-list routing in `apps/web/tests/integration/governance/direct-proposal-create.submit-routing.integration.test.tsx`

### Implementation for User Story 2

- [X] T022 [US2] Integrate proposalId recovery pipeline into submit flow using planned order in `apps/web/lib/governance/direct-proposal-submit.ts`
- [X] T023 [US2] Integrate detail-or-list fallback routing with strict community scoping in `apps/web/components/governance/direct-proposal-create.container.tsx`
- [X] T024 [US2] Add success context rendering and lag guidance messaging in `apps/web/components/governance/direct-proposal-create.component.tsx`
- [X] T025 [US2] Enable proposals create CTA in overview activity state in `apps/web/hooks/useCommunityOverviewActivity.ts`
- [X] T026 [US2] Update overview CTA tests for activation and route contract in `apps/web/tests/unit/community-overview/activity-cta-routing.test.tsx`

**Checkpoint**: US2 is independently functional and testable.

---

## Phase 5: User Story 3 - Fail-Safe Error Handling (Priority: P3)

**Goal**: Ensure wallet rejection, revert, context mismatch, and duplicate submit are handled safely with preserved composer state.

**Independent Test**: Simulate wallet reject, on-chain revert, community/governor mismatch, and rapid double-submit; verify pre-wallet blocking where required and preserved composer state.

### Tests for User Story 3

- [X] T027 [P] [US3] Add failing component test for wallet rejection preserving composer state in `apps/web/tests/unit/components/governance/direct-proposal-create.wallet-reject.test.tsx`
- [X] T028 [P] [US3] Add failing component test for revert preserving composer state in `apps/web/tests/unit/components/governance/direct-proposal-create.revert.test.tsx`
- [X] T029 [P] [US3] Add failing component test for context mismatch blocked before wallet prompt in `apps/web/tests/unit/components/governance/direct-proposal-create.context-mismatch.test.tsx`
- [X] T030 [P] [US3] Add failing component test for explicit duplicate submit lock in `apps/web/tests/unit/components/governance/direct-proposal-create.duplicate-submit.test.tsx`
- [X] T042 [P] [US3] Add failing component test for chain/provider mismatch blocked before wallet prompt in `apps/web/tests/unit/components/governance/direct-proposal-create.chain-mismatch.test.tsx`

### Implementation for User Story 3

- [X] T031 [US3] Implement non-destructive error-state handling and retry messaging in `apps/web/components/governance/direct-proposal-create.container.tsx`
- [X] T032 [US3] Implement pre-wallet context mismatch blocking and allowlist guard errors in `apps/web/lib/governance/direct-proposal-guards.ts`
- [X] T033 [US3] Implement explicit duplicate-submit prevention state machine in `apps/web/lib/governance/direct-proposal-submit.ts`
- [X] T034 [US3] Render fail-safe messaging for reject/revert/mismatch in `apps/web/components/governance/direct-proposal-create.component.tsx`

**Checkpoint**: US3 is independently functional and testable.

---

## Phase 6: Polish & Docs

- [X] T035 [P] Add regression test proving proposal list/detail compatibility with direct-created proposals in `apps/web/tests/unit/components/governance/proposal-list-direct-created-compat.test.tsx`
- [X] T036 [P] Add regression test proving draft escalation behavior is unchanged in `apps/web/tests/unit/components/drafts/draft-detail.direct-proposal-regression.test.tsx`
- [X] T037 [P] Update route allowlist regression for `/communities/[communityId]/governance/proposals/new` in `apps/web/tests/unit/routes/community-routing-allowlist.test.ts`
- [X] T038 Run focused validation commands from quickstart in `specs/011-direct-proposal-creation/quickstart.md`
- [ ] T039 [P] Conditionally update shipped behavior docs in `neuromancer/SHIFT_SYSTEM.md` and `contracts/FEATURES.md` if user-visible governance authoring behavior changed
- [ ] T040 [P] Conditionally synchronize status docs in `.github/project-management/IMPLEMENTATION_STATUS.md` and `.github/project-management/STATUS_REVIEW.md` if status/risk/priority/workflow content changed
- [X] T043 [P] Run terminology compliance pass for DT-002 across spec/plan/tasks and implementation copy in `specs/011-direct-proposal-creation/`
- [ ] T044 [P] If contract-change blocker is encountered, document explicit blocker evidence and approval note before scope expansion in `specs/011-direct-proposal-creation/research.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 (Setup): no dependencies.
- Phase 2 (Foundational): depends on Phase 1 and blocks all user stories.
- Phase 3 (US1): depends on completion of Phase 2.
- Phase 4 (US2): depends on completion of Phase 2 and benefits from US1 submit flow artifacts.
- Phase 5 (US3): depends on completion of Phase 2 and US1 submit flow artifacts.
- Phase 6 (Polish & Docs): depends on US1, US2, and US3 completion.

### Task Dependencies (Strict)

- T006 depends on T004.
- T007 depends on T005.
- T008 depends on T004 and T005.
- T009 depends on T006 and T008.
- T013 depends on T001, T006, T007, T008, and T009.
- T014 depends on T002, T003, T006, T007, T008, and T009.
- T015 depends on T014.
- T016 depends on T006, T007, T008, and T009.
- T017 depends on T013 and T016.
- T022 depends on T016, T018, T019, T020, and T041.
- T023 depends on T022 and T021.
- T024 depends on T023.
- T025 depends on T013.
- T026 depends on T025.
- T031 depends on T016 and T027.
- T032 depends on T007, T029, and T042.
- T033 depends on T016 and T030.
- T034 depends on T031, T032, and T033.
- T035 depends on T022 and T023.
- T036 depends on T022 and T023.
- T037 depends on T013.
- T038 depends on T035, T036, and T037.
- T039 and T040 depend on T038 and are conditional by DT-001/DT-003.
- T043 depends on T038.
- T044 depends on T038 and is conditional by FR-015.

### Parallel Opportunities

- Setup: T003 can run in parallel with T001 and T002.
- Foundational: T004 and T005 can run in parallel.
- US1: T010, T011, T012 can run in parallel.
- US2: T018, T019, T020, T021 can run in parallel.
- US3: T027, T028, T029, T030, T042 can run in parallel.
- Polish: T035, T036, T037, T039, T040, T043, and T044 are parallelizable once prerequisites are satisfied.

---

## Parallel Example: User Story 2

```bash
# Run independent failing tests in parallel first
T018 apps/web/tests/unit/lib/governance/proposal-id-recovery.event-first.test.ts
T019 apps/web/tests/unit/lib/governance/proposal-id-recovery.read-fallback.test.ts
T020 apps/web/tests/unit/lib/governance/proposal-id-recovery.unresolved-fallback.test.ts
T021 apps/web/tests/unit/routes/community-governance-proposal-create-routing.test.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1 and Phase 2.
2. Deliver Phase 3 (US1) end-to-end.
3. Validate direct submit for binary and multi-choice proposal creation.

### Incremental Delivery

1. Add US2 routing resiliency and CTA activation.
2. Add US3 fail-safe guards and duplicate-submit prevention.
3. Finish with regression and conditional docs/status synchronization.

### Completion Proof Targets

- Direct submit works through `propose(...)` and `proposeMultiChoice(...)`.
- ProposalId recovery order is event decode -> deterministic read -> unresolved list fallback with `txHash`.
- Post-submit routing remains community-scoped.
- Invalid context is blocked before wallet prompt.
- Chain/provider mismatch is blocked before wallet prompt.
- Draft escalation behavior remains unchanged.
