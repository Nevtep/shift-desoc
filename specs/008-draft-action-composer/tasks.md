# Tasks: Draft Action Composer Timelock Surface

**Input**: Design documents from `/specs/008-draft-action-composer/`
**Prerequisites**: `plan.md`, `spec.md`, `requirements.md`, `research.md`, `data-model.md`, `contracts/action-composer-contract.md`, `quickstart.md`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare project structure and implementation scaffolding references.

- [X] T001 Create task implementation checklist notes in `specs/008-draft-action-composer/tasks.md` sections and verify source-of-truth references to `specs/008-draft-action-composer/spec.md`
- [X] T002 Create actions module folder scaffolding in `apps/web/lib/actions/allowlists/` and ensure imports are reachable from `apps/web/lib/actions/registry.ts`
- [X] T003 [P] Add quickstart note documenting allowlist generator command usage in `specs/008-draft-action-composer/quickstart.md`

---

## Phase 2: Foundational (Allowlist Pipeline First)

**Purpose**: Build authoritative allowlist pipeline before any composer behavior changes.

**⚠️ CRITICAL**: No user-story implementation starts until this phase is complete.

- [X] T004 Implement allowlist runtime schema and loader in `apps/web/lib/actions/allowlist.ts`
- [X] T005 Add committed canonical profile file `apps/web/lib/actions/allowlists/base-sepolia-v1.json`
- [X] T006 Add allowlist metadata report file `apps/web/lib/actions/allowlists/base-sepolia-v1.meta.json`
- [X] T007 Implement generator script `scripts/generate-draft-composer-allowlist.ts` to parse `selectorRoleAssignments` in `apps/web/lib/deploy/factory-step-executor.ts`
- [X] T008 Implement ADMIN_ROLE-only signature selection in `scripts/generate-draft-composer-allowlist.ts`
- [X] T009 Implement ABI signature verification against web ABI artifacts in `scripts/generate-draft-composer-allowlist.ts`
- [X] T010 Implement deterministic stable sorting/output serialization in `scripts/generate-draft-composer-allowlist.ts`
- [X] T011 Wire generator command in `package.json` (for example `generate:composer-allowlist`)
- [X] T052 Add exact-signature ABI reality check in `scripts/generate-draft-composer-allowlist.ts` to fail on non-existent signatures and report any overload names found

**Checkpoint**: Allowlist authority and deterministic generation pipeline are in place.

---

## Phase 3: Foundational (UI Wiring Baseline)

**Purpose**: Establish shared UI wiring primitives used by both guided and expert modes.

- [X] T012 Implement target resolution module in `apps/web/lib/actions/target-resolution.ts` with module-aware address resolution
- [X] T013 Implement target availability model (`enabled`, `disabledReason`, allowlisted counts) in `apps/web/lib/actions/target-resolution.ts`
- [X] T014 [P] Implement allowlist-gated expert function resolver by exact signature in `apps/web/lib/actions/expert-functions.ts`
- [X] T015 Refactor shared action registry exports in `apps/web/lib/actions/registry.ts` to consume `allowlist.ts`, `target-resolution.ts`, and `expert-functions.ts` (remove heuristic mutable scan)
- [X] T016 Integrate target availability into `apps/web/components/drafts/draft-create-form.tsx` (targets visible, disabled reasons rendered)

**Checkpoint**: Composer wiring is driven by allowlist + target availability, not heuristics.

---

## Phase 4: User Story 1 - Build Safe Governed Actions Quickly (Priority: P1)

**Goal**: Ship SAFE-only guided templates with deterministic encoders and exclusion of non-governance actions.

**Independent Test**: In guided mode, user can queue supported governance templates and cannot queue disabled or excluded templates.

- [X] T017 [US1] Implement schema-driven guided template catalog in `apps/web/lib/actions/guided-templates.ts`
- [X] T018 [US1] Implement deterministic encoder utilities for guided templates in `apps/web/lib/actions/guided-templates.ts`
- [X] T019 [US1] Implement template input validation bounds and error messages in `apps/web/lib/actions/guided-templates.ts`
- [X] T020 [US1] Implement disabled semantics (missing module OR signature not allowlisted) in `apps/web/lib/actions/guided-templates.ts`
- [X] T021 [US1] Remove excluded non-governance guided templates from `apps/web/lib/actions/registry.ts` (requestStatus, contributor/version ops, escalation flows)
- [X] T022 [US1] Integrate guided template catalog into `apps/web/components/drafts/draft-create-form.tsx` guided builder path

