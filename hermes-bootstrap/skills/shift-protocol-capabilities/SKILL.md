---
name: shift-protocol-capabilities
description: "Reference for what the Shift protocol can and cannot do today (contracts, indexer, Manager) and which modules an ecosystem app should compose; use it before promising anything in a feature request, app discovery or architecture."
license: Apache-2.0
metadata:
  author: Shift
  version: "1.0"
  hermes:
    tags: ["shift", "mycelia", "protocol", "reference"]
---

# Shift protocol capabilities

This is a map, not the truth. The truth is, in order: contracts and events,
module wiring and deploy scripts, then
`.github/project-management/IMPLEMENTATION_STATUS.md` and `STATUS_REVIEW.md`.
Before answering "can Shift do X?", read the matrix in `IMPLEMENTATION_STATUS.md`
(§2) and the contract in `contracts/modules/`; a missing UI button or indexer
table does not prove the chain cannot do it, and the opposite.

## Building blocks (a "community" is the unit)

Every app on Shift is one or more **communities** keyed by `communityId` in
`CommunityRegistry`. Policy lives in `ParamController` (shared, keyed by
`communityId`); never design app-local shadow config.

| Need | Module | Notes |
| --- | --- | --- |
| Members, merit, voting | `MembershipTokenERC20Votes`, `ShiftGovernor`, Timelock | voting power is earned by verified work, not capital |
| Propose and discuss | `RequestHub`, `DraftsManager` | bounties link to ValuableActions |
| Define and verify work | `ValuableActionRegistry`, `Engagements`, `VerifierElection`, `VerifierManager`, `VerifierPowerToken1155` | M-of-N verification, no staking or bonding |
| Reputation and credentials | `ValuableActionSBT`, `CredentialManager`, `PositionManager` | soulbound; roles and courses |
| Money in a community | `CommunityToken` (1:1 backed), `RevenueRouter`, `CohortRegistry`, `InvestmentCohortManager`, `TreasuryAdapter` | RevenueRouter is pull-based; TreasuryAdapter validates policy and builds Safe-ready payloads, it is not a wallet |
| Sell and buy | `Marketplace` (offers, escrow, fulfillment) | disputes go to `CommerceDisputes`, separate from work verification |
| Rent space | `HousingManager` (ModuleProduct adapter: reservations, refund math) | plugs into Marketplace |
| Spin up sub-initiatives | `ProjectFactory` | project shells |

Authority: staged lifecycle, admin-managed first and governance-managed after
handoff (AccessManager + GovernorTimelockAccess). Do not flatten it.

## Maturity (verify in IMPLEMENTATION_STATUS.md before quoting)

Contracts are broadly implemented. Indexer and Manager coverage is uneven:
governance, requests, drafts and engagements are the most complete;
marketplace, housing, disputes, economy, treasury, credentials, positions and
verifier admin mostly lack indexer projections and Manager UX (tracked as
Phase 3–5 issues in Shift Manager). Network today is Base Sepolia with clean
redeploys, no production deployment.

## Archetypes: how the user's ideas map

| Idea | Composes | Likely gaps to flag |
| --- | --- | --- |
| Airbnb-style rentals on cohousing | community per property group, `HousingManager` + `Marketplace` + `CommerceDisputes`, `RevenueRouter` for host/community split, SBT for host/guest reputation | housing/marketplace indexer and UX are missing; dispute finalization path unresolved (SHI-51); pricing/calendar/search are off-chain app concerns |
| Driver community (ride-hailing) | community of drivers, credentials for licensing, reputation SBTs, `Engagements` to verify completed work, `RevenueRouter` for fees and cohorts for vehicle investment | real-time matching, maps, ratings latency, GPS and payments rails are off-chain; chain is the settlement and reputation layer, not the dispatcher |
| Building/condo administration | one community per building, governance for expensas and works, `RequestHub`/`DraftsManager` for issues and proposals, `TreasuryAdapter` for the building funds, `PositionManager` for administrator/council roles | local legal and fiscal rules; fiat on-ramp; notifications and document storage are off-chain |

Treat these as starting hypotheses for discovery, not commitments.

## What is always off-chain

Search, geo and maps, real-time matching, chat, notifications, file storage,
fiat payments and KYC, legal compliance. A good app architecture says which
parts are on-chain truth and which are derived operational layers (indexer
and app), consistent with AGENTS.md.
