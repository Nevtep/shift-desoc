# Implementation Plan: Wizard Permission Parity + Allowlist Refresh + Guided Template Coverage

**Branch**: `010-wizard-permission-parity` | **Date**: 2026-04-09 | **Spec**: /Users/core/Code/shift/specs/010-wizard-permission-parity/spec.md
**Input**: Feature specification from /Users/core/Code/shift/specs/010-wizard-permission-parity/spec.md

## Summary

Implement a deterministic, fail-closed permission-to-composer pipeline where wizard wiring is the sole source of truth:
1. Extract selector-role assignments into a verifiable permission matrix.
2. ABI-validate every signature and selector.
3. Derive timelock surface strictly from ADMIN_ROLE mappings with confirmed post-handoff Timelock ownership.
4. Regenerate allowlist artifacts from that canonical surface.
5. Align Expert targets and Guided templates to allowlist reality across all layers.
6. Produce human/machine reports and tests proving parity.

No contract source edits are allowed.

## Technical Context

**Language/Version**: TypeScript (Node 22), Next.js app TypeScript, viem ABI utilities  
**Primary Dependencies**: viem, ts-node, Vitest, existing web ABI artifacts under apps/web/abis  
**Storage**: JSON and Markdown artifacts in repository (no DB changes)  
**Testing**: Vitest unit tests under apps/web/tests/unit + script execution checks  
**Target Platform**: Monorepo tooling on macOS/Linux CI runners  
**Project Type**: Monorepo web + scripts (contracts unchanged)  
**Performance Goals**: Deterministic generation with stable ordering and bounded local runtime (<10s typical)  
**Constraints**: No contract changes; no signature guessing; fail closed on ABI mismatch; Expert allowlist-only; Guided safe-only  
**Scale/Scope**: ~25-50 selector mappings and ~10-20 allowlisted targets/signature groups in base-sepolia profile

## Constitution Check (Pre-Phase 0)

Gate status: PASS

- Protocol infrastructure first: PASS. Changes are app/script/report artifacts only; no protocol primitive behavior changes.
- Contract-first authority: PASS. Authority is derived from wizard AccessManager wiring plus ABI reality; no shadow authority introduced.
- Security/invariant preservation: PASS. Timelock/AccessManager authority is made stricter and auditable.
- Event/indexer discipline: PASS. No event/ABI interface mutations in contracts; indexer untouched.
- Monorepo vertical-slice scope: PASS. Scripts, web composer, tests, and docs are included in scope.
- Project-management docs sync: CONDITIONAL. Update status docs only if implementation changes status/risk/workflow statements.
- Compatibility discipline: PASS. No breaking contract/event changes; allowlist tightening may hide previously surfaced but unauthorized actions (documented in release notes/gap report).

## Concrete Design Anchors

### A) Permission Matrix extraction design (US1)

Canonical source and key anchors in factory wizard wiring:
- selector assignments declaration: apps/web/lib/deploy/factory-step-executor.ts:2694
- selector generation helper: apps/web/lib/deploy/factory-step-executor.ts:712
- bootstrap application call: apps/web/lib/deploy/factory-step-executor.ts:3033
- admin role read helper: apps/web/lib/deploy/factory-step-executor.ts:1118
- handoff grant to timelock: apps/web/lib/deploy/factory-step-executor.ts:3135
- bootstrap coordinator admin revoke: apps/web/lib/deploy/factory-step-executor.ts:3153
- deployer/handoff account admin revoke + post-check: apps/web/lib/deploy/factory-step-executor.ts:3170 and apps/web/lib/deploy/factory-step-executor.ts:3204

Matrix normalization schema:
- { contractName, targetKey, targetVariable, signature, selector, roleName, roleValue, sourceLine }

Parsing approach:
1. Reuse generator-level extraction of selectorRoleAssignments block from factory-step-executor.
2. Resolve each target variable to a canonical targetKey/contractName dictionary (including currently skipped targets like commerceDisputes, engagements, housingManager, draftsManager when present).
3. Expand each signature into one matrix row; compute selector from exact signature text using keccak selector logic.
4. Capture role semantics:
   - roleName = ADMIN_ROLE if assignment role expression equals adminRole.
   - otherwise preserve explicit role constant (e.g., ROLES.* or numeric).

End-state ownership confirmation:
1. Static proof from handoff step sequence (grant timelock admin; revoke bootstrap; revoke handoff account; assert timelock true and deployer false).
2. Optional runtime verifier script reads hasRole(ADMIN_ROLE, timelock/deployer/bootstrap) from deployed accessManager and emits evidence JSON for selected deployment.

