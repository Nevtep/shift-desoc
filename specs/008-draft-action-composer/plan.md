# Implementation Plan: Draft Action Composer Timelock Surface

**Branch**: `008-draft-action-composer` | **Date**: 2026-04-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-draft-action-composer/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Evolve `DraftCreateForm` into the canonical governance action bundle composer by introducing: (1) a committed, script-generated Timelock allowlist authority for expert mode, (2) SAFE-only guided templates across required governance layers, and (3) strict deterministic bundle semantics including queue-order `actionsHash` hashing. Implementation is web-only (no contract/indexer changes), with one canonical v1 allowlist profile (Base Sepolia staging wiring), explicit disabled-state UX for unavailable modules/functions, and test coverage for allowlist gating, guided encoding snapshots, and hash determinism.

## Technical Context

**Language/Version**: TypeScript (Node >=22, Next.js App Router client components)  
**Primary Dependencies**: React 19, Next.js 16, `viem`, `wagmi`, existing web contract config/ABI utilities  
**Storage**: Committed static data files in repository (allowlist + templates definitions), no new persistent DB  
**Testing**: Vitest + Testing Library unit tests in `apps/web/tests/unit/**`  
**Target Platform**: Web dApp (`apps/web`) for Base Sepolia staging-first operations
**Project Type**: Monorepo web app feature (frontend + supporting scripts/docs)  
**Performance Goals**: Deterministic local encoding and hash recomputation with composition interactions remaining responsive under typical draft workloads (up to 20 queued actions)  
**Constraints**: No contract changes; no indexer changes; explicit allowlist only (no heuristics); one canonical v1 allowlist profile; community-scoped contracts must not require selector-overload resolution  
**Scale/Scope**: Draft composer surfaces, action registry/target resolution, one allowlist generation script, targeted unit/snapshot tests, and documentation updates

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Protocol infrastructure first: PASS. No protocol primitive changes; feature remains app-layer authoring UX for existing governance surfaces.
- Contract-first authority: PASS. Authority derives from canonical AccessManager/TL wiring selectors; app consumes committed allowlist generated from canonical source, not heuristic authority.
- Security/invariant preservation: PASS. Preserved invariants: Timelock-only privileged mutations, SAFE guided templates, non-governance exclusions, deterministic hash computation, and selector-uniqueness enforcement for community-scoped surfaces.
- Event/indexer discipline: PASS. No ABI/event/indexer changes; no replay/migration required.
- Monorepo vertical-slice scope: PASS with constrained slice. Impacted: web app code, web tests, docs, planning artifacts, script for allowlist generation. Unimpacted: contracts/indexer.
- Project-management docs sync: PASS (no status architecture/workflow changes requiring project-management files at plan stage).
- Compatibility discipline: PASS. Non-breaking for downstream dApps and existing proposal execution.

Post-Phase-1 re-check: PASS. Design artifacts maintain explicit non-goal boundaries (no contract/indexer changes), deterministic behaviors, and clear compatibility/migration constraints.

## Project Structure

### Documentation (this feature)

