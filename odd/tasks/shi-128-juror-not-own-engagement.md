# SHI-128 — A participant cannot be a juror of their own engagement

Locator: `odd/tasks/shi-128-juror-not-own-engagement.md` · Engram (project `shift-desoc`) topic `odd/shi-128-juror-not-own-engagement/tasks`
Linear: SHI-128 (Bug, `domain:contracts`, `workflow:needs-spec`, Phase 3, updatedAt 2026-11-04T00:20:52.746Z) · Base: 8e6d739 · Branch: `fix/SHI-128/juror-not-own-engagement`
Runner: Foundry (`pnpm forge:test`). Forecast **Risk: high** (items 2, 3, 5 — verification invariant, `selectJurors` selector consumed by AccessManager wiring, deploy wiring/bundled artifacts).

## Objective

A submitter must never be selected as a juror of their own engagement, and must never be able to vote on it, while `jurorsMin` / `InsufficientVerifiers` semantics stay consistent.

## Problem

Merit is meant to be verified by peers. A submitter who is also an eligible verifier can land on their own panel and vote approve.

## Current evidence (base 8e6d739)

- `Engagements.submit` writes `engagement.participant = msg.sender` (`contracts/modules/Engagements.sol:161`) and then calls `IVerifierManager(verifierManager).selectJurors(engagementId, action.panelSize, seed, false)` with no participant (`Engagements.sol:174-179`). It then only checks `selectedJurors.length < action.jurorsMin` (`Engagements.sol:181-183`).
- `VerifierManager._selectJurors` pulls `verifierElection.getEligibleVerifiers()` and reverts `InsufficientVerifiers(0, panelSize)` if empty and `InsufficientVerifiers(eligible.length, panelSize)` if `panelSize > eligible.length` (`VerifierManager.sol:109-119`); both `_uniformSelection` and `_weightedSelection` pick from the full list with no exclusion (`VerifierManager.sol:~259-345`). Selection always returns exactly `panelSize` jurors; there is no "smaller panel" path today, so none is introduced.
- `Engagements.verify` is guarded only by `onlyAssignedJuror` (`Engagements.sol:88-98, 214`); it never compares `msg.sender` with `engagement.participant`.
- `Engagements.assignJurors` is an `external` path gated to `msg.sender == verifierManager` (`Engagements.sol:199-208`); VerifierManager never calls it (grep: no caller), but it also sets jurors without any participant check.
- Resolution math uses `jurors.length` and `jurorsMin` (`Engagements.sol:235-236`): an unusable (self) seat would shrink effective votes, so rejection in `verify` alone is not enough.
- `selectJurors` is `restricted` and its selector is wired to `VERIFIER_MANAGER_CALLER_ROLE` in: `scripts/hardhat/community-deploy-lib.ts:993`, `apps/web/lib/deploy/factory-step-executor.ts:2745` (signature string), `apps/web/lib/community-overview/access-inspection.ts:53` (signature string), `scripts/legacy/deploy-complete.ts:724`, `test/Engagements.t.sol:199-201`, `test/VerifierManager.t.sol:76`. Changing the signature changes the selector, so every one must move together.
- Callers/tests of `selectJurors`: ~25 calls in `test/VerifierManager.t.sol` (e.g. :169, :192, :208-221, :229-552); `test/mocks/MockFailingVerifierManager.sol:5` (already has a stale 5-arg shape; used by `testSubmitEngagementRevertsWhenJurorSelectionFails`, `test/Engagements.t.sol:462`).
- Existing test fixtures: five verifiers `setVerifierSet` in `test/Engagements.t.sol:283-296`; `worker1` (`:123`) is not a verifier, so new tests must add the submitter to the verifier set.
- Indexer/Manager: events `JurorsSelected`/`JurorsAssigned` keep their shape (indexer handlers `apps/indexer/src/index.ts:1131, 1160`; compat test `apps/indexer/test/unit/abi-event-compatibility.test.ts:31-32`), so no handler change. No new ParamController key is needed (no ParamController event/policy involved). Manager hook `useValuableActionDirectWriteAuthority` (`apps/web/tests/unit/hooks/use-valuable-action-direct-authority.test.tsx`) concerns registry write authority, not juror selection — not affected. Only the ABI copies change: `apps/indexer/abis/VerifierManager.json`, `apps/web/abis/VerifierManager.json` (via `pnpm forge:build` → `scripts/copy-ponder-abis.js`/`copy-web-abis.js`) and `apps/web/lib/deploy/bundled-contracts/{VerifierManager,Engagements}.json` (deploy-wizard bundle, `scripts/copy-web-deploy-artifacts.js`; SHI-127 lesson: refresh before audit, commit `60e4f8f`).