**Checkpoint**: Guided mode is SAFE-only and enforces exclusions.

---

## Phase 5: User Story 2 - Compose Expert Raw ABI Actions Safely (Priority: P1)

**Goal**: Expert mode only exposes exact allowlisted signatures and blocks all others.

**Independent Test**: Expert mode shows only allowlisted functions for each target and never allows selecting non-allowlisted calls.

- [X] T023 [US2] Replace expert function source with exact-signature allowlist in `apps/web/components/drafts/draft-create-form.tsx`
- [X] T024 [US2] Ensure targets with zero allowlisted functions remain visible and disabled in `apps/web/components/drafts/draft-create-form.tsx`
- [X] T025 [US2] Preserve tuple/array raw ABI parameter handling with allowlisted fragments in `apps/web/components/drafts/draft-create-form.tsx`
- [X] T026 [US2] Add explicit non-allowlisted selection guard and error handling in `apps/web/components/drafts/draft-create-form.tsx`

**Checkpoint**: Expert mode is strictly allowlist-only with transparent disabled-state behavior.

---

## Phase 6: User Story 3 - Produce Deterministic Action Bundles (Priority: P1)

**Goal**: Ensure deterministic action bundle hashing and queue behavior in strict order.

**Independent Test**: Same ordered actions return identical hash; reordered actions return different hash.

- [X] T027 [US3] Implement bundle hash utility in `apps/web/lib/actions/bundle-hash.ts` using `keccak256(encodePacked(address[] targets,uint256[] values,bytes[] calldatas))`
- [X] T028 [US3] Replace inline hash computation with `computeActionsHash` usage in `apps/web/components/drafts/draft-create-form.tsx`
- [X] T029 [US3] Add action queue reorder controls and ordered state updates in `apps/web/components/drafts/draft-create-form.tsx`
- [X] T030 [US3] Update queued action preview rendering for reorder/remove correctness in `apps/web/components/drafts/draft-create-form.tsx`

**Checkpoint**: Bundle hash and queue behavior are deterministic and order-sensitive.

---

## Phase 7: User Story 4 - Cover Governance Targets Across Layers (Priority: P2)

**Goal**: Expand target coverage across required layer modules with allowlist-conditional availability.

**Independent Test**: Target matrix includes required contracts; unsupported/missing targets remain visible with explicit disabled reasons.

- [X] T031 [US4] Expand `ActionTargetId` and target definitions to required cross-layer set in `apps/web/lib/actions/registry.ts`
- [X] T032 [US4] Extend module-to-target resolution for required contracts in `apps/web/lib/actions/target-resolution.ts`
- [X] T033 [US4] Implement conditional inclusion rules for verifierManager/positionManager/credentialManager/communityRegistry based on allowlisted signatures in `apps/web/lib/actions/target-resolution.ts`
- [X] T034 [US4] Integrate expanded target matrix into expert and guided surfaces in `apps/web/components/drafts/draft-create-form.tsx`

**Checkpoint**: All required targets are represented with correct availability semantics.

---

## Phase 8: Validation & Tests

**Purpose**: Add and run required test coverage after implementation phases.

- [X] T035 Add allowlist loader schema and deterministic ordering tests in `apps/web/tests/unit/lib/actions/allowlist.test.ts`
- [X] T036 Add allowlist gating tests for exact-signature filtering in `apps/web/tests/unit/lib/actions/expert-functions.test.ts`
- [X] T037 Add guided encoding snapshot tests (one per v1 template) in `apps/web/tests/unit/lib/actions/guided-templates.test.ts`
- [X] T038 Add bundle hash determinism tests in `apps/web/tests/unit/lib/actions/bundle-hash.test.ts`
- [X] T039 Extend component disabled-state tests for missing modules and zero allowlisted functions in `apps/web/tests/unit/components/draft-create-form.test.tsx`
- [X] T040 Add regression test ensuring excluded non-governance actions are absent in `apps/web/tests/unit/lib/actions/guided-templates.test.ts`
- [X] T041 Run unit test suites via `pnpm --filter @shift/web vitest run tests/unit/lib/actions/*.test.ts` and `pnpm --filter @shift/web vitest run tests/unit/components/draft-create-form.test.tsx`
- [X] T046 Add empty-queue bundle determinism test for canonical empty bundle semantics in `apps/web/tests/unit/lib/actions/bundle-hash.test.ts`
- [X] T047 Add runtime profile cardinality test asserting exactly one canonical allowlist profile in `apps/web/tests/unit/lib/actions/allowlist.test.ts`
- [X] T048 Add compatibility regression test ensuring pre-feature drafts remain renderable/valid in `apps/web/tests/unit/components/draft-create-form.test.tsx`
- [X] T050 Add explicit queue-visibility tests for empty and non-empty states in `apps/web/tests/unit/components/draft-create-form.test.tsx`

