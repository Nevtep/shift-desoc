# Gap Report: Wizard Permission Parity

## Summary
This report lists crucial governance flows that remain disabled in guided mode because they are either not timelock-executable by current wiring or not representable as a safe guided template.

## Disabled Crucial Flows

1. coordination.paramController.setGovernanceParams
- Reason: Not timelock-executable by current deploy wiring
- Required selectorRoleAssignments addition:
  - target variable: paramController
  - role: adminRole
  - signature: setGovernanceParams(uint256,uint256,uint256)

2. coordination.paramController.setEligibilityParams
- Reason: Not timelock-executable by current deploy wiring
- Required selectorRoleAssignments addition:
  - target variable: paramController
  - role: adminRole
  - signature: setEligibilityParams(uint256,uint256,uint256)

3. coordination.paramController.setRevenuePolicy
- Reason: Not timelock-executable by current deploy wiring
- Required selectorRoleAssignments addition:
  - target variable: paramController
  - role: adminRole
  - signature: setRevenuePolicy(uint256,uint256,uint256)

4. governance.timelock.executeQueuedProposalAction
- Reason: Not representable as safe guided draft template
- Required selectorRoleAssignments addition: none (already governance-executable through queued proposal lifecycle)
- Release-note rationale: kept disabled intentionally to avoid exposing low-level timelock execution in guided mode.

5. verification.valuableActionRegistry.activateFromGovernance
- Reason: Not representable as safe guided draft template
- Required selectorRoleAssignments addition: none (already allowlisted in expert mode)
- Release-note rationale: action remains expert-only due higher operational risk and payload complexity.

6. commerce_housing.marketplace.setCommerceDisputes
- Reason: Not representable as safe guided draft template
- Required selectorRoleAssignments addition: none (already allowlisted in expert mode)
- Release-note rationale: action remains expert-only because address rewiring has broad commerce impact.

## Expert Surface Notes
- Expert mode now reflects full ADMIN_ROLE timelock surface from generated artifacts.
- Additional targets (engagements, commerceDisputes, housingManager, membershipToken) may appear enabled when module wiring and allowlist signatures are present.
