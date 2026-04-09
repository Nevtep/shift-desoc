# Research: Draft Action Composer Timelock Surface

## Decision 1: Runtime allowlist source
- Decision: Use one committed versioned allowlist file in-repo for v1 runtime authority.
- Rationale: Deterministic behavior, PR-reviewable changes, no runtime drift from environment artifacts, explicit governance safety boundary.
- Alternatives considered:
  - Dynamic startup derivation from deploy artifacts: rejected for runtime drift and weaker reviewability.
  - Hybrid base + dynamic extension: rejected for v1 due to increased complexity and ambiguity.

## Decision 2: Allowlist authority extraction input
- Decision: Generate allowlist from canonical selector-role assignments in `apps/web/lib/deploy/factory-step-executor.ts`, selecting signatures bound to `ADMIN_ROLE` that are handed to Timelock after handoff.
- Rationale: Matches approved spec source-of-truth and existing wizard wiring semantics.
- Alternatives considered:
  - Scanning all mutable ABI functions: rejected (heuristic, violates FR-002).
  - Manual hand-maintained list only: rejected as error-prone without generation pipeline.

## Decision 3: Allowlist generation and reviewability
- Decision: Add a deterministic generator script (proposed path: `scripts/generate-draft-composer-allowlist.ts`) that outputs stable-sorted JSON and validates signatures against ABI artifacts.
- Rationale: Satisfies FR-004A and makes diffs reviewable/reproducible.
- Alternatives considered:
  - Runtime schema-free object literal in app code: rejected for poor auditability and update ergonomics.
  - Script output without ABI validation: rejected for signature drift risk.

## Decision 4: Community-scoped selector overload invariant
- Decision: Community-scoped contracts must not expose overloaded function names. Any detected overload in a community-scoped contract is treated as an invariant violation and excluded from guided-template inclusion.
- Rationale: Removes selector ambiguity at source, simplifies governance authoring safety guarantees, and prevents drift between ABI evolution and UI behavior.
- Alternatives considered:
  - Represent overloads as independent exact signatures: rejected for community-scoped surfaces because this tolerates ambiguous API design and complicates operator safety policy.

## Decision 5: Expert-mode target UX for unavailable actions
- Decision: Keep targets visible and disabled with explicit reason when module missing or when allowlisted signatures for that target are empty.
- Rationale: Operational transparency and explicit permission-gap signaling.
- Alternatives considered:
  - Hide unavailable targets: rejected because it obscures governance capability gaps.

## Decision 6: Guided template safety model
- Decision: Guided templates are schema-driven, bounded inputs, and deterministic encoders that rely only on unique exact signatures for community-scoped contract operations.
- Rationale: Enforces SAFE-only behavior and keeps template behavior independent of overload resolution logic.
- Alternatives considered:
  - User selector/overload toggle in guided mode: rejected due to footgun risk and added complexity.

## Verification: Community-scoped overload audit (2026-04-09)
- Method:
  - Scanned Solidity files under `contracts/modules` and `contracts/tokens`.
  - Marked contracts as community-scoped if at least one function includes a `communityId` parameter.
  - Within that set, detected duplicate function names (selector overload candidates) per contract.
- Result summary:
  - No overloads detected in: `CommunityRegistry.sol`, `ParamController.sol`, and factory layer contracts.
  - One overload detected in `RequestHub.sol`:
    - `getRequestsByTag(uint256 communityId, string calldata tag)`
    - `getRequestsByTag(string calldata tag)`
- Interpretation:
  - This violates the no-overload invariant for community-scoped contracts and must be remediated in contract scope outside this web-only feature.
  - For this feature, any affected selector surface is treated as fail-closed for guided-template inclusion until protocol remediation is completed.

## ABI Reality Table (source of truth: apps/web/abis + contracts/*.sol)

| Contract | Function Name | Exact Signatures In ABI | Overload | Notes |
|----------|---------------|-------------------------|----------|-------|
| TreasuryAdapter | setTokenAllowed | `setTokenAllowed(address,bool)` | No | No `communityId` overload exists in ABI/source. |
| TreasuryAdapter | setCapBps | `setCapBps(address,uint16)` | No | No `communityId` overload exists in ABI/source. |
| TreasuryAdapter | setDestinationAllowed | `setDestinationAllowed(address,bool)` | No | No `communityId` overload exists in ABI/source. |
| RevenueRouter | setCommunityTreasury | `setCommunityTreasury(address)` | No | Single signature only. |
| RevenueRouter | setSupportedToken | `setSupportedToken(address,bool)` | No | Single signature only. |
| Marketplace | setCommunityActive | `setCommunityActive(bool)` | No | Single signature only. |
| Marketplace | setCommunityToken | `setCommunityToken(address)` | No | Single signature only. |
| VerifierPowerToken1155 | initializeCommunity | `initializeCommunity(string)` | No | Single signature only. |
| VerifierPowerToken1155 | setURI | `setURI(string)` | No | Single signature only. |
| ValuableActionRegistry | setValuableActionSBT | `setValuableActionSBT(address)` | No | Single signature only. |
| ValuableActionRegistry | setIssuanceModule | `setIssuanceModule(address,bool)` | No | Single signature only. |
| ValuableActionRegistry | setCommunityIssuanceModule | `setCommunityIssuanceModule(address,bool)` | No | Single signature only. |
| ParamController | all mutators/accessors | unique signatures per function name | No | No overloaded function names found in ABI/source. |
| RequestHub | getRequestsByTag | `getRequestsByTag(uint256,string)`, `getRequestsByTag(string)` | Yes | Existing overload detected; not used for guided governance templates in this feature. |

## Decision 7: Deterministic bundle hashing
- Decision: Keep `actionsHash = keccak256(encodePacked(address[] targets, uint256[] values, bytes[] calldatas))` in strict queue order.
- Rationale: Matches existing implementation and approved clarification; avoids compatibility drift.
- Alternatives considered:
  - `abi.encode` variant: rejected because it would alter existing hash semantics.

## Decision 8: Scope boundaries
- Decision: Restrict implementation to web app + script + docs + tests; no contracts/indexer/proposal execution changes.
- Rationale: Matches approved non-goals and reduces delivery risk.
- Alternatives considered:
  - Permission rewiring or protocol changes in same feature: rejected as out-of-scope.
