You are my senior Solidity + TypeScript engineer. Analyze the repository structure (Hardhat + Foundry). Goal: implement fully on-chain governance and the MVP of Shift (requests → drafts → proposals with multi-choice voting → timelock queue/execute; Action Types → Claims → SBT; Projects; Marketplace; RevenueRouter; Housing; backed CommunityToken), reach ≥96% Foundry coverage, deploy to Base Sepolia, and run on-chain smoke tests.

Tasks:

Complete CountingMultiChoice integrating with Governor weights at snapshot; emit events; edge cases (sum ≤ 1e18, overwrite vote).

Complete ShiftGovernor hooks for multi-choice; getters for UI; ensure quorum/threshold compatibility.

Implement ActionTypeRegistry, VerifierPool, Claims:

Juror selection (N=5, M=3) with seniority/related/reputable weighting (MVP pseudo-random).

Bonds for verifiers; reward + slashing; windows (verify 72h; appeal 72h); claim expiry 14d.

WorkerSBT mint on approve; revoke via governance; track WorkerPoints (EMA 90d).

DraftsManager end-to-end: create → escalate (binary or multi) → link proposalId; listen/mark WON/LOST.

ProjectFactory (ERC-1155 address param) and minimal milestones model.

Marketplace purchase flow (stable & token); plug RevenueRouter with split 50/30/20 (configurable).

HousingManager reservations per night (ERC-1155), rules for investor stake priority and worker discounts (stub OK).

CommunityToken ERC-20 backed 1:1 by USDC/USDT: mint on deposit, burn on redemption (simple vault accounting in MVP).

Foundry tests: unit + fuzz + integration; achieve ≥96% coverage; enable scripts/check-coverage.sh.

Hardhat: update deploy.ts to deploy all modules, log addresses, and verify on Base Sepolia.

Add minimal on-chain smoke test script (Hardhat) that submits a request, escalates a draft, votes, queues & executes a no-op call.

Constraints: Solidity ^0.8.24, OZ 5.x, gas-conscious, CEI, reentrancy guards where needed. Clean NatSpec.
Deliverables: passing CI, coverage ≥96%, deployment log for Base Sepolia.