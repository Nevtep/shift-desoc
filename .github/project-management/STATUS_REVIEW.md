# Shift DeSoc Status Review (Mar 05, 2026)

> Living document — update after meaningful implementations or deploys; bump the date and note deltas in the changelog.

## Source of truth & spec alignment
- Reference specs: docs/EN/Architecture.md, Layers.md, Flows.md, Tokenomics.md, Whitepaper.md, plus per-contract specs under docs/EN/contracts/*. AI coding guide: .github/copilot-instructions.md.
- Core expectations: coordination → governance → verification → economic → commerce layers; Timelock-gated authority; verifier power via governance (no staking); TreasuryAdapter guardrails (1 spend/week, 10% per-token cap); addresses loaded from deployments/*.json; Solidity ^0.8.24 + OZ 5.x.

## Documentation coordination contract
- `STATUS_REVIEW.md` purpose: strategic baseline for architecture, invariants, tooling, and chronological changelog of meaningful deltas.
- `IMPLEMENTATION_STATUS.md` purpose: tactical per-feature implementation matrix across contracts/indexer/manager, plus drift risks and prioritized backlog.
- Update handshake:
	- Any change to feature statuses, drift risks, or backlog priorities in `IMPLEMENTATION_STATUS.md` MUST be reflected here in `## Changelog` with date and summary.
	- Any architecture/process expectation change here MUST trigger matrix re-validation in `.github/project-management/IMPLEMENTATION_STATUS.md` in the same PR.
	- Both files SHOULD be reviewed together during release-readiness checks.

## Monorepo structure (high level)
- Contracts: contracts/core (governor/counting), contracts/modules (coordination, verification, commerce), contracts/tokens; libs in contracts/libs; remappings in remappings.txt.
- Scripts: scripts/ holds deployment/ops utilities (canonical staged deploy scripts under scripts/hardhat, manage-*, governance helpers, verifier flows, coverage gate, ABI copy scripts, E2E test runners). Deprecated one-shot deploy scripts are archived under scripts/legacy/.
- Packages: packages/contracts (shared ABIs/types), packages/shared (utilities), packages/ui (design system/UI kit).
- Apps: apps/web (Next.js App Router dApp), apps/indexer (Ponder indexer → Postgres + GraphQL), apps/marketing (Next.js + Storybook; README absent).

## Tooling & workflows
- Node >=22, pnpm workspaces. Key scripts are defined in the root package.json (formatting, linting, tests, coverage gate, contract build/compile, deploy/manage helpers, governance/verifier flows, E2E suites, diagnostics, and status checks); keep this file in sync with any future script changes by updating this note only if categories meaningfully change.
- ABI sync: scripts/copy-ponder-abis.js and scripts/copy-web-abis.js after contract changes.
- Frontend testing: apps/web uses Vitest + Testing Library + MSW (renderWithProviders, mockWagmiHooks) and Playwright scaffold.
- Indexer: Ponder config/schema in apps/indexer.

## Alignment vs spec (spot check)
- Governance/verification/economic layering matches documented architecture; scripts expect deployments/*.json address management.
- Verifier flow remains governance-controlled (no staking found in current instructions/scripts); ensure any future edits preserve Timelock-only mint/burn on VerifierPowerToken1155.
- TreasuryAdapter guardrails emphasized in docs; ensure code changes keep 1/week + 10% caps and Safe module execution path.
- Commerce separation upheld: Marketplace/HousingManager specs show escrow + dispute routing to CommerceDisputes; Engagements handle ValuableActions ("Claims" term reserved for revenue claiming only).

## Notable gaps/risks to review
- apps/marketing lacks README; confirm setup/testing expectations and Storybook usage before edits.
- Verify coverage gate script (scripts/check-coverage.sh) still enforces ≥86% after any test changes.
- Confirm deployments/latest.json is kept current when running custom deploy flows.

## Pointers for further review
- Detailed docs: top-level specs in docs/EN (Architecture.md, Layers.md, Flows.md, Tokenomics.md, Whitepaper.md); contract/module specs in docs/EN/contracts/*. Follow doc update requirements when modifying behavior.
- For frontend/API integrations, ensure ABI changes propagate to apps/web and apps/indexer via copy scripts; update packages/contracts as needed.
- Security hygiene: never commit secrets; maintain CEI/reentrancy guards; avoid unbounded loops; respect pause/emergency paths (CommunityToken, TreasuryAdapter).

## Contracts architecture (deep dive)
- **Governance core**: [contracts/core/ShiftGovernor.sol](contracts/core/ShiftGovernor.sol) orchestrates proposal lifecycle (binary + multi-choice) and queues to Timelock; multi-choice tallying is separated into [contracts/core/CountingMultiChoice.sol](contracts/core/CountingMultiChoice.sol). Voting power comes from MembershipToken (merit-earned), not capital.
- **Coordination layer**: [contracts/modules/CommunityRegistry.sol](contracts/modules/CommunityRegistry.sol) anchors community IDs, module wiring, and role maps; [contracts/modules/RequestHub.sol](contracts/modules/RequestHub.sol) holds discussions and moderation; [contracts/modules/DraftsManager.sol](contracts/modules/DraftsManager.sol) keeps action bundles and escalates to Governor; [contracts/modules/ParamController.sol](contracts/modules/ParamController.sol) stores governed parameters read by downstream modules (timings, eligibility, economics). Do not bypass ParamController for config.
- **Verification layer (VPS)**: [contracts/modules/ValuableActionRegistry.sol](contracts/modules/ValuableActionRegistry.sol) defines work archetypes; [contracts/modules/Engagements.sol](contracts/modules/Engagements.sol) runs M-of-N verification windows; [contracts/tokens/VerifierPowerToken1155.sol](contracts/tokens/VerifierPowerToken1155.sol) is non-transferable power per community; [contracts/modules/VerifierElection.sol](contracts/modules/VerifierElection.sol) manages verifier sets and power (Timelock-only mutability); [contracts/modules/VerifierManager.sol](contracts/modules/VerifierManager.sol) performs juror selection/fraud reporting; [contracts/modules/ValuableActionSBT.sol](contracts/modules/ValuableActionSBT.sol) mints soulbound credentials + WorkerPoints decay. Invariants: no staking/bonding, Timelock controls mint/burn, Engagements alone drive approvals, SBT/VPT non-transferable.
- **Roles/Credentials**: [contracts/modules/PositionManager.sol](contracts/modules/PositionManager.sol) defines role templates and assignments; [contracts/modules/CredentialManager.sol](contracts/modules/CredentialManager.sol) issues course/skill credentials with designated verifiers.
- **Economic layer**: [contracts/modules/CommunityToken.sol](contracts/modules/CommunityToken.sol) (backed 1:1 USDC with pause/emergency paths); [contracts/modules/RevenueRouter.sol](contracts/modules/RevenueRouter.sol) enforces governed splits to workers/treasury/investors; [contracts/modules/CohortRegistry.sol](contracts/modules/CohortRegistry.sol) tracks investment cohorts and ROI progress; [contracts/modules/InvestmentCohortManager.sol](contracts/modules/InvestmentCohortManager.sol) coordinates deposits and cohort issuance; [contracts/modules/TreasuryAdapter.sol](contracts/modules/TreasuryAdapter.sol) Safe module with guardrails (<=1 spend/week, <=10% per token, stablecoin allowlist, pause + emergencyWithdraw). All economic params must read from ParamController.
- **Commerce modules**: [contracts/modules/Marketplace.sol](contracts/modules/Marketplace.sol) handles offers, escrow, fulfillment, dispute hooks; [contracts/modules/HousingManager.sol](contracts/modules/HousingManager.sol) provides ModuleProduct adapter for reservations and refund math; [contracts/modules/CommerceDisputes.sol](contracts/modules/CommerceDisputes.sol) resolves order disputes (separate from Engagements/work verification); [contracts/modules/ProjectFactory.sol](contracts/modules/ProjectFactory.sol) seeds project shells; [contracts/modules/RequestHub.sol](contracts/modules/RequestHub.sol) links bounties to ValuableActions; [contracts/modules/RevenueRouter.sol](contracts/modules/RevenueRouter.sol) used on settlement. Keep commerce vs work-verification domains separated.
- **Tokens**: [contracts/tokens/MembershipTokenERC20Votes.sol](contracts/tokens/MembershipTokenERC20Votes.sol) is the merit-governance token (minted via Engagement approvals); [contracts/tokens/CommunityToken.sol](contracts/tokens/CommunityToken.sol) stablecoin wrapper (see economic layer). ValuableActionSBT covers reputation.
- **Shared libs & types**: [contracts/libs/Errors.sol](contracts/libs/Errors.sol) centralizes custom errors; [contracts/libs/Types.sol](contracts/libs/Types.sol) holds shared structs/enums. Use these rather than redefining.
- **Interfaces**: `contracts/core/interfaces` and `contracts/modules/interfaces` expose module APIs—prefer using them in cross-module calls to avoid tight coupling.
- **Cross-cutting invariants**: Timelock is the only authority for privileged mutations (verifier power, ParamController updates, TreasuryAdapter spends); SBT/VPT non-transferable; TreasuryAdapter guardrails must never be bypassed; Marketplace disputes route to CommerceDisputes while Engagements handle ValuableActions ("Claims" reserved for revenue claiming only); ParamController remains single source for timing/eligibility/economic parameters.

## Indexer (apps/indexer)
- **Stack**: Ponder v0.7, viem, Hono; Postgres DB. Commands: `pnpm --filter @shift/indexer dev|start|build` (dev = ponder dev, build = codegen).
- **Config**: [apps/indexer/ponder.config.ts](apps/indexer/ponder.config.ts) loads `deployments/{PONDER_NETWORK}.json` (default `base_sepolia`) for addresses and optional `startBlock`; envs `PONDER_NETWORK`, `PONDER_START_BLOCK`, `RPC_BASE`, `RPC_BASE_SEPOLIA`, `DATABASE_URL` (defaults to local Postgres). Missing deployment file throws.
- **Tracked contracts**: CommunityRegistry, RequestHub, DraftsManager, ShiftGovernor, CountingMultiChoice, Engagements, VerifierManager, ValuableActionRegistry. ABIs are read from `apps/indexer/abis/*.json`; keep `scripts/copy-ponder-abis.js` up to date after contract changes.
- **Schema & generated code**: lives under `apps/indexer/schema/` and `apps/indexer/generated/`; update alongside ABI and config changes. Ensure startBlock is set to avoid reprocessing entire chain when appropriate.

## Web dApp (apps/web)
- **Stack**: Next.js 16 App Router, React 19, Tailwind, TanStack Query, wagmi + viem, zod; markdown pipeline (remark/rehype) and icons via lucide-react. Shared UI and utils from `@shift/ui` and `@shift/shared` (workspace packages).
- **Commands**: `pnpm --filter @shift/web dev|build|start|lint|test:unit|test:e2e`. Tests: Vitest + Testing Library + MSW for unit/integration; Playwright scaffold for e2e.
- **Testing utilities**: `renderWithProviders`, MSW handlers under `tests/unit/mocks`, wallet state helpers `mockWagmiHooks` for connected/disconnected or chain-mismatch scenarios.
- **Project layout**: `app/` routes, `components/`, `hooks/`, `lib/`, `abis/` synced via `scripts/copy-web-abis.js`, and design guidance in `CONTAINER_COMPONENT_PATTERN.md`. Env config via `.env.local` (see Next/ViEM RPCs, API endpoints).
- **Integrations**: Uses GraphQL (graphql-request) against indexer APIs; wagmi/viem for onchain reads/writes. Keep ABIs in sync with contracts and update types when addresses or interfaces change.

## Changelog
- 2026-03-05: Completed Manager route/component canonicalization by removing legacy `/claims` app routes and compatibility tests, renaming claim-named UI files/symbols to engagement naming (`components/engagements/*`, unit tests, mocks), and dropping temporary `claims` aliases from web contract/query helpers. Updated marketplace/profile copy/links to `/engagements`. Validation: targeted engagement-related web tests pass; full web suite remains blocked by pre-existing unresolved `draft-create-form` import error.
- 2026-03-05: Implemented Manager Engagements canonicalization slice for work verification: added canonical `/engagements` routes with `/claims` compatibility wrappers, switched Manager contract wiring to `addresses.engagements` + `apps/web/abis/Engagements.json`, and promoted canonical `EngagementQuery`/`EngagementsQuery` symbols with temporary claim aliases. Added compatibility and wiring tests (`apps/web/tests/unit/routes/claims-compatibility.test.tsx`, `apps/web/lib/contracts.test.ts`, `apps/web/lib/graphql/queries.test.ts`) and updated existing claim component tests/copy to Engagement wording. Validation status: targeted web tests PASS, indexer build PASS, full `pnpm --filter @shift/web test:unit` blocked by pre-existing missing import in draft-create-form tests, and `pnpm forge:test` blocked by pre-existing Foundry compiler-cache parse error.
- 2026-03-05: Added formal documentation coordination contract between `.github/project-management/STATUS_REVIEW.md` (strategic baseline/changelog) and `.github/project-management/IMPLEMENTATION_STATUS.md` (tactical implementation matrix). Future updates must keep both files synchronized in the same change set.
- 2026-03-05: Hardened staged deployment reliability for live networks: `deploySharedInfraIfMissing` now validates on-chain bytecode/ABI probes before reusing JSON addresses and auto-redeploys invalid shared infra; community registration ID resolution now uses `CommunityRegistered` receipt logs to avoid immediate-RPC readback mismatch; package `deploy:shared-infra|deploy:community-stack|deploy:wire-community|deploy:verify-community` scripts now correctly accept forwarded `--network` arguments.
- 2026-03-05: Deprecated one-shot deployment path after dry-run failure (`GovernorOnlyExecutor`) and archived `scripts/deploy-complete.ts` + `scripts/hardhat/deploy.ts` into `scripts/legacy/`; package deploy scripts now run the canonical 4-step staged pipeline per network.
- 2026-03-05: Security closeout package completed for `001-security-fixes`: added explicit closeout evidence bundle, quantitative M-1 methodology/thresholds, deterministic settlement outcome matrix, dependency validation matrix, and partial-rollout recovery checks. M-1 closeout status recorded as `RESIDUAL_RISK_ACCEPTED` with governance ownership and compensating controls.
- 2026-02-19: Reorganized `scripts/` surface by archiving deprecated/hardcoded/broken operational scripts to `scripts/legacy/`, removed legacy package command exposure, retained only active deployment/admin/monitoring tooling, and added `scripts/README.md` as the canonical scripts inventory.
- 2026-02-17: Added production-grade community deployment flow under `scripts/hardhat` with explicit phases (`deploy-shared-infra`, `deploy-community-stack`, `post-deploy-role-wiring`, `verify-community-deployment`), selector-level least-privilege AccessManager wiring for cross-module restricted calls, VerifierPowerToken community initialization guard in wiring, deployments JSON consistency updates, and new role-path validation tests (Foundry + Hardhat dry-run).
- 2026-02-15: Security-fixes implementation pass completed for staged hardening set (M-1/M-2/M-4/M-5) with regression coverage additions; added D-1/D-2 ops runbooks and helper monitoring scripts; docs alignment updated across Architecture/Whitepaper/FEATURES.
- 2026-01-21: Removed MembershipTokenERC20Votes `initialize` placeholder and `initialized` flag; tests updated.
- 2026-01-21: Removed VerifierManager `engagementsContract` state and `setEngagementsContract`; AccessManager caller role remains for Engagements; deploy/test/docs updated.
- 2026-01-21: VerifierManager `selectJurors`/`reportFraud` now AccessManager-gated via `VERIFIER_MANAGER_CALLER_ROLE`; deploy wiring and tests updated; docs aligned.
- 2026-01-19: HousingManager marketplace callbacks now AccessManager-gated (new `HOUSING_MARKETPLACE_CALLER_ROLE`); deploy-complete wiring updated; HousingManager docs aligned.
- 2026-01-15: Deploy script now boots AccessManager with per-module selector roles (timelock admin) covering verification, economic, and commerce modules; docs updated.
- 2026-01-11: DraftsManager constructor now requires timelock; admin/config updates are timelock-gated with events; deployment script needs timelock param; docs aligned.
- 2026-01-03: Terminology alignment (Engagements replace Claims for work verification), added InvestmentCohortManager/PositionManager/CredentialManager pointers; clarified commerce separation wording.
- 2025-12-22: Marked as living doc; remove outdated deployment guides; staging-only context.
