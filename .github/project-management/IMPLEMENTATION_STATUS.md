# Shift Monorepo Implementation Status

## 1) Purpose And Scope

This document is an evidence-based implementation snapshot of Shift across three layers:
- Contracts (`contracts/**`)
- Ponder indexer (`apps/indexer/**`)
- Next.js Manager (`apps/web/**`)

Companion document:
- This file is the tactical implementation matrix and gap tracker.
- `.github/project-management/STATUS_REVIEW.md` is the strategic architecture/risk/workflow baseline and historical changelog.

Coordination rule with `STATUS_REVIEW.md`:
- If feature statuses, drift risks, or backlog priorities change here, add a dated changelog note in `STATUS_REVIEW.md`.
- If architecture/governance/tooling expectations change in `STATUS_REVIEW.md`, re-validate and update this matrix in the same change set.

Evaluation baseline:
- Feature taxonomy from `contracts/FEATURES.md` (sections `3.1` to `3.18`)
- Constitution requirements in `.specify/memory/constitution.md`, especially:
  - Contract-first authority
  - Event-driven deterministic projection
  - Vertical-slice delivery across contracts + indexer + app

Status semantics used in this file:
- `Implemented`: usable end-to-end surface exists for this layer and feature area.
- `Partial`: meaningful implementation exists, but key sub-capabilities are missing or incomplete.
- `Missing`: no meaningful implementation found in this layer.

---

## 2) Feature Matrix By Layer

