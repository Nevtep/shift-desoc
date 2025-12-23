# Shift DeSoc - Project Management & Development Hub

Working state: **Testing/Staging on Base Sepolia**; functionality may change. Use the resources below to stay aligned with specs and guardrails.

## Key References
- [copilot-instructions.md](./copilot-instructions.md) — Operating Manual for AI/devs (architecture, invariants, staging caveats, gap handling).
- [project-management/STATUS_REVIEW.md](./project-management/STATUS_REVIEW.md) — Current repo structure, workflows, invariants, and risks.

## Deployment Guides (staging-first)
- [deployment/README.md](./deployment/README.md) — Current deploy flow (Base Sepolia), surgical redeploy scripts, and guardrails.

## What Matters Most
- Timelock-only authority; ParamController as source of truth; no verifier staking/bonding; TreasuryAdapter guardrails (1 spend/week, ≤10% per token, stablecoin allowlist, pause/emergency withdraw); commerce disputes stay separate from work Claims.
- Tooling from repo root: Node 22; Solidity ^0.8.24 + OZ 5.x; Foundry/Hardhat 2.22; Next.js 16/React 19; Ponder 0.7.17. Run format/lint/tests/coverage before changes: `pnpm fmt`, `pnpm lint`, `pnpm forge:test`, `pnpm forge:cov`, `pnpm cov:gate` (≥86%), then sync ABIs via `node scripts/copy-ponder-abis.js` and `node scripts/copy-web-abis.js`.
- Addresses load from `deployments/*.json`; never hardcode; never commit secrets.

## Active Gaps to Track
- apps/marketing has no README; confirm expectations before edits.
- Ensure `scripts/check-coverage.sh` keeps the ≥86% gate intact after test changes.
- Keep `deployments/latest.json` in sync when running custom deploy flows.
