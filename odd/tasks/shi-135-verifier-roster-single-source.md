# SHI-135 — Verifier roster: one canonical source (VPT token), eligibility and stats can no longer diverge

Locator: `odd/tasks/shi-135-verifier-roster-single-source.md` · Engram (project `shift-desoc`): `odd/shi-135-verifier-roster-single-source/tasks`
Linear: SHI-135 (Bug, `domain:contracts`, `workflow:needs-spec`, Phase 3, High). Branch: `fix/SHI-135/verifier-roster-single-source`. Base: `3e7f758`.
Delivery: one PR, work-unit commits. Runner: Foundry (`pnpm forge:test`). Blocks SHI-136; related SHI-105.
Risk (forecast): **high** — items 1/3 (contract behavior change of a consumed view; juror selection). `domain:contracts`: the autonomous loop skips it unless `SHIFT_ALLOW_CONTRACT_ISSUES=true`.

## Objective
A verifier given power by any path (`adjustVerifierPower`, `setVerifierSet`, direct `VerifierPowerToken1155.mint/batchMint`, `adminTransfer`) is eligible for juror selection, listed by `getVerifierSet()`, and counted by `getCommunityStats()`, with totals equal to the VPT token's.

## Problem (evidence, verified by reading the code at base)
- `VerifierElection.getEligibleVerifiers()` iterates only `verifierSet.verifiers` (`contracts/modules/VerifierElection.sol:269-292`); `VerifierManager._selectJurors` consumes it (`contracts/modules/VerifierManager.sol:111-112`) as does `_getEligibleVerifierCount` (`:223`).
- `verifierSet.verifiers` is assigned only in `setVerifierSet` (`VerifierElection.sol:138`). `adjustVerifierPower` mints/burns VPT and updates `powers`/`totalPower` (`:205-216`) but never touches `verifiers`, so a newly granted address holds VPT yet is never selected and is absent from `getVerifierSet()` (`:227-243`) while `totalPower` already counts it (`getCommunityStats`, `:317-327`).
- `adjustVerifierPower` computes `oldPower` from the Election's shadow `powers` (`:213`), not the VPT balance (`:205`), so after a direct `VPT.mint` (admin role, which Election holds) or `adminTransfer` (`VerifierPowerToken1155.sol:194-224`) `totalPower` underflows/overstates. `banVerifiers` likewise subtracts shadow power (`VerifierElection.sol:165`) and never removes the address from `verifiers`; `setVerifierSet` burns only members of the shadow array (`:117-136`), so a directly minted holder survives a "full replacement".
- The token already has its own enumerable roster `_activeVerifiers` kept in sync on every mint/burn/transfer via `_syncActiveVerifier` (`VerifierPowerToken1155.sol:19-20, 75, 100, 128, 162, 218-219, 239-266`), `getCommunityVerifiers(start,max)` (`:273-299`) and `getCommunityStats()` returning `(totalVerifiers, totalPower, averagePower)` from `totalSupply` (`:304-312`). Two rosters exist; they diverge.
- Tests: `test/VerifierElection.t.sol` calls `adjustVerifierPower` only on a member (`testAdjustVerifierPower` ~`:362`), and `testGetCommunityStats` (`:465-498`) encodes the old semantics (`totalVerifiers == 3` with a zero-power member). No test checks eligibility after an adjust.
- Indexer: no handler in `apps/indexer/src` references `VerifierPowerAdjusted`/`VerifierSetUpdated`/`VerifiersBanned`; only ABIs (`apps/indexer/abis/VerifierElection.json`) and `module-key-allowlists.ts:12` mention the contract. Events are not changing.

## Decision for the spec (resolved): option (b) — the VPT token's active roster is the single canonical roster
Why (b) over (a):
1. (a) can only fix the `adjustVerifierPower` path. A direct `VPT.mint`/`batchMint`/`adminTransfer` never calls Election, so divergence would remain for those restricted-but-real paths (`VerifierPowerToken1155.sol:60-66, 106-112, 194-201`). (b) makes the invariant hold by construction, for all four.
2. The token roster already exists, is tested (SHI-52, `test/VerifierPowerToken1155.t.sol`) and is updated on every balance change. (a) would keep a second, hand-maintained array plus a shadow `powers`/`totalPower` that already drifted (`:165`, `:213`).
3. (b) removes state instead of adding it: Election's `verifiers`, `powers` and `totalPower` become derived views. No new events, no ABI changes to existing functions' signatures, so `check:events` stays green.
4. Cost: an extra external call set in views (`getCommunityStats` + `getCommunityVerifiers(0,n)`) — accepted; rosters are small and views already do per-address `balanceOf` calls.

Meaning of a direct `VPT.mint` (document it): it grants eligibility immediately (the token roster is canonical); a banned address stays excluded because Election still filters `_bannedVerifiers`. Election events (`VerifierPowerAdjusted`/`VerifierSetUpdated`) are emitted only by Election calls, so direct token mints are visible to indexers via the token's `VerifierGranted`/`VerifierRevoked` only — documented, not changed.

