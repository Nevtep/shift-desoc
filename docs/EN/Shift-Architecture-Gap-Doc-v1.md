# Shift Architecture · Gap & Implementation Guide (v1)

**Status:** Draft  
**Audience:** Shift core devs + GitHub Copilot  
**Purpose:** Summarize what is *decided* vs *still open* so Copilot can implement v1 safely.

This document sits on top of:

- `ARN-Disputes-Architecture.md`
- `Marketplace-Spec-v1.md`
- `HousingManager-Spec-v1.md`

Those three are the **source of truth** for new modules.  
This file only tracks **gaps, decisions, and TODOs**.

---

## 0. Quick Usage Notes (for Copilot)

- Treat the specs above as **canonical** for:
  - `CommerceDisputes`
  - `Marketplace`
  - `HousingManager`
- Anything marked **Decided** here should be encoded directly in code.
- Anything marked **TBD** is:
  - Either *out of v1 scope* → leave as TODO comment, or
  - Needs founder input → do NOT guess a default behavior.

---

## 1. Decided Architecture Outcomes (Session Summary)

These are already agreed and should be reflected in the implementation:

1. **Dispute outcomes (MVP)**
   - Only two outcomes for v1:
     - `REFUND_BUYER`
     - `PAY_SELLER`
   - No partial/split outcomes in v1.

2. **Dispute window**
   - Buyers have **3 days (72h)** after the seller marks an order as fulfilled to open a dispute.
   - Applies to **all OfferKinds**, including Housing.

3. **Dispute origin**
   - Disputes are always opened **through the Marketplace**, for all OfferKinds.
   - CommerceDisputes should **not** be callable directly by arbitrary EOAs.

4. **Governance overrides**
   - v1: **Governance cannot override** dispute resolutions.
   - Outcomes of CommerceDisputes are final for the economic effect.

5. **Seller reputation**
   - Sellers with repeated losses **should** receive reputation penalties *in the future*.
   - v1: Only emit rich events so a future module/analytics system can use them.
   - No on-chain penalty logic in Marketplace v1.

6. **Marketplace – currencies & discount**
   - Offers support **community token + stablecoins**.
   - Paying with **community token grants a discount** (per-offer `communityTokenDiscountBps`).
   - Cohort tagging is **optional per offer**:
     - If `cohortTag != 0` → pay that cohort.
     - If `cohortTag == 0` → pay all applicable cohorts.

7. **Marketplace – escrow & settlement**
   - Marketplace holds **escrow for all orders** (all OfferKinds).
   - Flow:
     - Seller marks order fulfilled.
     - Buyer has 3 days to dispute.
     - After 3 days without dispute, seller can call `settleOrder` to trigger payout via RevenueRouter.

8. **Housing – completion semantics**
   - For housing offers, seller (or housing manager) can mark **completed at checkout**.
   - Buyer then has 3 days to open a dispute (same as generic offers).
   - v1 leaves explicit room for future **buyer-initiated cancellations** with partial refunds.

9. **Housing – pricing & ownership**
   - Pricing per unit:
     - `basePricePerNight * numNights`.
     - Different per unit; managers can update offers for seasonal changes.
   - Ownership:
     - Units are owned by individual members or community.
     - There can be **multiple owners** (fractional investment) via UnitToken.
     - When the UnitToken is **staked**, the community can offer it on the marketplace.

10. **Housing – cancellation policy**
    - Cancellation policy is **global per community**, not per unit:
      - Simple partial refund scheme based on timing.
    - There is a **minimum stay time**, allowed values:
      - 3 days or 1 month (configured per community).
    - Check-in / check-out functions exist and are used.

11. **ModuleProduct interface**
    - Marketplace should use a **generic ModuleProduct interface** so it can:
      - Call `quote` to price any product module.
      - Call `consume` to create resources (reservations, etc.).
      - Optionally call `onOrderSettled` after settlement.

---

