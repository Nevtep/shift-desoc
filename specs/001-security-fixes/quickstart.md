# Quickstart — Implementing & Validating Security Fixes

## Implementation Runbook Index

- Code remediation contract map: `specs/001-security-fixes/contracts/security-fixes-contracts.md`
- Architecture/security posture updates: `docs/EN/Architecture.md`
- User-facing posture updates: `docs/EN/Whitepaper.md`
- D-1 ops runbook: `docs/EN/guides/security-runbook-d1.md`
- D-2 ops runbook: `docs/EN/guides/security-runbook-d2.md`
- Rollout status tracking: `.github/project-management/STATUS_REVIEW.md`

## 1) Prerequisites
- Node 22+
- Foundry (`forge`) installed
- Dependencies installed (`pnpm install`)

## 2) Implement by priority bucket
1. Immediate: `C-1`
2. Before mainnet: `C-2`, `C-3`, `H-1`, `H-2`, `H-3`, `H-5`, `M-3`
3. Pre-production hardening: `H-4`, `M-1`, `M-2`, `M-4`, `M-5`
4. Operational controls: `D-1`, `D-2`, docs sync

## 3) Fast validation loop (targeted)
Run impacted tests after each item (examples):

```bash
pnpm forge:test --match-path test/RevenueRouterCohort.t.sol
pnpm forge:test --match-path test/CommunityToken.t.sol
pnpm forge:test --match-path test/RequestHub.t.sol
pnpm forge:test --match-path test/Engagements.t.sol
pnpm forge:test --match-path test/ValuableActionRegistry.t.sol
pnpm forge:test --match-path test/MarketplaceRevenueRouter.t.sol
pnpm forge:test --match-path test/VerifierManager.t.sol
pnpm forge:test --match-path test/MarketplaceHousing.t.sol
```

## 4) Full verification
```bash
pnpm forge:test
pnpm forge:cov
pnpm cov:gate
```

## 5) ABI sync (if signatures/events change)
```bash
node scripts/copy-ponder-abis.js
node scripts/copy-web-abis.js
```

### ABI sync validation steps

1. Run both copy scripts and verify no errors.
2. Confirm updated ABI artifacts exist under `apps/indexer/abis/` and `apps/web/abis/`.
3. If interfaces/events changed, run indexer build and web typecheck/test flows.
4. Commit ABI updates together with contract changes (never separately).
5. Re-run at least one integration scenario that depends on changed events/functions.

## 6) Governance/migration dry run (staging)
- Execute timelock-governed actions in severity order from `plan.md`
- Verify module wiring and role boundaries
- Replay critical financial flows:
  - revenue routing with active cohorts
  - emergency withdrawal invariant checks
  - requesthub completion with payout
  - marketplace settlement with unsupported routing token

### Staging replay validation checklist

- [ ] Deploy patch set to staging with addresses written to `deployments/latest.json`.
- [ ] Replay US1 fund-flow scenarios (router/cohorts, emergency withdrawal floor, atomic bounty payout).
- [ ] Replay US2 lifecycle scenarios (submit -> vote -> expire -> resolve).
- [ ] Replay US3 authorization boundaries (moderator blocked, governance path allowed).
- [ ] Replay US4 hardening checks (housing reentrancy blocked, max stay enforced, entropy behavior).
- [ ] Confirm no regressions in full suite and coverage gate.
- [ ] Update `.github/project-management/STATUS_REVIEW.md` with date + deltas.

## 7) Documentation completion checklist
- Update `contracts/FEATURES.md` to remove stale behavior claims
- Update `docs/EN/Architecture.md` and security sections for new invariants
- Add/refresh runbooks and monitoring rules for D-1 and D-2
