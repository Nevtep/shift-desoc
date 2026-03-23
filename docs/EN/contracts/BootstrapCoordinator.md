# BootstrapCoordinator Contract

## Purpose & Role

`BootstrapCoordinator` is shared infrastructure that batches AccessManager selector-role wiring and role grants into a single transaction.

It is intended for bootstrap/setup workflows where many `setTargetFunctionRole` and `grantRole` calls would otherwise require multiple wallet confirmations.
It also provides an end-to-end runtime bootstrap path so fresh community deploys do not require post-deploy reconciliation writes.

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

struct RuntimeBootstrapConfig {
  uint256 communityId;
  address valuableActionRegistry;
  address verifierPowerToken;
  address requestHub;
  address founder;
  address valuableActionSBT;
  address revenueRouter;
  address treasuryAdapter;
  address marketplace;
  address communityToken;
  address treasuryVault;
  address[] supportedTokens;
  uint16 tokenCapBps;
  string verifierMetadataURI;
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

### `bootstrapAccessAndRuntime(address accessManager, TargetRoleConfig[] selectorConfigs, RoleGrant[] roleGrants, RuntimeBootstrapConfig runtimeConfig)`

Performs a full bootstrap in one coordinator call:

1. Applies all access selector-role assignments and role grants.
2. Initializes verifier power token community metadata (if not initialized).
3. Links ValuableActionRegistry runtime references (`valuableActionSBT`, issuance module, founder allowlist).
4. Sets RevenueRouter treasury and supported tokens.
5. Sets TreasuryAdapter token allowlist, cap bps, and requestHub destination.
6. Activates marketplace community and links community token.

All runtime writes are idempotent: existing correct state is preserved without duplicate writes.

## Security Notes

- The contract does not introduce a new authority domain: it only executes when the caller is already AccessManager admin.
- The coordinator must also hold AccessManager admin to execute writes; this is an explicit deployment/wiring decision.
- If coordinator admin membership is revoked, batching is naturally disabled.
- Input validation rejects zero addresses and empty selector lists.

## Integration Points

- Intended consumer: deploy wizard `CONFIGURE_ACCESS_PERMISSIONS` step.
- Wizard uses strict coordinator mode:
  - Coordinator address must exist,
  - Coordinator must have bytecode,
  - Coordinator must hold AccessManager admin.
- If those conditions fail, deployment should stop with explicit errors (no direct role-by-role fallback).

## Operational Guidance

- Grant coordinator admin only in environments where batched bootstrap is required.
- Keep timelock handoff semantics unchanged: timelock remains the durable governance admin after bootstrap.
- Do not use this contract to bypass timelock-controlled post-bootstrap governance flows.