---

## Phase 9: Documentation & Finalization

**Purpose**: Document behavior, exclusions, and allowlist regeneration workflow.

- [X] T042 Update governance composition terminology and mode behavior in `docs/EN/Flows.md`
- [X] T043 Document allowlist regeneration process and trigger conditions in `docs/EN/Flows.md`
- [X] T044 Document explicit exclusions (requestStatus, contributor/version ops, escalation, non-governance actions) in `docs/EN/Flows.md`
- [X] T045 Run quickstart validation checklist against implementation using `specs/008-draft-action-composer/quickstart.md`
- [X] T049 Add finalization checklist item verifying paired status-doc synchronization in `.github/project-management/IMPLEMENTATION_STATUS.md` and `.github/project-management/STATUS_REVIEW.md` when triggered
- [X] T051 Add monorepo scope guard check confirming no changes under `contracts/**` and `apps/indexer/**` for this feature
- [X] T053 Document ABI reality verification findings and exact-signature template rules in `specs/008-draft-action-composer/research.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 (Setup): starts immediately.
- Phase 2 (Foundational allowlist pipeline): depends on Phase 1; blocks all story work.
- Phase 3 (Foundational UI wiring): depends on Phase 2; blocks story-specific implementation.
- Phase 4 (US1): depends on Phase 3.
- Phase 5 (US2): depends on Phase 3 and can proceed in parallel with late US1 tasks if no same-file conflicts.
- Phase 6 (US3): depends on Phase 3 and integration points from US1/US2.
- Phase 7 (US4): depends on Phase 3 and interacts with US1/US2 target catalogs.
- Phase 8 (Validation & Tests): depends on Phases 4-7 completion.
- Phase 9 (Docs & Finalization): depends on Phase 8 results.

### User Story Dependencies

- US1: no dependency on other stories once foundational phases complete.
- US2: no dependency on other stories once foundational phases complete.
- US3: depends on queue/action integration from US1/US2 being stable.
- US4: depends on target model established in foundational phases; can integrate after US1/US2 target consumers are wired.

### Parallel Opportunities

- [P] tasks in setup/foundation can run in parallel by different contributors.
- US1 template encoder/validation tasks can run in parallel with US2 expert gating tasks after Phase 3.
- US4 target resolution extensions can run in parallel with US3 hash utility implementation.
- Test files in Phase 8 can be authored in parallel across `allowlist`, `expert-functions`, `guided-templates`, `bundle-hash`, and component tests.

---

## Parallel Example: User Story 1

```bash
Task: T018 [US1] Implement deterministic encoder utilities in apps/web/lib/actions/guided-templates.ts
Task: T019 [US1] Implement template input validation bounds in apps/web/lib/actions/guided-templates.ts
Task: T021 [US1] Remove excluded non-governance guided templates in apps/web/lib/actions/registry.ts
```

## Parallel Example: User Story 2

```bash
Task: T024 [US2] Keep zero-allowlisted targets visible/disabled in apps/web/components/drafts/draft-create-form.tsx
Task: T025 [US2] Preserve tuple/array raw parameter handling in apps/web/components/drafts/draft-create-form.tsx
```

## Parallel Example: User Story 3

```bash
Task: T027 [US3] Implement computeActionsHash in apps/web/lib/actions/bundle-hash.ts
Task: T029 [US3] Add action queue reorder controls in apps/web/components/drafts/draft-create-form.tsx
```

## Parallel Example: User Story 4

```bash
Task: T031 [US4] Expand ActionTargetId coverage in apps/web/lib/actions/registry.ts
Task: T032 [US4] Extend module target resolution in apps/web/lib/actions/target-resolution.ts
```

---

## Implementation Strategy

1. Complete foundational allowlist pipeline (Phases 1-2) to lock authority source and deterministic generation.
2. Complete shared UI wiring (Phase 3) so all feature work consumes one target/allowlist model.
3. Implement guided and expert behavior (Phases 4-5) with strict safety and gating constraints.
4. Implement deterministic queue/hash behavior and cross-layer target coverage (Phases 6-7).
5. Execute required test matrix (Phase 8) and close docs/finalization (Phase 9).
