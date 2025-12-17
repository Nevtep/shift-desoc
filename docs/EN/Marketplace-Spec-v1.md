# Marketplace · Module Specification (v1)

**Status:** Draft  
**Scope:** Shift DeSoc Core Marketplace  
**Depends on:** CommunityRegistry, ParamController, RevenueRouter, CohortRegistry, CommerceDisputes, ModuleProduct adapters (e.g. HousingManager)

---

## 1. Purpose

The Marketplace is the **canonical commerce surface** for a community.

It allows members and modules to:

- Create **offers** for services, products, and utilities (including housing stays).
- Accept payments in **community tokens and stablecoins**.
- Hold buyer funds in **escrow** until the order is settled.
- Route net revenue through **Shift’s cohort & revenue system**.
- Handle disputes via a dedicated **CommerceDisputes** module, reusing verifiers.

Marketplace is responsible for **payments, escrow, and integration**.  
Domain-specific logic (availability, reservations, etc.) lives in **ModuleProduct** adapters (e.g. HousingManager).

---

## 2. High-Level Behavior

- Supports multiple **OfferKinds**, including:
  - `GENERIC`: simple services/products with no special adapter.
  - `HOUSING`: stays managed by HousingManager.
  - `FUTURE_*`: any other module that implements the ModuleProduct interface.

- Supports payments in:
  - **Community token**: buyer receives a **discount** (exact policy defined per community).
  - **Stablecoins**: no discount by default.

- Holds **all payments in escrow** until settlement.
- Uses **3-day windows** for disputes:
  - Buyers have **3 days** after seller marks the order done to open a dispute.
  - If no dispute after 3 days, seller can **claim settlement**.
- Delegates all disputes (for any OfferKind) to **CommerceDisputes**.
- Integrates with **RevenueRouter** to pay:
  - Workers / sellers,
  - Investors via cohorts,
  - Treasury.

---

## 3. Core Concepts

### 3.1 Offer

Represents something that can be purchased.

Conceptual fields:

```solidity
enum OfferKind {
    GENERIC,
    HOUSING
    // FUTURE: additional kinds that map to ModuleProduct adapters
}

struct Offer {
    uint256   offerId;
    uint256   communityId;
    address   seller;           // EOA or module owner
    OfferKind kind;
    address   productContract;  // ModuleProduct adapter (e.g. HousingManager) or address(0) for GENERIC
    uint256   productId;        // e.g. unitId for HOUSING, or other module-specific id
    uint256   basePrice;        // nominal price in `pricingCurrency`
    address   pricingCurrency;  // reference currency for basePrice (usually stablecoin)
    bool      acceptCommunityToken; // whether buyer can pay with community token
    bool      acceptStablecoin;     // whether buyer can pay with stablecoin
    uint256   communityTokenDiscountBps; // discount when paying with community token
    address   stablecoin;      // allowed stablecoin, if any
    bool      active;
    uint256   cohortTag;       // 0 = no specific cohort; otherwise cohortId
    string    metadataURI;     // off-chain description
}
```

Notes:

- **1:1 relation between Offer and Housing Unit**:
  - For `OfferKind.HOUSING`, `productId` will typically be the `unitId` in HousingManager.
- `cohortTag`:
  - If `0`: distribute revenue across **all eligible cohorts**.
  - If non-zero: send revenue to that **specific cohort**.

### 3.2 Order

Represents a specific purchase.

```solidity
struct Order {
    uint256 orderId;
    uint256 offerId;
    address buyer;
    address paymentToken;    // community token or stablecoin
    uint256 amount;          // amount taken into escrow
    uint8   status;          // enum-like: NONE, ESCROWED, FULFILLED, DISPUTED, REFUNDED, SETTLED, CANCELLED
    uint256 createdAt;       // block timestamp
    uint256 fulfilledAt;     // when seller marked done (0 if never)
    uint256 reservationId;   // for HOUSING offers (0 otherwise)
    uint256 disputeId;       // CommerceDisputes id (0 if none)
}
```

Invariant:

- When `status == ESCROWED` or `DISPUTED`, the Marketplace holds `amount` in escrow for this order.