## 2. CommerceDisputes – Gaps & TODOs

### 2.1. What’s decided

- There will be a dedicated `CommerceDisputes` contract (not reusing WorkClaims).
- It will:
  - Store disputes for **Marketplace orders (and later other commerce flows)**.
  - Provide an API:
    - `openDispute(communityId, disputeType, relatedId, buyer, seller, amount, evidenceURI)`
    - `finalizeDispute(disputeId, outcome)`
  - Call back into Marketplace via `onDisputeResolved(disputeId, outcome)`.
- MVP outcomes: `REFUND_BUYER`, `PAY_SELLER`.
- Buyers have 3 days after fulfillment to open a dispute (enforced in Marketplace, not CommerceDisputes).

### 2.2. Gaps (GAP-CD-*) and guidance

**GAP-CD-01 – Juror integration with verifier system**

- **Status:** TBD (out of immediate MVP scope).
- **Description:**
  - How CommerceDisputes integrates with VerifierElection / VerifierPowerToken 1155:
    - Panel selection,
    - Voting,
    - Weighting, etc.
- **Impact:** Not needed for first code pass if `finalizeDispute` is admin/test-only.
- **Recommended MVP:**
  - For now, treat `finalizeDispute` as:
    - Restricted to a governance or owner role (or a test-only address).
    - Add clear `TODO` comments indicating it must be wired to the verifier/juror system.

**GAP-CD-02 – Mapping disputes to receivers**

- **Status:** MVP decision needed.
- **Description:**
  - CommerceDisputes may handle disputes from multiple modules in the future.
- **MVP Recommendation:**
  - v1: assume a **single receiver** (Marketplace).
  - Store `marketplace` address and call `onDisputeResolved` on it only.
  - Add mapping per DisputeType later if needed.

**GAP-CD-03 – Dispute type coverage**

- **Status:** Partially decided.
- **Description:**
  - Current types: `MARKETPLACE_ORDER`, `HOUSING_RESERVATION`.
  - For v1, all disputes still arrive via Marketplace as `MARKETPLACE_ORDER`.
- **MVP Recommendation:**
  - Implement `DisputeType` enum but it’s acceptable if only `MARKETPLACE_ORDER` is actively used by the code.
  - Keep `HOUSING_RESERVATION` for future specialized logic.

---

## 3. Marketplace – Gaps & TODOs

### 3.1. What’s decided

- Full spec is in `Marketplace-Spec-v1.md`.
- Key behaviors:
  - Supports community token & stablecoins.
  - Community token discount per offer.
  - Cohort tagging optional.
  - Marketplace holds escrow.
  - Seller marks fulfilled; 3-day dispute window; seller can settle after.
  - All disputes flow through CommerceDisputes.
  - Housing offers use `ModuleProduct` (HousingManager) for availability & reservations.

### 3.2. Gaps (GAP-MKT-*) and guidance

**GAP-MKT-01 – Seller & community ID resolution**

- **Status:** MVP decision in code.
- **Description:**
  - Some helper functions are referenced conceptually:
    - `sellerForOrder(orderId)`
    - `communityIdForOrder(orderId)`
- **MVP Recommendation:**
  - Implement these based on:
    - `Offer.seller` and `Offer.communityId`, with each Order referencing its Offer.

**GAP-MKT-02 – Exact status enum values**

- **Status:** TBD but non-blocking.
- **Description:**
  - Documentation references symbolic statuses: `ESCROWED`, `FULFILLED`, `DISPUTED`, etc.
- **MVP Recommendation:**
  - Define a strongly-typed enum in Solidity (or encoded `uint8` with documented constants).
  - Ensure transitions are:
    - `NONE -> ESCROWED -> FULFILLED -> (DISPUTED | SETTLED)`
    - `DISPUTED -> (REFUNDED | SETTLED)`
    - `ESCROWED -> CANCELLED` (future cancellation).

**GAP-MKT-03 – Community token discount math**