## Scope
- `contracts/modules/VerifierElection.sol` (derive roster/stats from the token; drop shadow state; fix `setVerifierSet` replace semantics and ban accounting), minimal interface additions to `IVPT1155` (`totalSupply`, `getCommunityVerifiers`, `getCommunityStats`).
- Tests in `test/VerifierElection.t.sol` (+ one `VerifierManager` juror-selection test), docs `docs/EN/contracts/VerifierElection.md` and `VerifierPowerToken1155.md` (+ ES mirrors if the sections exist), bundled ABI artifacts only if `pnpm`/copy scripts regenerate them (`scripts/copy-web-deploy-artifacts.js`).

## Non-goals
- No new events, no role/selector changes (`scripts/hardhat/community-deploy-lib.ts:986-989` selector list stays), no ParamController, treasury or authority wiring change.
- No Manager UI/indexer work (SHI-105/SHI-136). No allowing an empty `setVerifierSet` (keep `:91-93`; "cannot remove the last verifier via setVerifierSet" stays as-is and is documented; the last verifier can be removed with `adjustVerifierPower(v,0)` or ban).

## Specs
- **S1** `adjustVerifierPower(newAddr, n)` with `n>0` → `getEligibleVerifiers()` includes `newAddr` with power `n`, `getVerifierSet()` lists it, and `getCommunityStats()` `(activeVerifiers,totalPower)` equals the token's roster size/`totalSupply`. (Issue AC 1.)
- **S2** `adjustVerifierPower(addr, 0)` removes `addr` from eligibility, `getVerifierSet()` and stats; re-grant restores it.
- **S3** ban → unban → re-grant: ban burns power and drops the address from roster/eligibility/stats; unban alone does not re-add it; a later `adjustVerifierPower(addr, n>0)` does.
- **S4** A direct `VPT.mint(addr, n)` (and `batchMint`, `adminTransfer` destination) makes `addr` eligible and listed with matching totals; if `addr` is banned it stays ineligible (`getVerifierStatus.isBanned`). The behavior is documented.
- **S5** `setVerifierSet` remains a full replacement: targets get exact power; every current token-roster member not in the new set (including directly minted ones) is burned; still rejects length mismatch, empty set, zero address, zero weight, banned address (`VerifierElection.sol:88-103`); still emits `VerifierSetUpdated(communityId, addrs.length, newTotalPower, reasonCID)`.
- **S6** Existing signatures and events unchanged (`VerifierPowerAdjusted(communityId, verifier, oldPower, newPower, reasonCID)` now reports `oldPower` = token balance before the change). `check:events` and `check:compat` pass.
- **S7** `getCommunityStats()` returns `(totalVerifiers, activeVerifiers, totalPower, averagePower)` with `totalVerifiers == activeVerifiers == token roster size` (zero-power members no longer counted as set members); `totalPower == vpt.totalSupply()`.
- **S8** Juror selection: after `adjustVerifierPower(newAddr, n)`, `VerifierManager.selectJurors`/`getEligibleVerifierCount` include `newAddr` (a panel of full eligible size selects it).
- **S9** Docs updated: canonical roster = token; meaning of direct mint/transfer; what `setVerifierSet` and `adjustVerifierPower` do.

## Tasks (test-first; each task: RED test, then GREEN change; one work-unit commit each unless noted)
- **T1 (S1,S2,S3,S4,S7)** Add failing Foundry tests in `test/VerifierElection.t.sol`: adjust-new-address eligibility/set/stats vs token; adjust to zero; ban→unban→re-grant; direct `vpt.mint`, `batchMint`, `adminTransfer`; banned + direct mint stays ineligible. Update `testGetCommunityStats` to the new `totalVerifiers` semantics (note: explicit behavior change, S7). Observe RED, commit tests with the implementation in T2 (RED recorded in the Log).
- **T2 (S1-S5,S7)** Rewrite `VerifierElection` views to read the token roster (extend `IVPT1155` at `VerifierElection.sol:8-15`); remove `verifierSet.verifiers/powers/totalPower` shadow reads; `adjustVerifierPower` uses the token balance as `oldPower`; `banVerifiers` drops shadow subtraction (`:165-166`); `setVerifierSet` burns every token-roster member not in the new set (snapshot roster before minting). Keep `lastUpdated`/`lastReasonCID` (still returned by `getVerifierSet`). Paginate internally in bounded chunks if needed. Files: `contracts/modules/VerifierElection.sol`, `test/VerifierElection.t.sol`.
- **T3 (S5)** Tests pinning existing `setVerifierSet` behavior for touched paths: update-existing, remove-verifier, banned-reverts, zero/empty/mismatch reverts (the existing tests at `test/VerifierElection.t.sol:128-240, 331` must stay green) plus new: directly minted holder not in new set is burned. Files: `test/VerifierElection.t.sol`.
- **T4 (S8)** Test in `test/VerifierManager.t.sol`: adjust a new address, assert `getEligibleVerifierCount` and that selection with `panelSize == eligible count` includes it. Check other callers of the helpers (`test/Engagements.t.sol:193-196, 296`) still pass.
- **T5 (S6)** Differential check against base in a `mktemp -d` copy: ABI diff of `VerifierElection` (`forge inspect VerifierElection abi`) shows no signature/event change; run `check:events` and `check:compat`; regenerate/verify `apps/*/abis` and `apps/web/lib/deploy/bundled-contracts` only if the repo's copy script changes them (interface additions may alter bytecode in `bundled-contracts`; regenerate via the existing script, do not hand-edit).
- **T6 (S9)** Docs: `docs/EN/contracts/VerifierElection.md` (storage section ~`:12-20`, `adjustVerifierPower` ~`:56`, `getCommunityStats` ~`:244`, `setVerifierSet` ~`:234`) and `docs/EN/contracts/VerifierPowerToken1155.md` (canonical roster, direct mint semantics); mirror the ES docs sections if present; add `QA` note.

