# Tasks: Wizard Permission Parity + Allowlist Refresh + Guided Template Coverage

**Input**: Design documents from /specs/010-wizard-permission-parity/
**Prerequisites**: plan.md, spec.md, requirements.md (resolved as checklists/requirements.md in this feature), data-model.md, research.md, quickstart.md, contracts/*.schema.json, .specify/memory/constitution.md

**Tests**: Web/script unit tests and deterministic generation checks are required for this feature.

## Phase 1: Setup

**Purpose**: Prepare deterministic generation workflow and artifact validation surfaces.

- [x] T001 Create implementation runbook checklist in specs/010-wizard-permission-parity/checklists/implementation-readiness.md
- [x] T002 Add feature artifact path constants and output file map in scripts/generate-draft-composer-allowlist.ts
- [x] T003 [P] Add quickstart skeleton sections (commands to be finalized in Polish phase) in specs/010-wizard-permission-parity/quickstart.md

---

## Phase 2: Foundational

**Purpose**: Build shared extraction/validation primitives used by all user stories.

**CRITICAL**: No user story work starts before this phase is complete.

- [x] T004 Implement permission matrix domain types and parse result types in apps/web/lib/actions/permission-matrix.ts
- [x] T005 [P] Implement ABI signature canonicalization and selector computation helpers in apps/web/lib/actions/permission-matrix.ts
- [x] T006 [P] Implement deterministic stable JSON serializer and sorter utilities in scripts/generate-draft-composer-allowlist.ts
- [x] T007 Implement schema validation helpers for permission-matrix, timelock-surface, signature-not-found, and crucial-flows-catalog artifacts in scripts/generate-draft-composer-allowlist.ts
- [x] T008 [P] Add foundational tests for canonical signature formatting and selector generation in apps/web/tests/unit/lib/actions/permission-matrix.test.ts
- [x] T009 [P] Add foundational tests for stable deterministic serialization behavior in apps/web/tests/unit/lib/actions/allowlist-generator-determinism.test.ts

**Checkpoint**: Shared parser, ABI canonicalization, deterministic serialization, and schema checks are in place.

---

## Phase 3: User Story 1 - Permission Matrix (Priority: P1)

**Goal**: Extract wizard selector-role assignments into a deterministic, collision-safe, ABI-verified permission matrix.

**Independent Test**: Matrix generation emits schema-valid permission-matrix.json and fails closed with schema-valid signature-not-found.json when ABI signature mismatch, artifact_missing, or selector collision occurs.

### Tests for User Story 1

- [x] T010 [P] [US1] Add extraction coverage tests for selectorRoleAssignments parsing from apps/web/lib/deploy/factory-step-executor.ts in apps/web/tests/unit/lib/actions/permission-matrix.test.ts
- [x] T011 [P] [US1] Add fail-closed tests for missing ABI signatures and artifact_missing mappings in apps/web/tests/unit/lib/actions/permission-matrix.test.ts
- [x] T012 [P] [US1] Add collision detection tests for same targetKey+selector mapping to different signatures or roles in apps/web/tests/unit/lib/actions/permission-matrix.test.ts
- [x] T013 [P] [US1] Add exact-duplicate deduplication tests preserving deterministic output ordering in apps/web/tests/unit/lib/actions/permission-matrix.test.ts

### Implementation for User Story 1

- [x] T014 [US1] Implement selectorRoleAssignments extractor in apps/web/lib/actions/permission-matrix.ts using apps/web/lib/deploy/factory-step-executor.ts as source
- [x] T015 [US1] Implement deterministic matrix normalization {contractName,targetKey,targetVariable,signature,selector,roleName,roleValue,sourceFile,sourceLine} in apps/web/lib/actions/permission-matrix.ts
- [x] T016 [US1] Implement ABI verification against apps/web/abis artifacts with artifact_missing failure mode in apps/web/lib/actions/permission-matrix.ts
- [x] T017 [US1] Implement selector collision detection and fail-closed report emission in apps/web/lib/actions/permission-matrix.ts
- [x] T018 [US1] Emit schema-valid permission matrix artifact to specs/010-wizard-permission-parity/contracts/permission-matrix.json in scripts/generate-draft-composer-allowlist.ts
- [x] T019 [US1] Emit schema-valid signature mismatch/failure artifact to specs/010-wizard-permission-parity/contracts/signature-not-found.json in scripts/generate-draft-composer-allowlist.ts

**Checkpoint**: Permission matrix generation is deterministic, ABI-verified, deduplicated, collision-safe, and fail-closed.

---

## Phase 4: User Story 2 - Timelock Surface + Allowlist (Priority: P2)

**Goal**: Derive evidence-based timelock surface and regenerate deterministic allowlist/meta from verified artifacts.

**Independent Test**: Timelock surface contains ADMIN_ROLE-only rows when handoffVerified is true; allowlist generator consumes verified artifacts and two consecutive runs produce byte-identical outputs.

### Tests for User Story 2

- [x] T020 [P] [US2] Add tests for ADMIN_ROLE-only timelock surface filtering with handoffVerified gating in apps/web/tests/unit/lib/actions/timelock-surface.test.ts
- [x] T021 [P] [US2] Add tests for static handoff evidence extraction from handoff anchors in apps/web/tests/unit/lib/actions/timelock-surface.test.ts
- [x] T022 [P] [US2] Add optional runtime verifier test harness behavior checks in apps/web/tests/unit/lib/actions/timelock-surface.test.ts
- [x] T023 [P] [US2] Add allowlist pipeline determinism test running generator twice and comparing output bytes in apps/web/tests/unit/lib/actions/allowlist-generator-determinism.test.ts
- [x] T024 [P] [US2] Add allowlist metadata count/hash consistency tests in apps/web/tests/unit/lib/actions/allowlist.test.ts
- [x] T025 [P] [US2] Add compatibility regression tests for stable calldata encoding of unchanged allowlisted signatures in apps/web/tests/unit/lib/actions/allowlist.test.ts

### Implementation for User Story 2

- [x] T026 [US2] Implement timelock surface derivation from verified permission-matrix with ADMIN_ROLE filtering and handoffVerified evidence in apps/web/lib/actions/timelock-surface.ts
- [x] T027 [US2] Emit schema-valid timelock-surface.json to specs/010-wizard-permission-parity/contracts/timelock-surface.json in scripts/generate-draft-composer-allowlist.ts
- [x] T028 [US2] Update generator orchestration to consume verified timelock-surface.json (or matrix + evidence) as canonical input in scripts/generate-draft-composer-allowlist.ts
- [x] T029 [US2] Regenerate deterministic allowlist profile in apps/web/lib/actions/allowlists/base-sepolia-v1.json
- [x] T030 [US2] Regenerate deterministic allowlist metadata in apps/web/lib/actions/allowlists/base-sepolia-v1.meta.json
- [x] T031 [US2] Update allowlist loader invariants for deterministic profile/meta guarantees in apps/web/lib/actions/allowlist.ts
- [x] T057 [US2] Implement optional runtime handoff verifier command/script that reads AccessManager hasRole evidence for timelock/bootstrap/deployer in scripts/verify-handoff-admin-role.ts
- [x] T058 [US2] Add runtime handoff verifier usage and expected output contract to specs/010-wizard-permission-parity/quickstart.md

**Checkpoint**: Timelock surface and allowlist pipeline are evidence-based, deterministic, and CI-verifiable.

---

## Phase 5: User Story 3 - Expert Targets (Priority: P3)

**Goal**: Align target visibility and enablement rules to module presence plus allowlisted signatures, including DraftsManager behavior.

**Independent Test**: Targets are visible in Expert mode; target is enabled only when module exists and allowlist count > 0; DraftsManager target appears iff allowlisted signatures exist, otherwise disabled with explicit reason.

### Tests for User Story 3

- [x] T032 [P] [US3] Add target visibility tests ensuring visible-but-disabled behavior when module missing in apps/web/tests/unit/lib/actions/expert-target-resolution.test.ts
- [x] T033 [P] [US3] Add target enablement tests for module exists plus allowlist signatures in apps/web/tests/unit/lib/actions/expert-target-resolution.test.ts
- [x] T034 [P] [US3] Add explicit disabled reason string tests for module missing and no allowlisted functions in apps/web/tests/unit/lib/actions/expert-target-resolution.test.ts
- [x] T035 [P] [US3] Add DraftsManager conditional target tests for allowlisted versus non-allowlisted states in apps/web/tests/unit/lib/actions/expert-target-resolution.test.ts

### Implementation for User Story 3

- [x] T036 [US3] Add or refresh module target definitions including DraftsManager in apps/web/lib/actions/registry.ts
- [x] T037 [US3] Update target resolution logic for visible-but-disabled behavior with deterministic reason strings in apps/web/lib/actions/target-resolution.ts
- [x] T038 [US3] Ensure expert function derivation remains exact-signature allowlist-only in apps/web/lib/actions/expert-functions.ts

**Checkpoint**: Expert target behavior is deterministic, policy-aligned, and test-covered.

---

## Phase 6: User Story 4 - Crucial Flows + Guided Templates (Priority: P4)

**Goal**: Implement schema-valid crucial flow catalog and guided template coverage for Initial Crucial Flows v1 with deterministic disabled reasons for non-allowlisted or non-representable flows.

**Independent Test**: Crucial-flows catalog includes all 10 baseline flowIds across five layers, validates schema, and every entry contains enabled/disabled and disabledReason when disabled; guided templates are allowlist-gated with snapshot tests for enabled calldata.

### Tests for User Story 4

- [x] T039 [P] [US4] Add schema and baseline flowId coverage tests for crucial-flow catalog in apps/web/tests/unit/lib/actions/crucial-flows-catalog.test.ts
- [x] T040 [P] [US4] Add tests for required disabledReason on disabled catalog entries in apps/web/tests/unit/lib/actions/crucial-flows-catalog.test.ts
- [x] T041 [P] [US4] Add guided-template availability tests for module missing, not allowlisted, and non-representable flow states in apps/web/tests/unit/lib/actions/guided-templates.test.ts
- [x] T042 [P] [US4] Add guided-template calldata snapshot tests for enabled templates only in apps/web/tests/unit/lib/actions/guided-templates.test.ts

### Implementation for User Story 4

- [x] T043 [US4] Create or update crucial flow catalog in specs/010-wizard-permission-parity/contracts/crucial-flows-catalog.json using Initial Crucial Flows v1 from plan.md
- [x] T044 [US4] Enforce catalog schema conformance checks against specs/010-wizard-permission-parity/contracts/crucial-flows-catalog.schema.json in scripts/generate-draft-composer-allowlist.ts
- [x] T045 [US4] Map each flowId to either an allowlisted guided template or deterministic disabled entry reason in apps/web/lib/actions/guided-templates.ts
- [x] T046 [US4] Add deterministic disabledReason for non-representable composer flows (including execute queued action flow) in specs/010-wizard-permission-parity/contracts/crucial-flows-catalog.json

**Checkpoint**: Crucial flow catalog and guided templates are schema-valid, allowlist-gated, and deterministic for disabled states.

---

## Phase 7: Polish & Docs

**Purpose**: Produce reports, close documentation obligations, and finalize runnable validation commands.

- [x] T047 [P] [docs] Produce human-readable permission matrix report with role/selector/handoff conclusions in docs/permission-matrix.md
- [x] T048 [P] [docs] Produce gap report listing desired but non-timelock-executable flows and required selectorRoleAssignments in specs/010-wizard-permission-parity/gap-report.md
- [x] T049 [docs] Add explicit authority mapping note from derived artifacts to canonical on-chain wiring in docs/permission-matrix.md
- [x] T050 [docs] Add release-note rationale section for removed or disabled expert actions caused by corrected authority mapping in specs/010-wizard-permission-parity/gap-report.md
- [x] T051 [docs] Run terminology consistency pass for new artifacts using Shift canonical terms in docs/permission-matrix.md and specs/010-wizard-permission-parity/gap-report.md
- [x] T052 [docs] Apply DT-001 conditional sync update in neuromancer/SHIFT_SYSTEM.md when shipped behavior changed (allowlist surface, expert targets, guided template enablement)
- [x] T053 [docs] Apply DT-001 conditional sync update in contracts/FEATURES.md when shipped behavior changed (allowlist surface, expert targets, guided template enablement)
- [x] T054 [P] [docs] Update .github/project-management/STATUS_REVIEW.md and .github/project-management/IMPLEMENTATION_STATUS.md together when status/risk/priority/workflow content changed
- [x] T055 [docs] Finalize quickstart commands for matrix extraction, allowlist generation, determinism check, and tests in specs/010-wizard-permission-parity/quickstart.md
- [x] T056 Run and capture final validation commands in specs/010-wizard-permission-parity/checklists/implementation-readiness.md: pnpm generate:composer-allowlist, re-run pnpm generate:composer-allowlist and confirm no diff in allowlist artifacts, pnpm --filter @shift/web vitest run tests/unit/lib/actions/permission-matrix.test.ts, pnpm --filter @shift/web vitest run tests/unit/lib/actions/timelock-surface.test.ts, pnpm --filter @shift/web vitest run tests/unit/lib/actions/allowlist.test.ts, pnpm --filter @shift/web vitest run tests/unit/lib/actions/allowlist-generator-determinism.test.ts, pnpm --filter @shift/web vitest run tests/unit/lib/actions/expert-target-resolution.test.ts, pnpm --filter @shift/web vitest run tests/unit/lib/actions/expert-functions.test.ts, pnpm --filter @shift/web vitest run tests/unit/lib/actions/crucial-flows-catalog.test.ts, pnpm --filter @shift/web vitest run tests/unit/lib/actions/guided-templates.test.ts.

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 (Setup): starts immediately.
- Phase 2 (Foundational): depends on Setup and blocks story phases.
- Phase 3-6 (User Stories): start after Foundational completion.
- Phase 7 (Polish/Docs): depends on completion of selected story work.

### User Story Dependencies

- US1 depends on Foundational only.
- US2 depends on US1 outputs (permission-matrix.json and handoff evidence).
- US3 depends on US2 allowlist outputs.
- US4 depends on US2 allowlist outputs and can proceed independently from US3.

### Task Dependency Graph

- T014 -> T015 -> T016 -> T017 -> T018 -> T019
- T018/T019 -> T026 -> T027 -> T028 -> T029 -> T030 -> T031 -> T057 -> T058
- T029/T030 -> T032 -> T033 -> T034 -> T035 -> T036 -> T037 -> T038
- T029/T030 -> T039 -> T040 -> T041 -> T042 -> T043 -> T044 -> T045 -> T046
- T018/T027/T029/T030/T037/T045 -> T047 -> T049
- T048 -> T050
- T047/T048/T050/T051 -> T052/T053/T055/T056

---

## Parallel Execution Examples

### User Story 1

- Run T010, T011, T012, and T013 in parallel while implementing T014-T019 sequentially.

### User Story 2

- Run T020, T021, T022, T023, T024, and T025 in parallel while implementing T026-T031 sequentially.

### User Story 3

- Run T032, T033, T034, and T035 in parallel while implementing T036-T038 sequentially.

### User Story 4

- Run T039, T040, T041, and T042 in parallel while implementing T043-T046 sequentially.

---

## Delivery Strategy

1. Complete Setup and Foundational phases.
2. Deliver US1 and validate fail-closed matrix behavior.
3. Deliver US2 and validate handoff-evidence filtering plus deterministic allowlist regeneration.
4. Deliver US3 and validate expert target visibility/enablement/reasons.
5. Deliver US4 and validate catalog/template gating including non-representable flow handling.
6. Complete Polish/Docs tasks and final validation capture.

---

## Notes

- No tasks edit contract source files under contracts/**.
- Missing ABI artifact mapping is a fail-closed condition (artifact_missing).
- Selector collisions are fail-closed and must never be silently overwritten.
- Guided templates remain safe-only and expert functions remain allowlist-only.
