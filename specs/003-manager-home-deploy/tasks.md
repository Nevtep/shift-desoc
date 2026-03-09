# Tasks: Manager Home Deploy Wizard And Communities Index

**Input**: Design documents from `/specs/003-manager-home-deploy/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `quickstart.md`, `specs/003-manager-home-deploy/contracts/manager-home.graphql`, `specs/003-manager-home-deploy/contracts/manager-home-read-api.openapi.yaml`

**Tests**: Vitest/Testing Library/MSW tests are required for this feature.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- `[P]`: Can run in parallel (different files, no dependency on incomplete tasks)
- `[Story]`: Present only for user-story phase tasks (`[US1]`, `[US2]`, `[US3]`)
- Every task includes exact file paths.

## Phase 1: Setup (Wizard Scaffolding)

**Purpose**: Prepare home-page feature scaffolding and test harness touchpoints.

- [X] T001 Create home deploy component scaffold in `apps/web/components/home/deploy-wizard.tsx`
- [X] T002 [P] Create deploy domain type definitions in `apps/web/lib/deploy/types.ts`
- [X] T003 [P] Add deploy test fixture extensions for wizard scenarios in `apps/web/tests/unit/mocks/fixtures.ts`
- [X] T004 [P] Add MSW handler placeholders for wizard read-side mocks in `apps/web/tests/unit/mocks/handlers.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build deterministic core logic required by all user stories.

**CRITICAL**: No user story implementation starts before this phase is complete.

- [X] T005 Implement step constants, ordering, and transition guards in `apps/web/lib/deploy/wizard-machine.ts`
- [X] T006 Implement local pre-registration session persistence and deployer binding in `apps/web/lib/deploy/session-store.ts`
- [X] T007 Implement shared-infra probe utilities (addresses/code/ABI probes) in `apps/web/lib/deploy/preflight.ts`
- [X] T008 Implement funds estimation with recommended volatility buffer in `apps/web/lib/deploy/preflight.ts`; use chain fee data via public/wallet client (EIP-1559 fees if available) combined with per-tx `estimateGas`, then apply the buffer.
- [X] T009 Implement deterministic verification check evaluators and reason mapping in `apps/web/lib/deploy/verification.ts`. Mirror the check set and semantics defined in `verify-community-deployment.ts`.
- [X] T010 [P] Add unit tests for wizard-machine transitions in `apps/web/tests/unit/lib/deploy/wizard-machine.test.ts`
- [X] T011 [P] Add unit tests for preflight probes and funds estimation in `apps/web/tests/unit/lib/deploy/preflight.test.ts`
- [X] T012 [P] Add unit tests for verification parity checks and failure reasons in `apps/web/tests/unit/lib/deploy/verification.test.ts`

**Checkpoint**: Core deploy logic and deterministic evaluators are ready.

---

## Phase 3: User Story 1 - Launch A Community Stack (Priority: P1)

**Goal**: Deliver a user-signed wizard on home page that runs preflight, executes deploy steps, and renders per-check verification outcomes.

**Independent Test**: Connect supported wallet, pass preflight, execute flow with mocked tx confirmations, and see pass/fail verification details without backend deployer key usage.

### Tests for User Story 1

- [X] T013 [P] [US1] Add wizard state/step transition and upfront explanation-content tests (multi-signature process, prerequisites, cost context) in `apps/web/tests/unit/components/deploy-wizard.test.tsx`
- [X] T014 [P] [US1] Add blocked-state tests (wallet disconnected, wrong network, missing shared infra, insufficient funds) in `apps/web/tests/unit/components/deploy-preflight.test.tsx`
- [X] T015 [P] [US1] Add verification rendering tests (per-check pass/fail with reasons) in `apps/web/tests/unit/components/deploy-verification-results.test.tsx`
- [X] T016 [P] [US1] Add created-state gating tests that require registration + required verification/config checks in `apps/web/tests/unit/components/deploy-created-state.test.tsx`
- [X] T017 [US1] Add test asserting partial progress is never rendered as "community created" in `apps/web/tests/unit/components/deploy-created-state.test.tsx`

### Implementation for User Story 1

- [X] T018 [US1] Implement user-signed deployment orchestration hook (no backend signer) in `apps/web/hooks/useDeployWizard.ts`
	- Map each wizard step to concrete viem/wagmi calls (`deployContract` / `writeContract`) according to the plan step model.
	- Persist tx hashes per step in session state so resume/verification can reference them.