## Checks (narrowest first)
- `forge test --match-path test/VerifierElection.t.sol -vv` → `forge test --match-path test/VerifierManager.t.sol` → `forge test --match-path test/VerifierPowerToken1155.t.sol` → `forge test --match-path test/Engagements.t.sol` → `pnpm forge:test`; `pnpm forge:cov`/`pnpm cov:gate` when the contract changes.
- `pnpm --filter @shift/indexer run check:events` and `pnpm --filter @shift/indexer run check:compat` (events/ABI compatibility; S6).
- ABI differential vs base (`forge inspect`), see T5.

## QA: how to test (Base Sepolia)
1. On a community with a verifier set, as the admin/timelock call `adjustVerifierPower(newWallet, 100, "qm...")`.
2. Read `getVerifierSet()`, `getEligibleVerifiers()`, `getCommunityStats()` on `VerifierElection` and `getCommunityVerifiers(0,50)` on the VPT: `newWallet` appears in all, totals equal `vpt.totalSupply()`.
3. Submit an engagement repeatedly (panel size = eligible count or enough runs): `newWallet` is among the selected jurors.
4. `adjustVerifierPower(newWallet, 0)`: it disappears from all four views; ban → unban → re-grant restores it only after the re-grant.

## Open questions
- None blocking. Noted behavior change for consumers: `getCommunityStats().totalVerifiers` now equals the active roster (zero-power members excluded) — acceptable under the issue's goal of matching the token; confirm with the reviewer if SHI-105 depends on the old meaning (no Manager/indexer reader found at base).
- Contract issue: `domain:contracts` requires `SHIFT_ALLOW_CONTRACT_ISSUES=true` for autonomous implementation.

## Log
- L1 (2026-11-16, planner): Re-read SHI-135 from Linear (updated 2026-11-04T01:59:33Z, no comments, blocks SHI-136, related SHI-105). No existing ODD document or Engram topic for SHI-135 found. `forge` is installed, so the issue's "not reproduced" note is open; the first T1 RED run will reproduce it. Resolved the issue's "Decision for the spec" as option (b) (token roster canonical) with the reasons above. High risk: independent verifier required at the end; native review per RDD status; separate-session completeness audit before PR.
- L2 (2026-11-16, implementer): T1+T2+T3+T4+T5 landed in commit 4746572 (tests and implementation together, as planned in T1). RED at base: 8 VerifierElection tests failed (adjust-new-address, adjust-to-zero, ban/unban/re-grant, direct mint, batchMint, adminTransfer, set-replaces-direct-mint, updated testGetCommunityStats). GREEN after change: `forge test --match-path test/VerifierElection.t.sol` 30 pass; Verifier*.t.sol 32/29/30 pass; Engagements 17 pass; `pnpm forge:test` 511 passed, 0 failed. S8 test `testAdjustedNewVerifierIsCountedAndSelected` added in VerifierManager.t.sol (written with the implementation, so its RED at base was not separately observed).
- L3 T5: `forge inspect VerifierElection abi` identical to base (S6). `check:events` passed; `check:compat` passed when run with dummy env (COMMUNITY_REGISTRY_ADDRESS, COMMUNITY_REGISTRY_START_BLOCK, PONDER_RPC_URL_84532) because it fails without those env vars. Bundled artifact apps/web/lib/deploy/bundled-contracts/VerifierElection.json regenerated via `pnpm hh:compile` + `node scripts/copy-web-deploy-artifacts.js` (only that file changed). `pnpm forge:cov` fails with a pre-existing-looking Yul stack-too-deep in an unrelated contract under --ir-minimum, so cov:gate could not be validated meaningfully (script printed a static report).
- L4 T6: docs EN+ES for VerifierElection and VerifierPowerToken1155 + QA section in commit 8fb6f5b.
- L5 Engram mirror: engram MCP tools were not available in this session, so the mirror `odd/shi-135-verifier-roster-single-source/tasks` is NOT updated (pending); repo file is the current state.
