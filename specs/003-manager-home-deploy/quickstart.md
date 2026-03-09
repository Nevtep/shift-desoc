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

## Execution Notes (2026-03-06)

Automated validation executed:

```bash
cd apps/web
pnpm exec vitest run \
	tests/unit/lib/deploy/wizard-machine.test.ts \
	tests/unit/lib/deploy/preflight.test.ts \
	tests/unit/lib/deploy/verification.test.ts \
	tests/unit/lib/deploy/session-store.test.ts \
	tests/unit/components/deploy-wizard.test.tsx \
	tests/unit/components/deploy-preflight.test.tsx \
	tests/unit/components/deploy-verification-results.test.tsx \
	tests/unit/components/deploy-created-state.test.tsx \
	tests/unit/hooks/use-deploy-resume.test.tsx \
	tests/unit/hooks/use-deploy-resume-multicommunity.test.tsx \
	tests/unit/routes/home-page.test.tsx \
	components/communities/community-list.test.tsx \
	tests/unit/components/community-list-multicommunity.test.tsx
```

Result: PASS (`13 passed`, `27 passed`).

Known unrelated suite issue outside this feature slice:
- `tests/unit/components/draft-create-form.test.tsx` currently fails in full-suite runs due to missing import `../../lib/actions/registry` from `components/drafts/draft-create-form.tsx`.

Compatibility validations:
- Changed-files review confirms this feature slice does not modify `contracts/**`.
- No ABI/event schema changes were introduced; web-side logic consumes existing deployed interfaces.

Manual wallet-connected staging scenarios (`Base Sepolia`) remain pending:
- end-to-end deploy tx flow,
- interruption/reload resume,
- cross-wallet resume rejection on real chain.

## Execution Notes (2026-03-07)

Resume action regression verification executed:

```bash
cd apps/web
pnpm exec vitest run \
	tests/unit/components/deploy-wizard.test.tsx \
	tests/unit/hooks/use-deploy-resume.test.tsx \
	tests/unit/hooks/use-deploy-resume-multicommunity.test.tsx
```

Result: PASS (`3 passed`, `7 passed`).

Scenario outcomes captured from automated checks:
- Layout/action availability: PASS. `DeployWizard` renders `Resume deploy` and keeps it enabled for connected wallets (`keeps resume deploy actionable for connected wallet`).
- Resume authorization rules: PASS. Same-wallet resume allowed and different-wallet resume blocked (`use-deploy-resume.test.tsx`).
- Multi-community resume targeting: PASS. Session-id/community-id target selection behavior validated (`use-deploy-resume-multicommunity.test.tsx`).

Manual wallet-connected staging scenarios on Base Sepolia remain pending and require interactive wallet confirmations:
- End-to-end deploy transaction flow.
- Interruption/reload resume on live chain state.
- Cross-wallet resume rejection on real chain.
