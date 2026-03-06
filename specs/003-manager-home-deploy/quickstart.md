# Quickstart: Manager Home Deploy Wizard + Communities Index

## Goal

Validate the Manager home wizard and communities index against the spec on Base Sepolia with deterministic tests and a manual smoke flow.

## Prerequisites

1. Install dependencies:
```bash
pnpm install
```
2. Ensure web app env is configured (RPC + wallet settings for Base Sepolia).
3. Ensure shared infra exists on target network (`accessManager`, `paramController`, `communityRegistry`).

## Local Dev Run

1. Start web app:
```bash
pnpm --filter @shift/web dev
```
2. Open home route (`/`).
3. Connect wallet and confirm supported network.

## Manual Validation Flow

1. Verify layout and list placement
- Wizard section is above communities index.
- Communities list still renders loading/empty/error/populated states.

2. Verify preflight blocking behavior
- Disconnect wallet -> start is disabled with clear guidance.
- Switch to unsupported network -> start blocked with network guidance.
- Simulate missing shared infra -> start blocked with remediation.
- Simulate insufficient funds -> required vs balance + buffer guidance shown.

3. Verify happy-path execution
- Start deploy wizard with sufficient funds and valid preflight.
- Confirm per-step purpose and tx progress are visible.
- Complete flow and verify check-by-check success output.

4. Verify interruption/resume
- Interrupt after partial completion.
- Reload page and resume with same wallet.
- Confirm resume starts from first incomplete step.

5. Verify resume authorization
- Attempt resume from a different wallet.
- Confirm flow is blocked by deployer mismatch.

6. Verify completed-resume behavior
- After full completion, invoke resume.
- Confirm no new tx execution and completion summary display.

## Test Commands

Run targeted unit/integration tests:
```bash
pnpm --filter @shift/web test:unit -- deploy-wizard
pnpm --filter @shift/web test:unit -- preflight
pnpm --filter @shift/web test:unit -- verification
pnpm --filter @shift/web test:unit -- community-list
```

Run full web unit suite (known unrelated failures may exist):
```bash
pnpm --filter @shift/web test:unit
```

## Done Checklist

- [ ] FR-001 to FR-023 behaviors covered by tests.
- [ ] Resume logic uses on-chain truth after registration.
- [ ] Verification checks match script parity.
- [ ] No contract changes introduced.
- [ ] Docs and project-management status files updated in lockstep.
