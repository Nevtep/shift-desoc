# Scripts Guide

This folder contains **active operational scripts** for Shift DeSoc.
Deprecated, one-off, and broken/historical scripts are archived under `scripts/legacy/`.

## Canonical Deployment (current)

Use these 4 commands for new community deployment/wiring:

1. `pnpm deploy:shared-infra --network <network>`
2. `pnpm deploy:community-stack --network <network>`
3. `pnpm deploy:wire-community --network <network>`
4. `pnpm deploy:verify-community --network <network>`

Hardhat implementations:
- `scripts/hardhat/deploy-shared-infra.ts`
- `scripts/hardhat/deploy-community-stack.ts`
- `scripts/hardhat/post-deploy-role-wiring.ts`
- `scripts/hardhat/verify-community-deployment.ts`

## Active Script Tools

### Deployment
- `scripts/hardhat/deploy-requesthub-only.ts` — surgical RequestHub redeploy/update.
- `scripts/hardhat/community-deploy-lib.ts` — shared deploy/wiring/verification library.

### Admin & Operations
- `scripts/manage-communities.ts` — community admin CLI (roles, params, timelock roles, module wiring).
- `scripts/manage-cohorts.ts` — cohort lifecycle and cohort/revenue operations.

### Monitoring / Health
- `scripts/check-balance.ts` — D-1 backing ratio monitor.
- `scripts/check-claim-status.ts` — D-2 engagement anomaly monitor.
- `scripts/verify-base-sepolia.ts` — quick contract/module integration verification for Base Sepolia.

### Build & Tooling
- `scripts/check-coverage.sh` — coverage gate check.
- `scripts/copy-ponder-abis.js` — sync ABIs to indexer.
- `scripts/copy-web-abis.js` — sync ABIs to web app.
- `scripts/generate-wallets.sh` — local wallet generation helper.

## Archived Scripts

- `scripts/legacy/` contains historical scripts that are not maintained for current architecture.
- `scripts/legacy/hardhat/` contains old hardhat flows and scenario scripts.
- Deprecated one-shot deployment scripts were archived: `scripts/legacy/deploy-complete.ts`, `scripts/legacy/hardhat/deploy.ts`.
- Treat archived scripts as reference only.
