# Deployment (Staging-First)

Current phase: testing/staging on Base Sepolia. Treat Base/mainnet steps as future-only. Run everything from repo root with Node 22, Hardhat 2.22, Solidity ^0.8.24, OZ 5.x.

## Primary flow
- Full stack deploy (staging): `pnpm deploy:base-sepolia` → runs the canonical 4-step staged pipeline (`deploy-shared-infra`, `deploy-community-stack`, `post-deploy-role-wiring`, `verify-community-deployment`) and updates deployments JSON.
- Build/lint/test before deploy: `pnpm fmt && pnpm lint && pnpm forge:test && pnpm forge:cov && pnpm cov:gate`; then `pnpm forge:build && pnpm hh:compile` (copies ABIs to web/indexer).
- Addresses: always load from deployments/*.json; never hardcode.

## Production-grade community flow (current canonical)
Use the staged flow below for new communities with explicit role wiring and verification.

Legacy setup/deploy scripts were moved to `scripts/legacy/hardhat/` and are not part of the canonical flow.

1) Deploy shared infrastructure if not present:
- `npx hardhat run scripts/hardhat/deploy-shared-infra.ts --network <network>`
- `pnpm deploy:shared-infra --network <network>`

2) Deploy one community stack and register module addresses:
- `npx hardhat run scripts/hardhat/deploy-community-stack.ts --network <network>`
- `pnpm deploy:community-stack --network <network>`

3) Apply post-deploy role wiring (least-privilege):
- `npx hardhat run scripts/hardhat/post-deploy-role-wiring.ts --network <network>`
- `pnpm deploy:wire-community --network <network>`

4) Verify deployment invariants:
- `npx hardhat run scripts/hardhat/verify-community-deployment.ts --network <network>`
- `pnpm deploy:verify-community --network <network>`

This flow guarantees:
- AccessManager is authority for AccessManaged contracts
- Selector-level role wiring for cross-contract restricted calls
- Minimal role grants to caller contracts
- VerifierPowerToken community initialization before verifier power operations
- RevenueRouter + CommerceDisputes + HousingManager caller role setup for Marketplace
- ValuableActionSBT manager role setup for authorized modules
- ValuableActionRegistry issuer role setup for authorized modules
- CommunityRegistry module address registration per community

## Surgical redeploys (updated contracts)
- ValuableActionRegistry + Engagements refresh: `npx hardhat run scripts/redeploy-valuable-actions.ts --network base_sepolia` (updates CommunityRegistry modules and deployments/latest.json).
- RequestHub-only refresh: `npx hardhat run scripts/hardhat/deploy-requesthub-only.ts --network base_sepolia` (updates deployments JSON and startBlock if missing).
- These targeted scripts are expected since VARegistry/RequestHub changed; keep deployments/latest.json consistent after use.

## Other helpers
- Legacy scripts stay in `scripts/legacy/hardhat/` for reference only (not exposed as package commands).
- Status/checks: `pnpm verify:base-sepolia`, `pnpm check:balance --network <network>`, `pnpm check:engagements --network <network>`.
- Admin/ops scripts live under `scripts/` and are documented in `scripts/README.md`.

## Guardrails to respect
- Timelock-only authority; ParamController is source of truth; no verifier staking/bonding; TreasuryAdapter limits (≤1 spend/week, ≤10% per token, stablecoin allowlist, pause/emergency withdraw); commerce disputes stay separate from work Engagements.
- After any contract change: rerun tests + coverage gate, sync ABIs via `node scripts/copy-ponder-abis.js` and `node scripts/copy-web-abis.js`, update indexer/web if interfaces/events change.
- Never commit secrets or private keys.
