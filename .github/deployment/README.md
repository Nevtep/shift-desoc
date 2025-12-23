# Deployment (Staging-First)

Current phase: testing/staging on Base Sepolia. Treat Base/mainnet steps as future-only. Run everything from repo root with Node 22, Hardhat 2.22, Solidity ^0.8.24, OZ 5.x.

## Primary flow
- Full stack deploy (staging): `pnpm deploy:base-sepolia` → runs `scripts/deploy-complete.ts` (writes deployments/base_sepolia.json and deployments/latest.json).
- Build/lint/test before deploy: `pnpm fmt && pnpm lint && pnpm forge:test && pnpm forge:cov && pnpm cov:gate`; then `pnpm forge:build && pnpm hh:compile` (copies ABIs to web/indexer).
- Addresses: always load from deployments/*.json; never hardcode.

## Surgical redeploys (updated contracts)
- ValuableActionRegistry + Claims refresh: `npx hardhat run scripts/redeploy-valuable-actions.ts --network base_sepolia` (updates CommunityRegistry modules and deployments/latest.json).
- RequestHub-only refresh: `npx hardhat run scripts/hardhat/deploy-requesthub-only.ts --network base_sepolia` (updates deployments JSON and startBlock if missing).
- These targeted scripts are expected since VARegistry/RequestHub changed; keep deployments/latest.json consistent after use.

## Other helpers
- Hardhat entry wrapper: `npx hardhat run scripts/hardhat/deploy.ts --network base_sepolia` (delegates to deploy-complete).
- Status/checks: `pnpm verify:addresses`, `pnpm status`, `pnpm check:balance`, `pnpm check:permissions`.
- Governance/ops scripts live under scripts/ (proposal, vote, execute, verifier flows) and scripts/hardhat/ (community setup/validation).

## Guardrails to respect
- Timelock-only authority; ParamController is source of truth; no verifier staking/bonding; TreasuryAdapter limits (≤1 spend/week, ≤10% per token, stablecoin allowlist, pause/emergency withdraw); commerce disputes stay separate from work Claims.
- After any contract change: rerun tests + coverage gate, sync ABIs via `node scripts/copy-ponder-abis.js` and `node scripts/copy-web-abis.js`, update indexer/web if interfaces/events change.
- Never commit secrets or private keys.