```text
specs/008-draft-action-composer/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
```text
apps/web/components/drafts/
apps/web/lib/actions/
apps/web/lib/deploy/
apps/web/lib/contracts/
apps/web/tests/unit/components/
apps/web/tests/unit/lib/
scripts/
docs/EN/
specs/008-draft-action-composer/
```

**Structure Decision**: Keep feature implementation inside `apps/web` with explicit separation of concerns: allowlist authority data + helpers in `apps/web/lib/actions`, UI composition in `apps/web/components/drafts`, and deterministic generation tooling under `scripts/`. Preserve existing module-address resolution via `CommunityRegistry.getCommunityModules` and add disabled-state modeling rather than protocol-side changes.

## Monorepo Impact Matrix

| Layer | Impacted? | Paths | Contract / Event / API Compatibility Notes |
|-------|-----------|-------|--------------------------------------------|
| Protocol Contracts | No | N/A | No ABI/event/permission mutations in this feature |
| Indexer (Ponder) | No | N/A | No schema, handler, replay, or migration impact |
| Manager App (Next.js) | Yes | `apps/web/components/drafts/draft-create-form.tsx`, `apps/web/lib/actions/*`, `apps/web/tests/unit/**` | Uses existing ABI + module wiring; narrows callable surfaces to explicit allowlist |
| Downstream dApp Surface | No | Existing `DraftsManager.createDraft` action bundle format | Bundle shape preserved (`targets`, `values`, `calldatas`, `actionsHash`) |
| Documentation | Yes | `docs/EN/Flows.md` and/or dedicated web governance composer docs | Clarifies SAFE guided mode, allowlist-only expert mode, exclusions, regeneration flow |

## Implementation Design (Concrete)

### 1) Code organization

- Allowlist file (runtime authority):
  - `apps/web/lib/actions/allowlists/base-sepolia-v1.json`
  - Schema:
    - `profileId: string`
    - `source: { wiringFile, selectionRule, generatedAt, generatorVersion }`
    - `targets: Array<{ targetId, contractName, signatures: string[] }>`
  - Runtime import path: `apps/web/lib/actions/allowlist.ts` (strict loader + schema validation + stable in-memory map)
- Guided templates catalog:
  - `apps/web/lib/actions/guided-templates.ts`
  - Template schema:
    - `templateId`, `label`, `description`, `effectCopy`
    - `targetId`, `signature`
    - `inputFields` (typed)
    - `validate(input)`
    - `encode(input, context)`
    - `disabledReason(context)`
  - Disabled semantics:
    - Missing module -> disabled with reason: `Module not configured for this community`
    - Signature not allowlisted -> disabled with reason: `Not available until permission wiring is updated`
- Target resolution mapping:
  - `apps/web/lib/actions/target-resolution.ts`
  - Maps `ActionTargetId -> moduleAddressResolver` using `CommunityRegistry.getCommunityModules`
  - `communityRegistry` resolved from static contract config, module-scoped targets from community wiring
  - Missing-module behavior: target remains visible, disabled with explicit reason

### 2) Allowlist generation pipeline (FR-004A)

- Generator script:
  - `scripts/generate-draft-composer-allowlist.ts`
- Inputs:
  - Canonical `selectorRoleAssignments` in `apps/web/lib/deploy/factory-step-executor.ts`
  - ABI artifacts consumed from web contract config/ABI map
- Selection logic:
  - Include signatures only where assignment role is AccessManager `ADMIN_ROLE` (the role handed to Timelock by handoff flow)
  - Exclude role-specific non-admin signatures (issuer/caller/minter, etc.)
- ABI verification:
  - For each selected signature, assert matching ABI function fragment exists for mapped target contract
  - Fail generation if any signature is missing/ambiguous
- Overloads:
  - Preserve full exact signatures as distinct entries
- Deterministic output:
  - Stable sort by `targetId`, then by signature
  - Deterministic JSON stringification and newline policy
  - Emit metadata report (`*.meta.json`) with signature counts and validation status
- Reviewability:
  - Script is run manually/CI pre-merge; output is committed and code-reviewed in PR diffs

### 3) Expert mode enforcement

- Replace current mutable-function heuristic in `getTargetFunctions()` with allowlist-gated resolution:
  - Resolve ABI fragments by exact allowlisted signature
  - Return only allowlisted entries
- Target visibility:
  - Show all required targets in expert mode
  - If target has zero allowlisted functions, mark disabled and display reason
- Raw input support:
  - Reuse existing tuple/array parameter input and encoding path in `ExpertActionBuilder`
  - Only source of selectable functions changes (allowlist-backed)

### 4) Guided templates catalog (v1)

Templates below are included only if signature is allowlisted and target address exists for community.

| Template ID | Target | Exact Signature | Inputs + Bounds | Overload Rule | Disabled Logic |
|-------------|--------|-----------------|-----------------|---------------|----------------|
| `var.setValuableActionSBT` | `valuableActionRegistry` | `setValuableActionSBT(address)` | `sbtAddress` (must be non-zero address) | N/A | Missing target/module or signature not allowlisted |
| `var.setIssuanceModule` | `valuableActionRegistry` | `setIssuanceModule(address,bool)` | `moduleAddress` (non-zero), `enabled` (bool) | N/A | Same |
| `var.addFounder` | `valuableActionRegistry` | `addFounder(address)` | `founderAddress` (non-zero) | Prefer one-arg founder add for v1 guided simplicity | Same |
| `vpt.initializeCommunity` | `verifierPowerToken` | `initializeCommunity(string)` | `metadataURI` (non-empty, max length guard) | N/A (single ABI signature) | Same |
| `vpt.setURI` | `verifierPowerToken` | `setURI(string)` | `uri` (non-empty, max length guard) | N/A | Same |
| `rr.setCommunityTreasury` | `revenueRouter` | unique allowlisted exact signature | `treasury` (non-zero address) | N/A (no overloads accepted for community-scoped contracts) | Same |
| `rr.setSupportedToken` | `revenueRouter` | unique allowlisted exact signature | `token` (non-zero), `enabled` | N/A (no overloads accepted for community-scoped contracts) | Same |
| `ta.setTokenAllowed` | `treasuryAdapter` | `setTokenAllowed(address,bool)` | `token`, `allowed` | N/A (single ABI signature) | Same |
| `ta.setCapBps` | `treasuryAdapter` | `setCapBps(address,uint16)` | `token`, `capBps` ($1-10000$) | N/A (single ABI signature) | Same |
| `ta.setDestinationAllowed` | `treasuryAdapter` | `setDestinationAllowed(address,bool)` | `destination`, `allowed` | N/A (single ABI signature) | Same |
| `mp.setCommunityActive` | `marketplace` | unique allowlisted exact signature | `active` (bool) | N/A (no overloads accepted for community-scoped contracts) | Same |
| `mp.setCommunityToken` | `marketplace` | unique allowlisted exact signature | `token` (non-zero) | N/A (no overloads accepted for community-scoped contracts) | Same |
| `pc.revenuePolicyPreset` | `paramController` | matching unique allowlisted revenue policy setter signature | `preset` enum + bounded scalar fields | N/A (no overloads accepted for community-scoped contracts) | Disabled entirely if not allowlisted |
| `pc.feePreset` | `paramController` | matching unique allowlisted fee setter signature | `preset` enum + bounded bps | N/A (no overloads accepted for community-scoped contracts) | Same |
| `pc.eligibilityPreset` | `paramController` | matching unique allowlisted eligibility setter signature | bounded ints from preset | N/A (no overloads accepted for community-scoped contracts) | Same |
| `ve.setVerifierSet` | `verifierElection` | `setVerifierSet(address[],uint256[],string)` | verifier addresses/powers length match; power > 0; reason length bounds | N/A | Disabled if signature not allowlisted |
| `ve.banVerifiers` | `verifierElection` | `banVerifiers(address[],string)` | non-empty addresses; reason bounds | N/A | Same |
| `ve.unbanVerifier` | `verifierElection` | `unbanVerifier(address,string)` | single non-zero address + reason bounds | N/A | Same |
| `ve.adjustVerifierPower` | `verifierElection` | `adjustVerifierPower(address,uint256,string)` | address + bounded power + reason bounds | N/A | Same |

Notes:
- Explicit exclusions remain hard-coded: request status changes, draft contributor/version ops, escalation flow actions, ProjectFactory templates.
- Guided encoding must call exact configured signature and never infer by function name.

### 5) Test plan

- Allowlist gating tests:
  - `apps/web/tests/unit/lib/actions/allowlist.test.ts`
  - Assert non-allowlisted functions are absent/unselectable; only allowlisted signatures appear.
- Guided encoding snapshot tests:
  - `apps/web/tests/unit/lib/actions/guided-templates.test.ts`
  - One snapshot case per v1 template with selector + encoded args checks.
- Hash determinism tests:
  - `apps/web/tests/unit/lib/actions/bundle-hash.test.ts`
  - Same ordered queue -> same hash; reordered queue -> different hash.
- Availability tests:
  - `apps/web/tests/unit/components/draft-create-form.test.tsx` (extended)
  - Missing module -> template/target disabled with reason.
  - Zero allowlisted functions -> target visible disabled with reason.

### 6) Documentation updates

- Update/extend docs in:
  - `docs/EN/Flows.md` (governance draft composition behavior)
  - Optional web-specific governance composer doc under `docs/EN/` if needed
- Must document:
  - Guided SAFE-only behavior
  - Expert allowlist-only behavior
  - Explicit exclusions
  - Allowlist regeneration command and when to run it (wiring/admin signature changes)

## Delivery phases

- Phase 0 (Research): lock authority source, hashing, exact-signature policy, profile strategy.
- Phase 1 (Design): data model, contracts, quickstart, concrete implementation plan.
- Phase 2 (Tasks, separate command): generate dependency-ordered tasks from this plan.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
