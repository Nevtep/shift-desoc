# Quickstart: Single-Community Architecture Refactor

## Goal
Deliver single-community internals across deploy stack contracts with per-community authority bootstrap and mandatory admin handoff to timelock.

## Prerequisites
- Branch: `004-single-community-architecture`
- Install deps: `pnpm install`
- Tooling available: Foundry + Hardhat

## Execution Order
1. Contracts refactor (primary objective)
2. Deploy scripts bootstrap/handoff update
3. Manager Wizard state flow update
4. Tests (contracts + integration + web)
5. Indexer ABI/event sync
6. Docs/status synchronization

## Key Runtime Model
1. Deploy per-community stack including `AccessManager`, `ParamController`, `ShiftGovernor`, `TimelockController`
2. Configure selector permissions in local `AccessManager` during bootstrap
3. Transfer AccessManager admin to local timelock
4. Verify post-handoff restricted writes fail for deployer/manager wallets

## Validation Commands
- Contract tests: `pnpm forge:test`
- Coverage: `pnpm forge:cov && pnpm cov:gate`
- Hardhat compile: `pnpm hh:compile`
- ABI sync: `node scripts/copy-ponder-abis.js && node scripts/copy-web-abis.js`

## Done Criteria
- All contracts in refactor matrix converted and tested
- Deploy flow enforces bootstrap + handoff before completion
- Wizard states match required sequence
- No migration/backfill required for Base Sepolia staging
- Docs/status files updated consistently