### B) ABI validation strategy (fail-closed)

ABI baseline:
- Primary: apps/web/abis/<Contract>.json artifacts consumed by web app.
- Validation excludes contracts without web ABI artifact mapping only if they are not targetable in composer; otherwise treated as failure.

Rules:
1. Each matrix signature MUST match exactly one function signature string in target ABI (name + ordered canonical param types; tuple formatting included).
2. Selector from matrix signature MUST equal selector derived from matched ABI fragment.
3. Any missing signature or selector mismatch writes failure artifact and aborts generation.

Failure/Success artifacts:
- specs/010-wizard-permission-parity/contracts/permission-matrix.json (successful normalized matrix)
- specs/010-wizard-permission-parity/contracts/signature-not-found.json (failure detail; non-empty means generation step fails)

### C) Timelock surface artifact generation

Filtering rule:
- Include matrix entries only where roleName is ADMIN_ROLE AND handoff confirmation proves Timelock owns ADMIN_ROLE post-handoff.

Output artifact:
- specs/010-wizard-permission-parity/contracts/timelock-surface.json
- Grouping: contractName + targetKey with sorted signatures and selectors.

### D) Allowlist refresh pipeline (US2)

Generator path:
- scripts/generate-draft-composer-allowlist.ts

Pipeline refactor plan:
1. Replace direct loose parsing output with canonical intermediate permission matrix + timelock surface generation.
2. Remove heuristic or manually narrowed signature subsets except explicit policy exclusions documented in code + report.
3. Ensure deterministic target/signature ordering.
4. Regenerate:
   - apps/web/lib/actions/allowlists/base-sepolia-v1.json
   - apps/web/lib/actions/allowlists/base-sepolia-v1.meta.json
5. Add deterministic CI assertion test: generated profile must byte-equal committed profile (or stable snapshot hash).

### E) Expert target alignment (US3)

Relevant files:
- apps/web/lib/actions/registry.ts
- apps/web/lib/actions/target-resolution.ts
- apps/web/lib/actions/allowlist.ts
- apps/web/lib/actions/expert-functions.ts

Coverage objective:
- Ensure all timelock-relevant modules are represented as target definitions and resolvable module keys (including DraftsManager when/if allowlisted).

Enablement rule (authoritative):
1. module address exists for community
2. allowlist has >=1 signature for that target
Else: target visible but disabled with deterministic reason.

Disabled reasons:
- Module not configured for this community
- No timelock-allowlisted functions available

### F) Guided template coverage refresh (US4)

Inputs:
- docs/EN/Layers.md
- docs/EN/Flows.md
- current template source: apps/web/lib/actions/guided-templates.ts

Approach:
1. Create crucial-flow catalog mapped by layer.
2. For each flow map: targetKey + exact signature + safety constraints + plain-language effect copy.
3. Templates remain SAFE-only; no raw unsafe operations.
4. Template enablement gates on allowlist membership.
5. Non-executable crucial flow remains listed but disabled with reason:
   - Not timelock-executable by current deploy wiring
6. Emit gap report entries for each disabled crucial flow needing selectorRoleAssignments additions.

### Initial Crucial Flows v1 (to be sourced from docs/EN/Layers.md + docs/EN/Flows.md)

Baseline catalog flowIds across all five layers:
- coordination.paramController.setGovernanceParams
- coordination.paramController.setEligibilityParams
- coordination.paramController.setRevenuePolicy
- governance.timelock.executeQueuedProposalAction
- verification.verifierElection.setVerifierSet
- verification.valuableActionRegistry.activateFromGovernance
- economy.treasuryAdapter.setCapBps
- economy.revenueRouter.setSupportedToken
- commerce.marketplace.setCommunityActive
- commerce_housing.marketplace.setCommerceDisputes

Catalog contract:
- Catalog entries MUST conform to specs/010-wizard-permission-parity/contracts/crucial-flows-catalog.schema.json.
- Every entry MUST include enabled/disabled state and disabledReason when disabled.

### G) Reports and docs

Required outputs:
- docs/permission-matrix.md (human-readable verified matrix + handoff conclusions)
- specs/010-wizard-permission-parity/contracts/permission-matrix.json
- specs/010-wizard-permission-parity/contracts/timelock-surface.json
- specs/010-wizard-permission-parity/contracts/signature-not-found.json (failure artifact format; empty/absent on success)
- docs or specs gap report (recommended: specs/010-wizard-permission-parity/gap-report.md)