## Decision (guard)

**Both**: (1) exclude the participant at selection by adding an `excluded` address parameter to `IVerifierManager.selectJurors` / `VerifierManager.selectJurors`; (2) reject in `Engagements.verify` when `msg.sender == engagement.participant` (defense in depth; also covers the `assignJurors` path).

- Small electorate: filtering happens before the size checks, so `InsufficientVerifiers(available, required)` reports the pool **after** exclusion (a lone eligible submitter ⇒ `InsufficientVerifiers(0, panelSize)` ⇒ `submit` reverts). No smaller panel is selected, so `selectedJurors.length >= jurorsMin` in `submit` still holds whenever `panelSize >= jurorsMin`.
- Chosen signature change *replaces* the 4-arg function (keeping both would leave a second, unguarded entry point under the same role). Consequence: communities deployed before this change keep the old selector wiring and need redeploy (Engagements/VerifierManager are constructor-based, not upgradeable).

## Scope

`contracts/modules/Engagements.sol`, `contracts/modules/VerifierManager.sol`, `contracts/core/interfaces/IVerifierManager.sol`, selector/signature wiring listed above, `test/Engagements.t.sol`, `test/VerifierManager.t.sol`, `test/mocks/MockFailingVerifierManager.sol`, regenerated ABIs and bundled artifacts. Estimated ~250 authored lines excluding generated JSON: one PR (one Feature seam).

## Non-goals

No new ParamController keys, no change to weighting, appeals, fraud reporting, or event shapes; no migration of already-deployed communities; no Manager UI changes.

## Specs

- **S1** Selection excludes the participant: `selectJurors(engagementId, panelSize, seed, useWeighting, excluded)` never returns `excluded`, in both uniform and weighted modes.
- **S2** Small electorate: when the eligible set minus `excluded` is smaller than `panelSize`, selection reverts `InsufficientVerifiers(availableAfterExclusion, panelSize)`; a participant who is the only eligible verifier makes `submit` revert (no engagement created, no panel containing them). If `excluded` is not eligible the pool is unchanged.
- **S3** `Engagements.submit` passes `msg.sender` as `excluded`; the `selectedJurors.length < jurorsMin` check is kept.
- **S4** `Engagements.verify` reverts when `msg.sender == engagement.participant` (`Errors.NotAuthorized(msg.sender)`), even if the address is somehow in `jurors` (e.g. injected via `assignJurors`), and does not change vote counts or emit `EngagementVerified`.
- **S5** Existing behavior is preserved: non-participant jurors vote/resolve exactly as before (`testVerifyEngagementMajorityApproves`, `testVerifyUsesConfiguredJurorsMin`, `testJurorCannotDoubleVote`, `testNonJurorCannotVerify`); events `JurorsSelected`/`JurorsAssigned` unchanged.
- **S6** Role wiring and consumers follow the new selector `selectJurors(uint256,uint256,uint256,bool,address)`: hardhat deploy lib, wizard executor, access inspection, legacy script, forge setUp selectors, ABIs, bundled artifacts.
- **S7** QA (Base Sepolia, from the issue): with a wallet that is both a verifier and a submitter, submit an engagement: that wallet must not appear in the juror panel and `verify` must revert for it.

## Tasks (test-first; each commit one coherent unit)

