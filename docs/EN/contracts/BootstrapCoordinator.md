# BootstrapCoordinator Contract

## Purpose & Role

`BootstrapCoordinator` is shared infrastructure that batches AccessManager selector-role wiring and role grants into a single transaction.

It is intended for bootstrap/setup workflows where many `setTargetFunctionRole` and `grantRole` calls would otherwise require multiple wallet confirmations.

## Core Model

`BootstrapCoordinator` is intentionally minimal and state-light:

- No mutable storage for role policies.
- Caller-provided batch payloads.
- Runtime authorization checks against the target AccessManager.

### Data Structures

```solidity
struct TargetRoleConfig {
    address target;
    bytes4[] selectors;
    uint64 role;
}

struct RoleGrant {
    uint64 role;
    address account;
    uint32 executionDelay;
}
```

## API

### `configureAccessManager(address accessManager, TargetRoleConfig[] selectorConfigs, RoleGrant[] roleGrants)`

Applies selector-role assignments and role grants in one call.

Flow:

1. Validates non-zero AccessManager.
2. Reads `ADMIN_ROLE` from the target AccessManager.
3. Verifies caller currently has `ADMIN_ROLE`.
4. Verifies coordinator contract currently has `ADMIN_ROLE`.
5. Applies all selector mappings via `setTargetFunctionRole`.
6. Applies grants only when `hasRole` returns false.

## Security Notes

- The contract does not introduce a new authority domain: it only executes when the caller is already AccessManager admin.
- The coordinator must also hold AccessManager admin to execute writes; this is an explicit deployment/wiring decision.
- If coordinator admin membership is revoked, batching is naturally disabled.
- Input validation rejects zero addresses and empty selector lists.

## Integration Points

- Intended consumer: deploy wizard `CONFIGURE_ACCESS_PERMISSIONS` step.
- Wizard should prefer coordinator batch call when:
  - Coordinator address exists,
  - Coordinator has bytecode,
  - Coordinator holds AccessManager admin.
- Wizard should fallback to direct per-call writes for backward compatibility.

## Operational Guidance

- Grant coordinator admin only in environments where batched bootstrap is required.
- Keep timelock handoff semantics unchanged: timelock remains the durable governance admin after bootstrap.
- Do not use this contract to bypass timelock-controlled post-bootstrap governance flows.