- **Status:** Decided conceptually, not fully specified mathematically.
- **Description:**
  - When paying with community token:
    - Price = `basePrice` adjusted by `communityTokenDiscountBps`.
- **MVP Recommendation:**
  - Implement:
    - `discountedPrice = basePrice * (10_000 - communityTokenDiscountBps) / 10_000`
    - Enforce `communityTokenDiscountBps <= 10_000` (100%).
  - Consider sanity checks in ParamController later.

**GAP-MKT-04 – Stablecoin whitelist**

- **Status:** TBD at ParamController level.
- **Description:**
  - Which stablecoins are allowed per community is not fully specified.
- **MVP Recommendation:**
  - Implement Marketplace to **query ParamController** (or a simple mapping) for:
    - `isAllowedStablecoin(communityId, token)`.
  - If this is not available yet:
    - Temporarily allow a single configured stablecoin address, settable by admin.

**GAP-MKT-05 – Reputation events**

- **Status:** Decided conceptually, not concretely.
- **Description:**
  - Marketplace should emit events rich enough for future reputation modules.
- **MVP Recommendation:**
  - Emit:
    - `event OrderDisputeResolved(orderId, disputeId, DisputeOutcome outcome, address seller, address buyer, uint256 communityId);`
  - Do **not** implement slashing or penalties yet.

---

## 4. HousingManager – Gaps & TODOs

### 4.1. What’s decided

- Full spec is in `HousingManager-Spec-v1.md`.
- Key behaviors:
  - Source of truth for units & reservations.
  - 1:1 mapping between `unitId` and Marketplace offer for HOUSING.
  - Implements `IModuleProduct` for Marketplace.
  - Pricing = `basePricePerNight * numNights`.
  - Ownership via UnitToken; staked units can be listed.
  - Global per-community min stay (3 nights or 30 nights).
  - Global per-community cancellation policy (partial refunds).
  - Check-in/check-out functions exist.

### 4.2. Gaps (GAP-HM-*) and guidance

**GAP-HM-01 – Time representation**

- **Status:** TBD but small.
- **Description:**
  - Whether `startDate`/`endDate` are:
    - Full timestamps (seconds),
    - Or day-granularity (e.g. days since epoch).
- **MVP Recommendation:**
  - Use **unix timestamps (seconds)** to keep it generic.
  - `numNights = (endDate - startDate) / 1 days;`
  - Enforce `endDate > startDate` and that `numNights` times 1 day matches difference exactly to avoid fractional nights.

**GAP-HM-02 – Overlap check details**

- **Status:** Implementation detail.
- **Description:**
  - Overlap logic for reservations.
- **MVP Recommendation:**
  - Classic interval overlap:
    - Two reservations overlap if:
      - `start1 < end2 && start2 < end1`
  - Deny any new reservation that overlaps any `CONFIRMED` or `CHECKED_IN` reservation.

**GAP-HM-03 – Cancellation refund formula**

- **Status:** TBD at policy level.
- **Description:**
  - Exact values for:
    - X days before check-in,
    - Y% refund,
    - etc.
- **MVP Recommendation:**
  - Implement the **mechanism** only:
    - `getCancellationRefundBps(reservationId, cancelTimestamp)` using parameters stored in HousingManager or ParamController.
  - Founder/governance can later specify actual numbers.

**GAP-HM-04 – UnitToken standard and integration**

- **Status:** TBD.
- **Description:**
  - Exact ERC standard used for `unitToken`.
- **MVP Recommendation:**
  - For now:
    - Treat `unitToken` as a generic ERC-721-like contract with `ownerOf`.
    - Add TODOs/comments where fractional ERC-1155 integration is expected.
  - Do not try to encode per-owner revenue shares in HousingManager v1.

---

## 5. TreasuryAdapter – Major Open Area

TreasuryAdapter is still largely **unspecified** compared to Marketplace/HousingManager/Disputes.

