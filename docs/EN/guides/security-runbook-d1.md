# Security Runbook D-1: Mint + Deposit Atomic Governance Operation

## Objective
Prevent temporary under-collateralization windows by ensuring governance-triggered mint and reserve-deposit operations are executed atomically (or in a strictly controlled sequence with explicit pre/post checks).

## Scope
- Contracts: `CommunityToken`, `TreasuryAdapter`, `RevenueRouter` (read-only cross-checks)
- Applies to staging and production governance operations involving supply increases.

## Owners
- Primary: Protocol Operations
- Backup: Security Lead
- Approval Authority: Timelock-governed community governance

## Monitoring Signal
- **Backing Ratio** = `USDC reserves in CommunityToken / CommunityToken totalSupply`
- Healthy baseline: `>= 1.00`
- Warning threshold: `< 1.00`
- Critical threshold: `< 0.995` or persistent `< 1.00` for > 15 minutes

## Required Tooling
- Script: `scripts/check-balance.ts`
- Network deployment registry: `deployments/latest.json` or `deployments/<network>.json`

## Procedure

### 1) Pre-Execution Checks
1. Confirm intended governance action bundle includes reserve deposit before/with mint impact.
2. Verify target contract addresses from deployments JSON.
3. Run:
   - `npx hardhat run scripts/check-balance.ts --network <network>`
4. Record baseline:
   - `totalSupply`
   - `usdcReserves`
   - backing ratio

### 2) Governance Execution Window
1. Queue and execute through `ShiftGovernor -> TimelockController`.
2. Ensure no manual/operator direct mutation is used.
3. Immediately re-run backing check script.

### 3) Post-Execution Verification
1. Confirm backing ratio remains `>= 1.00`.
2. Confirm no unexpected reserve drift vs expected operation delta.
3. Log operation details and ratio snapshots in ops channel/change ticket.

## Incident Response

### Trigger Conditions
- Backing ratio `< 1.00`
- Sudden reserve drop not explained by approved redemption/withdrawal flow

### Immediate Actions
1. Pause affected mint-like operation paths via governance-authorized emergency controls when available.
2. Freeze new discretionary treasury outflows until ratio restored.
3. Execute reserve top-up through approved governance path.
4. Re-run `check-balance` every 5 minutes until stable for 3 consecutive checks.

### Escalation
- Escalate to Security Lead if ratio remains `< 1.00` for > 15 minutes.
- Prepare post-incident report with timeline, root cause, and compensating controls.

## Verification Drill (Monthly)
1. Simulate governance operation in staging.
2. Capture pre/post ratio values.
3. Verify alerting and owner acknowledgement within SLA.
4. Update this runbook if contract interfaces or thresholds change.