| Feature | Contracts | Ponder Indexer | Manager (Next.js) | Evidence (code) |
|---|---|---|---|---|
| `3.1 Governance System` | Implemented | Partial | Partial | `contracts/core/ShiftGovernor.sol`, `contracts/core/CountingMultiChoice.sol`, `test/CountingMultiChoice.t.sol`; indexer proposal/vote handlers in `apps/indexer/src/index.ts`; proposal UI in `apps/web/app/governance/proposals/page.tsx`, `apps/web/components/governance/proposal-detail.tsx` |
| `3.2 Community Management` | Implemented | Partial | Partial | `contracts/modules/CommunityRegistry.sol`, `contracts/modules/ParamController.sol`, `test/CommunityRegistry.t.sol`, `test/ParamControllerVPT.t.sol`; only community registration projection in `apps/indexer/src/index.ts`; community list + placeholder detail in `apps/web/components/communities/community-list.tsx`, `apps/web/app/communities/[communityId]/page.tsx` |
| `3.3 Valuable Action & Engagement` | Partial | Partial | Partial | `contracts/modules/ValuableActionRegistry.sol`, `contracts/modules/Engagements.sol`, `contracts/modules/ValuableActionSBT.sol`, `test/ValuableActionRegistry.t.sol`, `test/Engagements.t.sol`, `test/ValuableActionSBT.t.sol`; engagement handlers in `apps/indexer/src/index.ts`; canonical engagements UI/routes in `apps/web/app/engagements/**` with legacy compatibility wrappers in `apps/web/app/claims/**` and shared components in `apps/web/components/claims/*` |
| `3.4 Verifier / Jury (VPT)` | Partial | Partial | Missing | `contracts/tokens/VerifierPowerToken1155.sol`, `contracts/modules/VerifierElection.sol`, `contracts/modules/VerifierManager.sol`, `test/VerifierPowerToken1155.t.sol`, `test/VerifierElection.t.sol`, `test/VerifierManager.t.sol`; juror selection projection only in `apps/indexer/src/index.ts`; no verifier management pages/components in `apps/web/app` |
| `3.5 Credential Management` | Implemented | Missing | Missing | `contracts/modules/CredentialManager.sol`, `test/CredentialManager.t.sol`; no credential tables/handlers in `apps/indexer/ponder.schema.ts`, `apps/indexer/src/index.ts`; no credential UI routes/components in `apps/web/app` |
| `3.6 Position & Role Management` | Implemented | Missing | Missing | `contracts/modules/PositionManager.sol`, `test/PositionManager.t.sol`; no position projection in `apps/indexer/ponder.config.ts` or `apps/indexer/src/index.ts`; no position UI in `apps/web/app` |
| `3.7 Investment Cohort System` | Implemented | Missing | Missing | `contracts/modules/CohortRegistry.sol`, `contracts/modules/InvestmentCohortManager.sol`, `test/CohortRegistry.t.sol`, `test/InvestmentCohortManager.t.sol`; no cohort projection in `apps/indexer/src/index.ts`; no cohort UI in `apps/web/app` |
| `3.8 Revenue Distribution` | Implemented | Missing | Missing | `contracts/modules/RevenueRouter.sol`, `test/MarketplaceRevenueRouter.t.sol`, `test/RevenueRouterCohort.t.sol`; no revenue projection in `apps/indexer/src/index.ts`; no revenue claim/treasury UI in `apps/web/app` |
| `3.9 Marketplace & Commerce` | Implemented | Missing | Missing | `contracts/modules/Marketplace.sol`, `test/MarketplaceHousing.t.sol`, `test/MarketplaceDisputes.t.sol`; no marketplace projection handlers in `apps/indexer/src/index.ts`; marketplace pages are placeholders in `apps/web/app/marketplace/page.tsx`, `apps/web/app/marketplace/offers/page.tsx` |
| `3.10 Commerce Disputes` | Partial | Missing | Missing | `contracts/modules/CommerceDisputes.sol` (admin-only TODO noted in file), `test/MarketplaceDisputes.t.sol`; no dispute tables/handlers in `apps/indexer/ponder.schema.ts`, `apps/indexer/src/index.ts`; no active dispute UI in `apps/web/app/marketplace/offers/[offerId]/page.tsx` |
| `3.11 Co-Housing Manager` | Implemented | Missing | Missing | `contracts/modules/HousingManager.sol`, `test/MarketplaceHousing.t.sol`; no housing projection in `apps/indexer/src/index.ts`; placeholder housing pages in `apps/web/app/housing/page.tsx`, `apps/web/app/housing/reservations/page.tsx` |
| `3.12 Request Hub` | Implemented | Partial | Implemented | `contracts/modules/RequestHub.sol`, `test/RequestHub.t.sol`; request/comment/status/moderation handlers in `apps/indexer/src/index.ts`; request create/detail/comment/moderation UI in `apps/web/components/requests/*`, `apps/web/app/requests/page.tsx` |
| `3.13 Drafts Manager` | Implemented | Implemented | Implemented | `contracts/modules/DraftsManager.sol`, `test/DraftsManager.t.sol`; draft/version/review/escalation handlers in `apps/indexer/src/index.ts`; drafts create/list/detail/escalation UI in `apps/web/components/drafts/*`, `apps/web/app/drafts/page.tsx` |
| `3.14 Treasury Adapter` | Implemented | Missing | Missing | `contracts/modules/TreasuryAdapter.sol`, `test/TreasuryAdapter.t.sol`; no treasury adapter projection in `apps/indexer/src/index.ts`; no treasury adapter UI in `apps/web/app` |
| `3.15 Parameter Controller` | Implemented | Missing | Missing | `contracts/modules/ParamController.sol`, `test/ParamControllerVPT.t.sol`, `test/ParameterIntegration.t.sol`; no param projection in `apps/indexer/src/index.ts`; no param management UI in `apps/web/app` |
| `3.16 Token System` | Implemented | Missing | Missing | `contracts/tokens/CommunityToken.sol`, `contracts/tokens/MembershipTokenERC20Votes.sol`, `contracts/tokens/VerifierPowerToken1155.sol`, `test/CommunityToken.t.sol`, `test/MembershipToken.t.sol`, `test/VerifierPowerToken1155.t.sol`; no token projection in `apps/indexer/src/index.ts`; no token management UI in `apps/web/app` |
| `3.17 SBT System` | Implemented | Missing | Missing | `contracts/modules/ValuableActionSBT.sol`, `test/ValuableActionSBT.t.sol`; no SBT projection in `apps/indexer/src/index.ts`; no SBT explorer/management UI in `apps/web/app` |
| `3.18 Project Factory` | Implemented | Missing | Missing | `contracts/modules/ProjectFactory.sol`; no project factory projection in `apps/indexer/src/index.ts`; no project factory UI in `apps/web/app` |

### Layer Summary

- Contracts: Broadly implemented across all feature areas, with partials mainly in known TODO zones (`CommerceDisputes`, `VerifierPowerToken1155`, parts of `Engagements`).
- Ponder indexer: Deep support for coordination/governance/engagement slices (`communities`, `requests/comments`, `drafts/reviews/versions`, `proposals/votes`, `engagements/jurors`), but missing most economic/commerce/token surfaces.
- Manager app: Functional for requests, drafts, governance proposals, and claims/engagement interactions; significant placeholders/missing UX for marketplace, housing, disputes, token/economic/treasury/admin modules.

---

## 3) Cross-Layer Drift Risks

