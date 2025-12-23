# Shift DeSoc Status Review (Dec 2025)

> Living document — update after meaningful implementations or deploys; bump the date and note deltas in the changelog.

## Source of truth & spec alignment
- Reference specs: docs under docs/EN (Architecture, Governance-Core, Verification-Layer, Economic-Layer, Commerce specs). AI coding guide: .github/copilot-instructions.md.
- Core expectations: coordination → governance → verification → economic → commerce layers; Timelock-gated authority; verifier power via governance (no staking); TreasuryAdapter guardrails (1 spend/week, 10% per-token cap); addresses loaded from deployments/*.json; Solidity ^0.8.24 + OZ 5.x.

## Monorepo structure (high level)
- Contracts: contracts/core (governor/counting), contracts/modules (coordination, verification, commerce), contracts/tokens; libs in contracts/libs; remappings in remappings.txt.
- Scripts: scripts/ holds deployment/ops utilities (deploy-complete.ts, manage-*, governance helpers, verifier flows, coverage gate, ABI copy scripts, E2E test runners).
- Packages: packages/contracts (shared ABIs/types), packages/shared (utilities), packages/ui (design system/UI kit).
- Apps: apps/web (Next.js App Router dApp), apps/indexer (Ponder indexer → Postgres + GraphQL), apps/marketing (Next.js + Storybook; README absent).

## Tooling & workflows
- Node >=22, pnpm workspaces. Key scripts from package.json: fmt, lint/lint:fix (solhint), quality/sanity (lint+tests+coverage), forge:test, forge:cov, cov:gate (>=86%), forge:build (also copies ABIs), hh:compile/test, deploy:* (hardhat deploy-complete.ts per network), manage/admin/create-community/setup/validate, governance:* (proposal/vote/monitor/execute), verifier:* (register/verify claim), test:e2e + verification/governance E2Es, analyze:* diagnostics, check:* status scripts.
- ABI sync: scripts/copy-ponder-abis.js and scripts/copy-web-abis.js after contract changes.
- Frontend testing: apps/web uses Vitest + Testing Library + MSW (renderWithProviders, mockWagmiHooks) and Playwright scaffold.
- Indexer: Ponder config/schema in apps/indexer.

## Alignment vs spec (spot check)
- Governance/verification/economic layering matches documented architecture; scripts expect deployments/*.json address management.
- Verifier flow remains governance-controlled (no staking found in current instructions/scripts); ensure any future edits preserve Timelock-only mint/burn on VerifierPowerToken1155.
- TreasuryAdapter guardrails emphasized in docs; ensure code changes keep 1/week + 10% caps and Safe module execution path.
- Commerce separation upheld: Marketplace/HousingManager specs show escrow + dispute routing to CommerceDisputes; Claims reserved for ValuableActions.

## Notable gaps/risks to review
- apps/marketing lacks README; confirm setup/testing expectations and Storybook usage before edits.
- Verify coverage gate script (scripts/check-coverage.sh) still enforces ≥86% after any test changes.
- Confirm deployments/latest.json is kept current when running custom deploy flows.

## Pointers for further review
- Detailed contract docs live in docs/EN/* (Architecture, Governance-Core, Verification-Layer, Economic-Layer, Commerce-Modules, module specs for Marketplace/HousingManager/TreasuryAdapter). Follow doc update requirements when modifying behavior.
- For frontend/API integrations, ensure ABI changes propagate to apps/web and apps/indexer via copy scripts; update packages/contracts as needed.
- Security hygiene: never commit secrets; maintain CEI/reentrancy guards; avoid unbounded loops; respect pause/emergency paths (CommunityToken, TreasuryAdapter).

## Contracts architecture (deep dive)
- **Governance core**: [contracts/core/ShiftGovernor.sol](contracts/core/ShiftGovernor.sol) orchestrates proposal lifecycle (binary + multi-choice) and queues to Timelock; multi-choice tallying is separated into [contracts/core/CountingMultiChoice.sol](contracts/core/CountingMultiChoice.sol). Voting power comes from MembershipToken (merit-earned), not capital.
- **Coordination layer**: [contracts/modules/CommunityRegistry.sol](contracts/modules/CommunityRegistry.sol) anchors community IDs, module wiring, and role maps; [contracts/modules/RequestHub.sol](contracts/modules/RequestHub.sol) holds discussions and moderation; [contracts/modules/DraftsManager.sol](contracts/modules/DraftsManager.sol) keeps action bundles and escalates to Governor; [contracts/modules/ParamController.sol](contracts/modules/ParamController.sol) stores governed parameters read by downstream modules (timings, eligibility, economics). Do not bypass ParamController for config.
- **Verification layer (VPS)**: [contracts/modules/ValuableActionRegistry.sol](contracts/modules/ValuableActionRegistry.sol) defines work archetypes; [contracts/modules/Claims.sol](contracts/modules/Claims.sol) runs M-of-N verification windows; [contracts/modules/VerifierPowerToken1155.sol](contracts/modules/VerifierPowerToken1155.sol) is non-transferable power per community; [contracts/modules/VerifierElection.sol](contracts/modules/VerifierElection.sol) manages verifier sets and power (Timelock-only mutability); [contracts/modules/VerifierManager.sol](contracts/modules/VerifierManager.sol) performs juror selection/fraud reporting; [contracts/modules/ValuableActionSBT.sol](contracts/modules/ValuableActionSBT.sol) mints soulbound credentials + WorkerPoints decay. Invariants: no staking/bonding, Timelock controls mint/burn, Claims alone drives approvals, SBT/VPT non-transferable.
- **Economic layer**: [contracts/modules/CommunityToken.sol](contracts/modules/CommunityToken.sol) (backed 1:1 USDC with pause/emergency paths); [contracts/modules/RevenueRouter.sol](contracts/modules/RevenueRouter.sol) enforces governed splits to workers/treasury/investors; [contracts/modules/CohortRegistry.sol](contracts/modules/CohortRegistry.sol) tracks investment cohorts and ROI progress; [contracts/modules/TreasuryAdapter.sol](contracts/modules/TreasuryAdapter.sol) Safe module with guardrails (<=1 spend/week, <=10% per token, stablecoin allowlist, pause + emergencyWithdraw). All economic params must read from ParamController.
- **Commerce modules**: [contracts/modules/Marketplace.sol](contracts/modules/Marketplace.sol) handles offers, escrow, fulfillment, dispute hooks; [contracts/modules/HousingManager.sol](contracts/modules/HousingManager.sol) provides ModuleProduct adapter for reservations and refund math; [contracts/modules/CommerceDisputes.sol](contracts/modules/CommerceDisputes.sol) resolves order disputes (separate from Claims); [contracts/modules/ProjectFactory.sol](contracts/modules/ProjectFactory.sol) seeds project shells; [contracts/modules/RequestHub.sol](contracts/modules/RequestHub.sol) links bounties to ValuableActions; [contracts/modules/RevenueRouter.sol](contracts/modules/RevenueRouter.sol) used on settlement. Keep commerce vs work-verification domains separated.
- **Tokens**: [contracts/tokens/MembershipTokenERC20Votes.sol](contracts/tokens/MembershipTokenERC20Votes.sol) is the merit-governance token (minted via Claims results); [contracts/tokens/CommunityToken.sol](contracts/tokens/CommunityToken.sol) stablecoin wrapper (see economic layer). ValuableActionSBT covers reputation.
- **Shared libs & types**: [contracts/libs/Errors.sol](contracts/libs/Errors.sol) centralizes custom errors; [contracts/libs/Types.sol](contracts/libs/Types.sol) holds shared structs/enums. Use these rather than redefining.
- **Interfaces**: `contracts/core/interfaces` and `contracts/modules/interfaces` expose module APIs—prefer using them in cross-module calls to avoid tight coupling.
- **Cross-cutting invariants**: Timelock is the only authority for privileged mutations (verifier power, ParamController updates, TreasuryAdapter spends); SBT/VPT non-transferable; TreasuryAdapter guardrails must never be bypassed; Marketplace disputes route to CommerceDisputes while Claims exclusively handles ValuableActions; ParamController remains single source for timing/eligibility/economic parameters.

## Indexer (apps/indexer)
- **Stack**: Ponder v0.7, viem, Hono; Postgres DB. Commands: `pnpm --filter @shift/indexer dev|start|build` (dev = ponder dev, build = codegen).
- **Config**: [apps/indexer/ponder.config.ts](apps/indexer/ponder.config.ts) loads `deployments/{PONDER_NETWORK}.json` (default `base_sepolia`) for addresses and optional `startBlock`; envs `PONDER_NETWORK`, `PONDER_START_BLOCK`, `RPC_BASE`, `RPC_BASE_SEPOLIA`, `DATABASE_URL` (defaults to local Postgres). Missing deployment file throws.
- **Tracked contracts**: CommunityRegistry, RequestHub, DraftsManager, ShiftGovernor, CountingMultiChoice, Claims, VerifierManager, ValuableActionRegistry. ABIs are read from `apps/indexer/abis/*.json`; keep `scripts/copy-ponder-abis.js` up to date after contract changes.
- **Schema & generated code**: lives under `apps/indexer/schema/` and `apps/indexer/generated/`; update alongside ABI and config changes. Ensure startBlock is set to avoid reprocessing entire chain when appropriate.

## Web dApp (apps/web)
- **Stack**: Next.js 16 App Router, React 19, Tailwind, TanStack Query, wagmi + viem, zod; markdown pipeline (remark/rehype) and icons via lucide-react. Shared UI and utils from `@shift/ui` and `@shift/shared` (workspace packages).
- **Commands**: `pnpm --filter @shift/web dev|build|start|lint|test:unit|test:e2e`. Tests: Vitest + Testing Library + MSW for unit/integration; Playwright scaffold for e2e.
- **Testing utilities**: `renderWithProviders`, MSW handlers under `tests/unit/mocks`, wallet state helpers `mockWagmiHooks` for connected/disconnected or chain-mismatch scenarios.
- **Project layout**: `app/` routes, `components/`, `hooks/`, `lib/`, `abis/` synced via `scripts/copy-web-abis.js`, and design guidance in `CONTAINER_COMPONENT_PATTERN.md`. Env config via `.env.local` (see Next/ViEM RPCs, API endpoints).
- **Integrations**: Uses GraphQL (graphql-request) against indexer APIs; wagmi/viem for onchain reads/writes. Keep ABIs in sync with contracts and update types when addresses or interfaces change.

## Changelog
- 2025-12-22: Marked as living doc; remove outdated deployment guides; staging-only context.