### 3.3 ModuleProduct Interface

A **ModuleProduct** adapter is any module that Marketplace can call to:

- Quote final prices,
- Create domain-specific resources (like reservations),
- Run additional business logic.

Conceptual interface:

```solidity
interface IModuleProduct {
    /// @notice Return the final price for this product, given the offer/product and user parameters.
    /// @dev May revert if product is not available (e.g. dates unavailable).
    function quote(
        uint256 productId,
        bytes calldata params,
        uint256 basePrice
    ) external view returns (uint256 finalPrice);

    /// @notice Called by Marketplace after payment escrow to "consume" the product
    ///         (e.g. book a reservation or register a seat).
    /// @dev Should revert if product cannot be created (e.g. race condition on availability).
    function consume(
        uint256 productId,
        address buyer,
        bytes calldata params,
        uint256 amountPaid
    ) external returns (uint256 resourceId);

    /// @notice Optional hook for additional updates / calendar changes etc.
    function onOrderSettled(
        uint256 productId,
        uint256 resourceId,
        uint8   outcome
    ) external;
}
```

For `HOUSING`:

- `params` encodes `startDate`, `endDate`, and potentially guest metadata.
- `resourceId` is the `reservationId` managed by `HousingManager`.
- Pricing is `basePricePerNight * numNights`, with seasonal changes handled by updating `Offer.basePrice` off-chain as needed.

---

## 4. Payments & Currencies

### 4.1 Supported payment tokens

Per offer:

- **Community Token**
  - Allowed if `acceptCommunityToken == true`.
  - If used, apply `communityTokenDiscountBps` to base price.
- **Stablecoin**
  - Allowed if `acceptStablecoin == true`.
  - Price is based on `basePrice` in `stablecoin`.

Community-specific configuration:

- Which stablecoins are allowed must be controlled via **ParamController** and/or **CommunityRegistry**.

### 4.2 Pricing Rules

- **GENERIC offers**:
  - Final price = `basePrice` adjusted for:
    - Chosen payment token,
    - Discount if paying with community token.

- **HOUSING offers**:
  - `basePrice` represents **price per night** (in pricing currency).
  - Final price = `basePrice * numNights`, with:
    - `numNights` = computed from `startDate`, `endDate`.
    - Payment token discount rules as above.
  - **Seasonal pricing**:
    - Handled by manually updating `Offer.basePrice` (or deactivating/recreating offers) off-chain by managers.
    - No on-chain dynamic pricing in v1.

---

## 5. Escrow, Fulfillment & Disputes

### 5.1 Escrow

- Marketplace holds escrow for **all orders**, for all `OfferKind`s.
- Flow:
  1. Buyer initiates purchase with chosen payment token.
  2. Marketplace:
     - Calculates final price.
     - Pulls funds from buyer to Marketplace.
     - For non-GENERIC offers, calls the ModuleProduct’s `consume` to create the underlying resource (e.g. reservation).
  3. Order is created with `status = ESCROWED`.

### 5.2 Seller fulfillment

- Generic flow:
  - Seller calls `markOrderFulfilled(orderId)` when they consider the work/stay completed.
  - For HOUSING:
    - Seller (or HousingManager on checkout) can mark as fulfilled at checkout.
- When marked fulfilled:
  - Marketplace sets `Order.fulfilledAt = block.timestamp`.
  - Order `status = FULFILLED`.

### 5.3 Dispute window

- Buyers have **3 days** (72h) to open a dispute **after fulfillment**:
  - Condition: `block.timestamp <= fulfilledAt + 3 days`.
  - Function: `openOrderDispute(orderId, evidenceURI)`.
- If no dispute is opened within the 3-day window:
  - Seller can call `settleOrder(orderId)` to release funds.

### 5.4 Dispute handling

- The **only way** to open a dispute is via Marketplace:
  - Marketplace calls `CommerceDisputes.openDispute(...)`.
  - Disputes apply to all `OfferKind`s (including HOUSING).
- MVP outcomes:
  - `REFUND_BUYER`:
    - Full refund from escrow to buyer.
  - `PAY_SELLER`:
    - Full settlement via RevenueRouter to seller/cohorts/treasury.