1. Terminology transition still in compatibility window.
- Canonical work-verification route/copy and contract wiring now use `Engagements` (`apps/web/app/engagements/**`, `apps/web/lib/contracts.ts`, `apps/web/lib/graphql/queries.ts`).
- Legacy `/claims` wrappers and temporary query/contract aliases remain for migration safety and must be sunset explicitly after dependent links/tests are migrated.

2. Indexer under-projects deployed protocol surface.
- `apps/indexer/ponder.config.ts` includes only a subset of contracts.
- `apps/indexer/src/index.ts` handlers cover governance/coordination/engagement core, but no handlers for marketplace/housing/disputes/revenue/cohorts/tokens/treasury/credentials/positions/project factory.
- UI links to routes that assume these surfaces are available.

3. Community projection assumptions are not fully deterministic.
- Indexer uses deployment-derived `defaultCommunityId` in proposal and engagement writes (`apps/indexer/src/index.ts`) instead of deriving all joins from event context/module-community mapping.
- This is a multi-community risk for projection correctness.

4. UX navigation exposes non-existent or placeholder flows.
- Governance links to `/governance/activity`, but this route is not present (`apps/web/app/governance/page.tsx`; only proposal routes exist under `apps/web/app/governance/**`).
- Marketplace/housing/community detail pages explicitly state pending integration (`apps/web/app/marketplace/*`, `apps/web/app/housing/*`, `apps/web/app/communities/[communityId]/page.tsx`).

5. Contract-level TODOs can propagate false completeness assumptions.
- `contracts/modules/CommerceDisputes.sol` documents admin-only finalization TODO for juror integration.
- `contracts/tokens/VerifierPowerToken1155.sol` includes TODOs for verifier enumeration/counting helpers.
- `contracts/modules/Engagements.sol` includes TODO around revocation side effects.

---

## 4) Prioritized Implementation Backlog

### P0 (correctness and constitution compliance)

1. Normalize `Claims` to `Engagements` in app wiring.
- Replace `claims` contract config with `engagements` in `apps/web/lib/contracts.ts`.
- Update imports to `Engagements.json` and route/component naming plan.
- Ensure deployment key alignment with `deployments/*.json`.

2. Fix broken/phantom governance activity navigation.
- Either implement `/governance/activity` route and data source, or remove link in `apps/web/app/governance/page.tsx`.

3. Document and enforce single source of feature truth.
- Add a CI check that prevents manager routes from advertising unsupported indexed features unless explicitly flagged as placeholder.

### P1 (vertical slice completion for active UX promises)

1. Marketplace + Housing + Disputes indexer slice.
- Add contracts to `apps/indexer/ponder.config.ts`.
- Add schema tables and handlers for offers/orders/reservations/disputes.
- Replace placeholder pages in `apps/web/app/marketplace/**` and `apps/web/app/housing/**` with real data and actions.

2. Engagements/ValuableAction projection expansion.
- Add ValuableActionRegistry event handlers and richer engagement state (appeals/revocations/links).
- Ensure Manager detail pages use projected values instead of ad-hoc assumptions.

3. Multi-community projection hardening.
- Remove reliance on deployment `defaultCommunityId` where event-derived mapping is possible.
- Add replay tests for multiple community ids in one chain dataset.

### P2 (economic and admin operations)

1. Cohorts, revenue router, positions, credentials projections and manager pages.
- Index `CohortRegistry`, `InvestmentCohortManager`, `RevenueRouter`, `PositionManager`, `CredentialManager`.
- Ship manager slices for claims/withdrawals/admin actions with role-aware gating.

2. Treasury and parameter governance UX.
- Index `TreasuryAdapter` and `ParamController` changes.
- Add manager workflows for governance-managed parameter updates and treasury transaction previews.

3. Token and SBT explorer/admin tools.
- Add indexer and UI surfaces for CommunityToken, MembershipToken, VPT, SBT issuance/revocation views.

### P3 (tech debt and risk cleanup)

1. Resolve contract TODOs with tests.
- CommerceDisputes juror integration path.
- VPT enumeration/counting helper implementation.
- Engagement revoke side-effect completeness.

2. Replace placeholder text with capability flags.
- Introduce feature-flag metadata so pages render explicit "not available on this deployment" states from config, not static copy.

---

## 5) Definition Of Done Checklist For Future Features

A feature is only complete when all checks below are `true`.