- **T1** (S1, S2, S5) RED then GREEN in `test/VerifierManager.t.sol`: tests for exclusion (uniform + weighted), lone-eligible-participant `InsufficientVerifiers(0, n)`, excluded-not-eligible unchanged; update existing calls to the 5-arg form (pass `address(0)`/a non-verifier); implement in `VerifierManager.sol` + `IVerifierManager.sol`; update `MockFailingVerifierManager.sol` and forge setUp selector strings (`test/VerifierManager.t.sol:76`).
- **T2** (S3, S4, S5) RED then GREEN in `test/Engagements.t.sol`: participant-is-verifier is never in `getEngagementJurors`; participant sole eligible verifier ⇒ `submit` reverts; direct `verify` by participant reverts (also via an injected-juror case using the verifierManager caller for `assignJurors`); existing vote tests unchanged; update selector string at `:201`. Implement in `Engagements.sol`.
- **T3** (S6) Update `scripts/hardhat/community-deploy-lib.ts` (uses `getFunction("selectJurors")` — verify it resolves unambiguously), `apps/web/lib/deploy/factory-step-executor.ts:2745`, `apps/web/lib/community-overview/access-inspection.ts:53`, `scripts/legacy/deploy-complete.ts:724`; update any web unit tests asserting the old signature string; run `pnpm forge:build` and `node scripts/copy-web-deploy-artifacts.js` to refresh ABIs and bundled artifacts (commit them with the contract change).
- **T4** (S7) Record the QA steps in the PR/handoff; no code.

## Checks

`forge test --match-path test/VerifierManager.t.sol`, `forge test --match-path test/Engagements.t.sol`, `pnpm forge:test`, `pnpm --filter @shift/indexer run check:events`, `pnpm --filter @shift/indexer run check:compat`, `pnpm --filter @shift/web test:unit` (access-inspection/deploy executor tests), `pnpm --filter @shift/web build`.

## QA: how to test (Base Sepolia)

Redeploy a community with the new build (existing deployments are not patched). With a wallet that is both a verifier and a submitter: submit an engagement; `getEngagementJurors(id)` must not contain that wallet and `verify(id, true)` from it must revert `NotAuthorized`. If it is the only eligible verifier, `submit` itself reverts with `InsufficientVerifiers`.

## Open questions

1. Confirm replacing the 4-arg `selectJurors` (recommended) rather than adding an additive overload; either way the AccessManager selector wiring must change. Assumed: replace.
2. Already-deployed communities (Base Sepolia) keep the old selector and need redeploy — accepted? Assumed yes (non-upgradeable constructors).

## Risk

Risk: high — item 3 (public `selectJurors` signature/selector consumed by wiring, ABIs, wizard), item 2 (verification invariant/guard), item 5 (deploy wiring + bundled artifacts). Independent verifier required; contracts are always high-risk in Shift.

## Log

- L1 2026-11-21 planner run: read SHI-128 (no comments, no relations), AGENTS.md, skill; no existing document or Engram topic for SHI-128 (`engram search` empty). Original issue text: "A participant can be selected as a juror of their own engagement and verify it" — Options: exclude at selection, reject in `Engagements.verify`, or both; small panel must stay consistent with `jurorsMin` and `InsufficientVerifiers`; failing Foundry test first.
- L2 Decision: both guards; replace signature; no smaller panel. Engram MCP tools were not available in this session; the mirror was written via the `engram` CLI.
- L3 2026-11-21 implementer: operator answered open questions YES (replace 4-arg, redeploy, rewire AccessManager). T1 RED: VerifierManager tests failed to compile against the 4-arg interface (5-arg calls); GREEN: `forge test --match-path test/VerifierManager.t.sol` 33 passed. Engagements.submit call site passes `msg.sender` in T1 because the interface change breaks compilation otherwise; verify guard + tests are T2.
- L4 T2 RED: `testParticipantCannotVerifyOwnEngagementEvenIfInjectedAsJuror` failed ("next call did not revert as expected") before the verify guard; selection tests already green from T1. GREEN: `forge test --match-path test/Engagements.t.sol` 21 passed. Commit recorded below in L6.