Status docs policy:
- Update .github/project-management/STATUS_REVIEW.md when behavior/reporting status materially changes.
- Update .github/project-management/IMPLEMENTATION_STATUS.md only if roadmap/status semantics are affected.

Documentation sync (DT-001, conditional):
- If shipped behavior changes (allowlist surface, expert target availability, guided template enablement), update:
   - neuromancer/SHIFT_SYSTEM.md
   - contracts/FEATURES.md

## Project Structure

### Documentation (this feature)

```text
specs/010-wizard-permission-parity/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── permission-matrix.schema.json
│   ├── timelock-surface.schema.json
│   ├── signature-not-found.schema.json
│   └── crucial-flows-catalog.schema.json
└── tasks.md  # generated later by /speckit.tasks
```

### Source Code (repository root)

```text
apps/web/lib/deploy/factory-step-executor.ts
scripts/generate-draft-composer-allowlist.ts
apps/web/lib/actions/allowlist.ts
apps/web/lib/actions/registry.ts
apps/web/lib/actions/target-resolution.ts
apps/web/lib/actions/expert-functions.ts
apps/web/lib/actions/guided-templates.ts
apps/web/lib/actions/allowlists/base-sepolia-v1.json
apps/web/lib/actions/allowlists/base-sepolia-v1.meta.json
apps/web/tests/unit/lib/actions/allowlist.test.ts
apps/web/tests/unit/lib/actions/expert-functions.test.ts
apps/web/tests/unit/lib/actions/guided-templates.test.ts
docs/EN/Layers.md
docs/EN/Flows.md
docs/permission-matrix.md
```

**Structure Decision**: Keep all behavior in web/script layers; contracts remain untouched; add spec-local schema artifacts to make tasks/implementation validation deterministic.

## Monorepo Impact Matrix

| Layer | Impacted? | Paths | Contract / Event / API Compatibility Notes |
|-------|-----------|-------|--------------------------------------------|
| Protocol Contracts | No | contracts/** | No source/interface/event changes allowed by FR-016 |
| Indexer (Ponder) | No | apps/indexer/** | No new event dependencies |
| Manager App (Next.js) | Yes | apps/web/lib/actions/**, apps/web/lib/deploy/factory-step-executor.ts | UI target/template behavior strictly tied to allowlist reality |
| Downstream dApp Surface | Yes | apps/web/lib/actions/allowlists/*.json | Allowlist profile may tighten to true authority surface |
| Documentation | Yes | docs/permission-matrix.md, specs/010-wizard-permission-parity/** | Adds verification evidence and gap analysis |

## Phase 0: Research Plan

Research outputs are in research.md and resolve these decisions:
1. Canonical extraction source and parser strategy.
2. ABI signature canonicalization and selector verification method.
3. Deterministic artifact generation and CI drift detection strategy.
4. Guided template crucial-flow taxonomy policy.
5. Report placement and auditability format.

## Phase 1: Design Plan

Design outputs:
1. data-model.md
2. contracts/*.schema.json
3. quickstart.md

Design commitments:
- Every artifact has explicit schema and deterministic sort rules.
- Every enable/disable decision is explainable from module address + allowlist evidence.
- Every crucial flow is present in catalog with enabled/disabled state and reason.

## Phase 2: Implementation Planning (for /speckit.tasks)

Planned implementation work packages:
1. Permission matrix extraction module + tests.
2. ABI validator module + fail-closed failure artifact behavior.
3. Timelock surface derivation + output artifacts.
4. Allowlist generator integration and deterministic emission.
5. Expert target availability updates + deterministic disabled reasons.
6. Guided template catalog refresh + allowlist-gated enablement.
7. Docs/report generation (permission matrix + gap report).
8. Unit/snapshot/determinism tests and command-level verification.

## Constitution Check (Post-Phase 1 Design)

Gate status: PASS

- Protocol infrastructure first: PASS (app/script/report only).
- Contract-first authority: PASS (wiring + ABI as single source-of-truth).
- Security/invariant preservation: PASS (timelock/admin handoff evidence required).
- Event/indexer discipline: PASS (no event changes).
- Monorepo vertical-slice scope: PASS (scripts, app logic, tests, docs all included).
- Project-management docs sync: PASS with conditional updates rule captured.
- Compatibility discipline: PASS (profile drift is explicit and documented).

## Complexity Tracking

No constitution violations requiring justification.