### Contracts
- [ ] Contract logic implemented with explicit access control and invariant preservation.
- [ ] Foundry tests added/updated for happy path, revert paths, and role boundaries.
- [ ] Emitted events are sufficient for deterministic off-chain projection.
- [ ] ABI sync executed for downstream consumers (`scripts/copy-ponder-abis.js`, `scripts/copy-web-abis.js`).

### Ponder Indexer
- [ ] New/changed contracts registered in `apps/indexer/ponder.config.ts`.
- [ ] Projection schema updated in `apps/indexer/ponder.schema.ts`.
- [ ] Event handlers implemented in `apps/indexer/src/index.ts`.
- [ ] Replay/backfill tested for deterministic outputs.

### Manager App
- [ ] Read paths query only indexed or direct on-chain data that exists in deployed contracts.
- [ ] Write paths map to real contract functions and deployment keys.
- [ ] Permission and role gating enforced in UI.
- [ ] Error handling translates common revert reasons into user-readable messages.
- [ ] No route labeled as live unless data + tx flow are actually operational.

### Cross-Layer Governance
- [ ] Terminology matches constitution and protocol canon (e.g., `Engagements`, not `Claims`).
- [ ] `contracts/FEATURES.md` and user-facing docs reflect shipped behavior, not aspirational behavior.
- [ ] Status review entry updated in `.github/project-management/STATUS_REVIEW.md` for meaningful deltas.

---

## How To Keep This File Updated

Run this update process whenever contracts, indexer handlers, or manager flows change:

1. Re-scan feature map.
- Use `contracts/FEATURES.md` as the canonical list (`3.1`-`3.18`).

2. Verify contract evidence.
- Confirm contract file exists and tests cover core flow (`contracts/**`, `test/**`).

3. Verify indexer evidence.
- Confirm contract registration (`apps/indexer/ponder.config.ts`), schema tables (`apps/indexer/ponder.schema.ts`), and handlers (`apps/indexer/src/index.ts`).

4. Verify manager evidence.
- Confirm route exists (`apps/web/app/**`), data query exists (`apps/web/lib/graphql/queries.ts`), and write/read integration exists (`apps/web/components/**`, `apps/web/lib/contracts.ts`).

5. Reclassify statuses.
- Apply `Implemented` / `Partial` / `Missing` strictly from code evidence.

6. Refresh drift risks and backlog priorities.
- Remove resolved risks, add new risks, and reorder backlog by correctness and constitution impact.

7. Record the delta.
- Add a short note in `.github/project-management/STATUS_REVIEW.md` referencing this file update.

8. Keep companion documents in lockstep.
- Confirm `.github/project-management/STATUS_REVIEW.md` still matches this file's current top risks and priorities.
- If they diverge, update both in the same PR before merge.

---

## 2026-03-06 Tactical Update (Manager Home Deploy Wizard)

- Added Manager Home deploy wizard scaffolding and foundational deploy domain modules in `apps/web/lib/deploy/*`, `apps/web/hooks/useDeployWizard.ts`, and `apps/web/hooks/useDeployResume.ts`.
- Added deterministic script-parity verification evaluator and on-chain snapshot reader (`CommunityRegistry` and role/module checks) for post-registration authority.
- Updated home route composition to render deploy wizard above communities index (`apps/web/app/page.tsx`).
- Expanded web unit coverage for wizard machine, preflight, verification parity, created-state gating, resume authorization, multi-community resume targeting, and home-route composition.
- Updated communities list navigation and optional-name fallback handling.
- Validation evidence: targeted feature test set passes via `pnpm exec vitest run ...` in `apps/web`.

## 2026-03-07 Tactical Update (Wizard Execution Path)

- Replaced fallback throw-only deploy behavior with a default user-signed step executor in `apps/web/lib/deploy/default-step-executor.ts` and wired it in `apps/web/hooks/useDeployWizard.ts`.
- Default wizard execution now performs concrete on-chain write attempts for `DEPLOY_STACK` and `WIRE_ROLES` using `writeContractAsync` + receipt confirmation, with deterministic step tx hash tracking.
- Added execution-flow tests in `apps/web/tests/unit/hooks/use-deploy-wizard-execution.test.tsx` covering successful end-to-end step sequencing and mid-flow failure persistence.

## 2026-03-09 Tactical Update (Staging Deployment Policy)

- Adopted explicit Base Sepolia staging policy for current development cycle:
  - no legacy support requirements,
  - no incremental migration path requirements,
  - clean-slate full redeploy is expected when core architecture/behavior changes.
- Implementation and refactor decisions from this point should optimize for secure target-state architecture rather than backward compatibility with prior staged deployments.
