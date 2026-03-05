# Legacy Scripts

This folder contains historical scripts that are **not** part of the canonical current flow.

Archived here are scripts that match one or more of these conditions:
- Depend on deprecated contracts/flows (`Claims`, `VerifierPool`, `WorkerSBT`, old governance helpers)
- Depend on hardcoded one-off addresses from past staging runs
- Contain placeholders (`0x...`) or broken/outdated execution paths
- Are superseded by the canonical 4-step deploy/wiring/verify pipeline

## Canonical deployment flow (use this)

1. `npx hardhat run scripts/hardhat/deploy-shared-infra.ts --network <network>`
2. `npx hardhat run scripts/hardhat/deploy-community-stack.ts --network <network>`
3. `npx hardhat run scripts/hardhat/post-deploy-role-wiring.ts --network <network>`
4. `npx hardhat run scripts/hardhat/verify-community-deployment.ts --network <network>`

## Notes

Legacy scripts are kept for reference/backward investigation and are not exposed in `package.json` commands.
Use active scripts documented in `scripts/README.md` for all current deployments and ops.