### 5.1. Known intentions

- Governance-controlled interface for community treasuries.
- Receives funds from RevenueRouter (treasury share).
- Executes payments approved via Governor + Timelock.
- Future integration point with Gnosis Safe / Zodiac.

### 5.2. Gaps (GAP-TA-*) – Blocking for full implementation

These are **not** decided and need founder decisions before Copilot implements TreasuryAdapter:

- **GAP-TA-01 – Custody model**
  - Are funds held directly in TreasuryAdapter (per community)?
  - Or do we commit to Safe as the canonical treasury and treat TreasuryAdapter as a module?

- **GAP-TA-02 – Spending limits & time windows**
  - Do communities have:
    - Monthly caps,
    - Per-token caps,
    - Category caps (e.g. housing, ops)?

- **GAP-TA-03 – Allowed tokens**
  - Which tokens are allowed to sit in treasury:
    - CommunityToken only?
    - Stablecoins as well?

- **GAP-TA-04 – Emergency controls**
  - Do we need:
    - A pause/guardian,
    - Or is Governor+Timelock enough?

**Recommendation:**

- Do **not** let Copilot implement TreasuryAdapter logic yet beyond a thin placeholder/interface.
- Wait until an ADR is written specifically for TreasuryAdapter (like we did for Disputes).

---

## 6. Identity & Reputation – Out of Scope for v1 Code

### 6.1. Identity

- Current system = wallet + SBTs.
- No final decision on:
  - External identity providers,
  - Proof-of-humanity,
  - Sybil resistance mechanisms.
- **Guidance:**
  - Copilot should not introduce identity assumptions.
  - Reputation should be built from:
    - Existing SBTs,
    - Marketplace/Housing events,
    - Claim history, etc. – but via separate modules later.

### 6.2. Seller / Host Reputation

- For now, treat this as **event-only**:
  - Emit detailed events from Marketplace and HousingManager.
  - A future Reputation module can mint SBTs or update scores based on those events.

---

## 7. Testing & Tooling Gaps

### 7.1. Cross-module integration tests

Still needed (Copilot can scaffold, but test logic requires human design):

- Marketplace ↔ CommerceDisputes:
  - Purchase → dispute → REFUND_BUYER.
  - Purchase → dispute → PAY_SELLER.

- Marketplace ↔ HousingManager:
  - Create unit, create offer.
  - Quote & consume to create reservation.
  - Check-in / check-out and then settle.

- Marketplace ↔ RevenueRouter:
  - Settlement uses correct cohortTag or default multi-cohort distribution.

### 7.2. Property tests

Desirable invariants:

- No order’s escrow gets stuck:
  - Eventually either refunded or settled once disputes are finalized.
- No double-bookings:
  - HousingManager prevents overlapping CONFIRMED/CHECKED_IN reservations.
- Disputes:
  - For each order, there is at most one **active** dispute.

---

## 8. Summary for Copilot

**You CAN safely implement now:**

- `CommerceDisputes` with:
  - Storage, events,
  - Simple access control for `openDispute`,
  - Admin/test-only `finalizeDispute`,
  - Callback to Marketplace.

- `Marketplace` according to `Marketplace-Spec-v1.md`:
  - Escrow, orders, offers,
  - Community token discount,
  - Stablecoin + community token payments,
  - Dispute window and integration with CommerceDisputes,
  - RevenueRouter calls on settlement.

- `HousingManager` according to `HousingManager-Spec-v1.md`:
  - Units, reservations, availability,
  - `quote` and `consume`,
  - Check-in / check-out,
  - Min stay enforcement,
  - Cancellation entitlement math API.

**You SHOULD NOT fully implement yet (beyond stubs):**

- TreasuryAdapter business logic (custody model, spending limits, emergency controls).
- Deep verifier/juror integration inside CommerceDisputes (beyond placeholders).

Leave clear `TODO` comments where gaps are marked **TBD** above.

