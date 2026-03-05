# Security Runbook D-2: Position-Claim / Engagement Anomaly Response

## Objective
Detect and respond to verification/claim anomalies that can indicate liveness failures, manipulation attempts, or process drift in engagement processing.

## Scope
- Contracts: `Engagements`, `ValuableActionRegistry`, `VerifierManager`
- Signal class: stalled pending engagements, abnormal approval/rejection ratios, and verification latency spikes.

## Owners
- Primary: Verification Operations
- Backup: Security Lead
- Approval Authority (for privileged mitigations): Timelock-governed community governance

## Monitoring Signals
- Pending age threshold: engagement pending longer than configured verify window + grace buffer
- Latency anomaly: median approval time spikes > 2x 7-day baseline
- Outcome anomaly: rejection or approval rate outside expected band for a given action type

## Required Tooling
- Script: `scripts/check-claim-status.ts`
- Deployment registry: `deployments/latest.json` or `deployments/<network>.json`

## Procedure

### 1) Daily Monitoring
1. Run:
   - `npx hardhat run scripts/check-claim-status.ts --network <network>`
2. Review outputs for:
   - stale pending engagements
   - unusual pending concentration by action type
   - sudden changes in outcomes

### 2) Triage
1. Validate if anomaly aligns with legitimate traffic spikes or verifier unavailability.
2. Check for correlated governance/config changes in `ParamController` or verifier set updates.
3. Identify impacted community/action IDs.

### 3) Mitigation
1. If verifier liveness is degraded, escalate verifier roster/power adjustments through governance.
2. If thresholds/config appear mis-tuned, propose timelocked parameter adjustment.
3. If manipulation is suspected, capture evidence and trigger fraud-report path for governance review.

## Incident Response

### Trigger Conditions
- High stale-pending count above operational threshold
- Repeated selection/verification failures for specific action/community
- Abrupt unexplained outcome skew over consecutive monitoring windows

### Immediate Actions
1. Increase monitoring frequency to every 15 minutes.
2. Notify verification and governance responders.
3. Queue governance action if emergency parameter/roster correction is required.
4. Document affected engagements and timeline for later audit.

### Escalation
- Escalate to Security Lead for anomalies persisting over 24 hours.
- Publish post-incident summary including root cause and corrective policy updates.

## Verification Drill (Monthly)
1. Replay a staging scenario with intentionally delayed juror responses.
2. Confirm script flags stale pending engagements.
3. Validate responder notification and triage steps.
4. Keep this runbook aligned with evolving Engagements/Verifier interfaces.
