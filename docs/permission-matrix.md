# Permission Matrix Report

## Scope
- Feature: 010-wizard-permission-parity
- Canonical source: apps/web/lib/deploy/factory-step-executor.ts selectorRoleAssignments
- Validation baseline: apps/web/abis/*.json

## Artifact Outputs
- specs/010-wizard-permission-parity/contracts/permission-matrix.json
- specs/010-wizard-permission-parity/contracts/timelock-surface.json
- specs/010-wizard-permission-parity/contracts/signature-not-found.json
- apps/web/lib/actions/allowlists/base-sepolia-v1.json
- apps/web/lib/actions/allowlists/base-sepolia-v1.meta.json

## Current Results
- Permission matrix entries: 78
- Timelock surface targets: 13
- Timelock surface signatures: 47
- Signature failures: 0 (fail-closed artifact emitted with empty list)
- Handoff verification: true (static anchor checks passed)

## Authority Mapping
- Only ADMIN_ROLE rows are promoted to timelock-surface.
- Non-admin role mappings are kept in permission-matrix for traceability, but excluded from allowlist generation.
- Allowlist profile is generated strictly from timelock-surface contracts/signatures.

## Handoff Conclusion
Static handoff evidence confirms the required sequence in executeHandoffAdminToTimelock:
1. grantRole(adminRole, timelock, 0)
2. revokeRole(adminRole, bootstrapCoordinator) when present
3. revokeRole(adminRole, handoffFrom)
4. post-condition checks enforce timelock admin true and deployer admin false

## Notes
- ABI mismatch behavior is fail-closed: generator writes signature-not-found.json and exits non-zero.
- Unknown target variables in wiring are tracked as skippedTargets in allowlist metadata.