- [X] T019 [US1] Implement preflight UI with start blocking and remediation guidance in `apps/web/components/home/deploy-preflight.tsx`
- [X] T020 [US1] Implement step progress UI (purpose, expected tx count, live tx progress) in `apps/web/components/home/deploy-step-list.tsx`
- [X] T021 [US1] Implement verification results UI with deterministic check reasons in `apps/web/components/home/deploy-verification-results.tsx`
- [X] T022 [US1] Keep `apps/web/lib/deploy/verification.ts` as a pure evaluator of verification checks/results; enforce created-state gating in wizard control flow (`apps/web/lib/deploy/wizard-machine.ts` guard and/or `apps/web/hooks/useDeployWizard.ts` selector).
- [X] T023 [US1] Integrate preflight/steps/verification into wizard container in `apps/web/components/home/deploy-wizard.tsx`
- [X] T024 [US1] Place deploy wizard above communities index on home route in `apps/web/app/page.tsx`

**Checkpoint**: User Story 1 is independently functional and testable.

---

## Phase 4: User Story 2 - Resume Interrupted Deployment (Priority: P2)

**Goal**: Resume incomplete flows with strict deployer authorization and on-chain source of truth after registration.

**Independent Test**: Interrupt an in-progress flow, reload, and confirm resume starts from first incomplete step for initiating wallet only; registered community resume is derived from CommunityRegistry + on-chain checks.

### Tests for User Story 2

- [X] T025 [P] [US2] Add resume state inference tests (pre-registration local session path) in `apps/web/tests/unit/lib/deploy/session-store.test.ts`
- [X] T026 [US2] Add resume authorization tests (same wallet allowed, different wallet blocked) in `apps/web/tests/unit/hooks/use-deploy-resume.test.tsx`
- [X] T027 [US2] Add post-registration on-chain source-of-truth tests (no local deployments JSON reliance) in `apps/web/tests/unit/hooks/use-deploy-resume.test.tsx`
- [X] T028 [P] [US2] Add multi-community resume-target selection tests (session id vs communityId) in `apps/web/tests/unit/hooks/use-deploy-resume-multicommunity.test.tsx`

### Implementation for User Story 2

- [X] T029 [US2] Implement resume inference hook using local pre-registration state and on-chain post-registration checks in `apps/web/hooks/useDeployResume.ts`
- [X] T030 [US2] Enforce deployer-wallet-only resume authorization in `apps/web/hooks/useDeployResume.ts`
- [X] T031 [US2] Wire resume entry points and recovery guidance into wizard UI in `apps/web/components/home/deploy-wizard.tsx`
- [X] T032 [US2] Reconcile session state against chain-derived status after reload in `apps/web/lib/deploy/session-store.ts`
- [X] T033 [US2] Harden wizard state model against multi-community hidden assumptions in `apps/web/lib/deploy/wizard-machine.ts`

**Checkpoint**: User Story 2 is independently functional and testable.

---

## Phase 5: User Story 3 - Browse Communities From Home (Priority: P3)

**Goal**: Keep communities index directly below wizard with complete loading/empty/error/populated states and one-click navigation.

**Independent Test**: Render home route and communities list in all data states and validate navigation links to `/communities/[communityId]`.

### Tests for User Story 3

- [X] T034 [P] [US3] Add/refresh communities list state tests in `apps/web/components/communities/community-list.test.tsx`
- [X] T035 [P] [US3] Add baseline home-route composition test ensuring deploy wizard renders above communities index in `apps/web/tests/unit/routes/home-page.test.tsx`
- [X] T036 [US3] Add navigation assertion tests for `/communities/[communityId]` links in `apps/web/components/communities/community-list.test.tsx`
- [X] T037 [P] [US3] Add multi-community list rendering tests to prevent single-community assumptions in `apps/web/tests/unit/components/community-list-multicommunity.test.tsx`

### Implementation and Regression for User Story 3

- [X] T038 [US3] Wire `apps/web/lib/graphql/queries.ts` and communities list rendering in `apps/web/components/communities/community-list.tsx` to use the aligned contract query; implement loading, empty, and error states.
- [X] T039 [US3] Ensure list item rendering and navigation stay compliant with home-page scope in `apps/web/components/communities/community-list.tsx`
- [X] T040 [US3] Add regression cases for home-route wizard+index coexistence (state transitions and no layout/order regressions) in `apps/web/tests/unit/routes/home-page.test.tsx`
- [X] T047 [US3] Ensure Manager Home GraphQL query contract is aligned and returns required communities-list fields in `specs/003-manager-home-deploy/contracts/manager-home.graphql` and `apps/web/lib/graphql/queries.ts`; update query or mapping if needed.