- Marketplace implements `onDisputeResolved` (via `IDisputeReceiver`) to:
  - Refund or settle based on `DisputeOutcome`.
- Governance **cannot override** dispute outcomes in v1.

---

## 6. Housing-Specific Behavior

For `OfferKind.HOUSING`:

- `productContract` will be the `HousingManager` implementing `IModuleProduct`.
- `productId` is the `unitId`.

Flow specifics:

1. Buyer requests a stay:
   - Calls `purchaseHousing(offerId, startDate, endDate, ...)`.
   - Encode `params` with dates, etc.
2. Marketplace calls `quote` on HousingManager:
   - If unit is unavailable → revert.
   - Else → returns final price.
3. Marketplace pulls funds from buyer and escrows.
4. Marketplace calls `consume` on HousingManager:
   - Creates `reservationId` (resourceId).
   - Reservation calendars and min-stay (3 days or 1 month depending on community global config) are enforced in HousingManager.
5. Seller (or housing manager) marks reservation as completed at checkout:
   - Marketplace sets `fulfilledAt` and `status = FULFILLED`.
6. Buyer has **3 days** to dispute, same as other offers.
7. Future upgrade path:
   - Buyer-initiated cancellations (pre-checkin) that result in **partial refunds** and partial payouts.
   - This is **not implemented** in v1 but should be accounted for in design:
     - E.g. additional `OrderStatus.CANCELLED_WITH_REFUND`, etc.

---

## 7. Cohorts & Revenue Routing

- Each order may optionally specify a `cohortTag` (cohortId).
- If `cohortTag != 0`:
  - Marketplace passes this cohortId through to RevenueRouter when settling.
- If `cohortTag == 0`:
  - Marketplace instructs RevenueRouter to:
    - Apply revenue distribution across **all applicable cohorts** for the community based on CohortRegistry rules.
- Marketplace **never** sends funds directly to sellers:
  - Always through `RevenueRouter` to respect:
    - `workersMinBps`,
    - Treasury share,
    - Investor ROI rules.

---

## 8. Reputation Hooks (Sellers)

- Sellers with repeated dispute losses should receive **reputation penalties**.
- v1 behavior:
  - Marketplace emits events with:
    - `seller`, `communityId`, `disputeId`, `outcome`.
  - A future module can:
    - Listen to these events,
    - Derive simple metrics (e.g. % of orders disputed & lost),
    - Optionally mint “strike” SBTs or modify seller privileges.
- No on-chain penalty logic is baked into Marketplace v1 yet, but:
  - Function signatures and events should make it easy to link later.

---

## 9. Config & Parameters

These parameters should be configurable via **ParamController** or governance:

- `DISPUTE_WINDOW_SECONDS`:
  - Default: `3 days`.
- `communityTokenDiscountBps`:
  - Per offer; optionally constrained by community-level min/max.
- Allowed stablecoins per community.
- Whether certain `OfferKinds` are enabled/disabled per community.

---

## 10. Events (MVP)

High-level event set (names can be refined in implementation):

- `OfferCreated(offerId, communityId, seller, kind, productContract, productId)`
- `OfferUpdated(offerId, active, basePrice, pricingCurrency, ...)`
- `OrderCreated(orderId, offerId, buyer, paymentToken, amount)`
- `OrderFulfilled(orderId, fulfilledAt)`
- `OrderDisputeOpened(orderId, disputeId)`
- `OrderDisputeResolved(orderId, disputeId, outcome)`
- `OrderSettled(orderId, amount, paymentToken)`
- `OrderRefunded(orderId, amount, paymentToken)`

These events should support:

- Indexers,
- Off-chain UIs,
- Analytics for dispute rates and revenue.

---

## 11. Open Edges / Future Extensions

(Not required for MVP implementation but should be kept in mind.)

- **Partial refunds** (especially for housing cancellations).
- **Split outcomes** in CommerceDisputes (some % to buyer/seller).
- **Automated reputation system** based on dispute history.
- **Subscription / recurring offers** using ModuleProduct.
- **Off-chain order metadata** for richer UX (e.g. notes, attached files).

---