**Checkpoint**: User Story 3 is independently functional and testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and required documentation/status synchronization.

- [X] T041 [P] Validate and update UI copy to canonical Shift terminology for this feature scope in `apps/web/components/home/deploy-wizard.tsx`, explicitly preserving "claims" terminology only for marketplace dispute/claim contexts.
- [X] T042 [P] Update Manager flow documentation for home deploy wizard behavior and terminology notes in `docs/EN/guides/MANAGEMENT_TOOLS.md`
- [X] T043 [P] Sync tactical feature status/risk updates in `.github/project-management/IMPLEMENTATION_STATUS.md`
- [X] T044 [P] Sync strategic changelog/status updates in `.github/project-management/STATUS_REVIEW.md`
- [X] T045 Execute quickstart verification scenarios and record outcomes in `specs/003-manager-home-deploy/quickstart.md`
- [X] T046 Run targeted web unit suites for wizard/resume/verification/community-list and attach command outcomes in `specs/003-manager-home-deploy/quickstart.md`; include changed-files validation confirming no `contracts/**` modifications for this feature, and include compatibility check notes confirming no ABI/event schema changes.

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 (Setup): no dependencies.
- Phase 2 (Foundational): depends on Phase 1; blocks all user stories.
- Phase 3 (US1): depends on Phase 2.
- Phase 4 (US2): depends on Phase 2 and integrates with US1 wizard shell.
- Phase 5 (US3): depends on Phase 2; can proceed in parallel with US2 once foundational is done.
- Phase 6 (Polish): depends on completion of desired user stories.

### User Story Dependencies

- US1 (P1): starts first after foundational completion.
- US2 (P2): depends on shared wizard/session infrastructure and integrates into US1 UI.
- US3 (P3): independent from deploy execution logic; depends on home composition and query/list components.

### Within Each User Story

- Test tasks first, then implementation tasks.
- Deterministic logic before UI wiring.
- Complete story checkpoint before moving to final polish.

## Parallel Opportunities

- Setup tasks T002-T004 can run in parallel.
- Foundational tests T010-T012 can run in parallel after T005-T009 scaffolding exists.
- US1 tests T013-T017 can run in parallel.
- US2 tests T025 and T028 can run in parallel; T026/T027 share file and are sequential.
- US3 tests T034, T035, and T037 can run in parallel; T036 shares file with T034 and is sequential.
- Docs/status tasks T042-T044 can run in parallel.

---

## Parallel Example: User Story 1

```bash
# Parallel test creation
T013 apps/web/tests/unit/components/deploy-wizard.test.tsx
T014 apps/web/tests/unit/components/deploy-preflight.test.tsx
T015 apps/web/tests/unit/components/deploy-verification-results.test.tsx
T016 apps/web/tests/unit/components/deploy-created-state.test.tsx
T017 apps/web/tests/unit/components/deploy-created-state.test.tsx

# Parallel UI implementation after hook exists
T019 apps/web/components/home/deploy-preflight.tsx
T020 apps/web/components/home/deploy-step-list.tsx
T021 apps/web/components/home/deploy-verification-results.tsx
```

## Parallel Example: User Story 2

```bash
# Parallel resume tests with different files
T025 apps/web/tests/unit/lib/deploy/session-store.test.ts
T028 apps/web/tests/unit/hooks/use-deploy-resume-multicommunity.test.tsx
```

## Parallel Example: User Story 3

```bash
# Parallel list + route tests on different files
T035 apps/web/tests/unit/routes/home-page.test.tsx
T037 apps/web/tests/unit/components/community-list-multicommunity.test.tsx
```

---

## Implementation Strategy

### Incremental Delivery

1. Add US2 resume behavior after US1 stability.
2. Add US3 communities index guarantees and composition tests.
3. Finish terminology/docs/status sync and quickstart execution logs.

### Scope Guardrails

- Home page only (`apps/web/app/page.tsx`) with wizard above communities index.
- No community detail dashboard implementation in this feature.
- No backend deployer key path.
- No shared infra deployment implementation.
- No unrelated marketplace/housing/engagements/cohorts/treasury UX work.
