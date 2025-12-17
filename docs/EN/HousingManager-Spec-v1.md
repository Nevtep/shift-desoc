# HousingManager · Module Specification (v1)

**Status:** Draft  
**Scope:** Shift DeSoc Co-housing Module  
**Depends on:** CommunityRegistry, ParamController, Marketplace, RevenueRouter, ModuleProduct interface, UnitToken (ownership), CohortRegistry (indirectly)

---

## 1. Purpose

HousingManager is the **co-housing coordination module** for a community.

It is the **source of truth** for:

- Housing units (beds, rooms, houses).
- Ownership (individual, fractional, or community-owned).
- Availability and reservations.
- Check-in / check-out lifecycle.
- Basic cancellation & partial refund rules (in terms of *entitlement*, not tokens).

HousingManager **does not handle payments or escrow**.  
All token transfers are handled by **Marketplace**, which calls HousingManager via the **ModuleProduct** interface to:

- Quote prices for stays,
- Create reservations,
- Consult reservation status/cancellation results to drive refunds/settlements.

Tasks like cleaning, maintenance, etc. are modeled as **ValuableActions** and handled by the existing work verification system, not by HousingManager.

---

## 2. High-Level Behavior

- Manages **units** with:
  - Per-unit pricing (`basePricePerNight`),
  - Global community-level cancellation/min-stay policy.
- Supports **1:1 mapping** between:
  - `unitId` in HousingManager, and
  - `Offer` in Marketplace for `OfferKind.HOUSING`.
- Enforces:
  - No double-bookings (no overlapping confirmed reservations).
  - Minimum stay duration (per community policy).
- Exposes **ModuleProduct** interface:
  - `quote` to compute final rental price.
  - `consume` to create a reservation after payment escrow.
- Provides **check-in / check-out** hooks to track stay lifecycle.
- Supports **partial refunds for cancellations**:
  - Policy is global per community (simple rule).
  - HousingManager computes the *refundable share*; Marketplace applies token-level splits (future extension).

---

## 3. Core Concepts

### 3.1 HousingUnit

A bookable space (bed/room/house) in a community.

Conceptual fields:

```solidity
struct HousingUnit {
    uint256 unitId;
    uint256 communityId;

    // Ownership
    address unitToken;     // ERC-721 or ERC-1155 representing ownership/fractions
    uint256 unitTokenId;   // token id representing this unit's ownership bundle
    bool    staked;        // whether the unit is staked/locked for community use

    // Commercial configuration
    uint256 basePricePerNight; // in pricingCurrency (usually stablecoin)
    address pricingCurrency;   // reference currency for basePricePerNight
    address stablecoin;        // default stablecoin used for pricing
    bool    listed;            // whether it can be booked via Marketplace

    // Metadata
    string  metadataURI;       // off-chain description, location, photos, etc.
}
```

Notes:

- **Ownership**:
  - Units are owned by **individual members** or the **community itself** (via a UnitToken).
  - Fractional ownership is allowed:
    - Multiple owners can own fractions via UnitToken.
    - When the UnitToken is staked, the community can offer the unit on the Marketplace.
  - Revenue sharing between fractional owners is handled downstream (via Cohorts / RevenueRouter + UnitToken logic), not by HousingManager itself.

### 3.2 Reservation

A booking for a unit in a given time range.

```solidity
enum ReservationStatus {
    NONE,
    PENDING,      // created but not yet confirmed (optional)
    CONFIRMED,    // booked, upcoming or active
    CHECKED_IN,   // guest has checked in
    CHECKED_OUT,  // stay finished, waiting for settlement window
    CANCELLED     // cancelled by guest or owner, with partial refund rules
}

struct Reservation {
    uint256 reservationId;
    uint256 unitId;
    uint256 communityId;
    address guest;

    uint64  startDate;     // e.g. unix timestamp or day-based
    uint64  endDate;       // exclusive; must satisfy min stay
    uint256 amountQuoted;  // price HousingManager quoted (for reference)
    ReservationStatus status;

    uint256 createdAt;
    uint256 cancelledAt;
    uint256 checkedInAt;
    uint256 checkedOutAt;
}
```

Notes:

- `amountQuoted` is informational (what HousingManager said the price should be), and can be compared with `amountPaid` in Marketplace for sanity checks.

---

## 4. ModuleProduct Interface Implementation

HousingManager implements the generic ModuleProduct interface used by Marketplace:

```solidity
interface IModuleProduct {
    function quote(
        uint256 productId,
        bytes calldata params,
        uint256 basePrice
    ) external view returns (uint256 finalPrice);

    function consume(
        uint256 productId,
        address buyer,
        bytes calldata params,
        uint256 amountPaid
    ) external returns (uint256 resourceId);

    function onOrderSettled(
        uint256 productId,
        uint256 resourceId,
        uint8   outcome
    ) external;
}
```

### 4.1 Params Encoding for Housing

`productId` = `unitId`

`params` encodes:

- `startDate` (uint64)
- `endDate` (uint64)
- Optionally: guest notes / reference, but pricing decisions should not depend on that.

A recommended ABI-encoding is:

```solidity
struct HousingParams {
    uint64 startDate;
    uint64 endDate;
    // bytes extraData; // optional future extension
}
```

Encoded as `abi.encode(HousingParams)`.

### 4.2 quote

Purpose:

- Compute the **final rental price** for a stay, based on:
  - `unitId`,
  - `startDate`, `endDate`,
  - `basePrice` provided by the Marketplace offer.

Rules:

- **Availability check**:
  - If unit is not `listed` or dates overlap an existing `CONFIRMED` or `CHECKED_IN` reservation → revert.
- **Min stay**:
  - `numNights = endDate - startDate` (in days or derived from timestamps).
  - `numNights` must be >= `minStayNights` for the community.
    - `minStayNights` can be **3 days** or **30 days**, depending on community setup (global per community).
- **Price calculation**:
  - `finalPrice = basePrice * numNights`
    - `basePrice` is typically `basePricePerNight` in the offer.
  - No additional on-chain seasonal/dynamic pricing logic in v1.

### 4.3 consume

Purpose:

- Create a **Reservation** after the Marketplace has successfully escrowed funds.

Behavior:

1. Decode `params` → `(startDate, endDate)`.
2. Re-run availability and min-stay validations (defensive).
3. Optionally verify `amountPaid` is at least `quote(...)`.
4. Create a new `Reservation`:
   - `status = CONFIRMED`.
   - Store `unitId`, `communityId`, `guest = buyer`, dates, and `amountQuoted`.
5. Return `reservationId` as `resourceId` back to Marketplace.

### 4.4 onOrderSettled

Purpose:

- Optional hook so HousingManager can react after Marketplace settles or refunds orders.

A simple v1 behavior:

- For `outcome` values:
  - `OUTCOME_PAID` (seller got paid after no dispute or dispute resolved in their favor):
    - HousingManager might mark internal usage metrics or snapshots for analytics.
  - `OUTCOME_REFUNDED`:
    - HousingManager may mark reservation as effectively void (if not already cancelled).

Exact outcome mapping is flexible and can be defined as:

```solidity
uint8 constant OUTCOME_PAID     = 1;
uint8 constant OUTCOME_REFUNDED = 2;
```

This hook can be a no-op in v1 and extended later.

---

## 5. Ownership & Staking

### 5.1 Unit Ownership

- Each `HousingUnit` references a `unitToken` + `unitTokenId` representing ownership.
- `unitToken` can be:
  - ERC-721 (single owner),
  - ERC-1155 (fractional owners),
  - Or another token standard configured per community.

### 5.2 Staking to enable listing

- To list a unit on the Marketplace:
  - The owner(s) stake the corresponding `unitToken` in the HousingManager (or another staking wrapper).
  - When staked:
    - `unit.staked = true`.
    - `unit.listed` can be set to `true` and Marketplace offers can reference this `unitId`.
- Unstaking should:
  - Require that there are **no active or future reservations**.
  - Typically auto-unlist the unit to avoid new bookings.

Revenue distribution to multiple owners is handled by the combination of:

- CohortRegistry,
- RevenueRouter,
- Any per-unit revenue-sharing logic built around UnitToken.

HousingManager does **not** split money; it just marks units and reservations.

---

## 6. Cancellation & Partial Refund Policy

### 6.1 Global per-community policy

Cancelling stays is governed by **global per-community policy**, not per-unit.

Parameters (configured via ParamController or governance):

- `minStayNights`:
  - Allowed values: e.g. `3` or `30` nights (community chooses).
- `cancellationPolicy`:
  - Simple, global rule for partial refunds, e.g.:
    - If cancelled more than X days before check-in → Y% refundable.
    - If cancelled later → Z% refundable or no refund.

### 6.2 HousingManager’s role

- HousingManager is in charge of computing an abstract **refund fraction** for cancellations, not moving funds.

Example function:

```solidity
function getCancellationRefundBps(
    uint256 reservationId,
    uint64  cancelTimestamp
) public view returns (uint256 refundBps);
```

- Used by Marketplace in a future upgrade where:
  - Buyer cancels pre-checkin.
  - Marketplace:
    - Calculates refundable = `amount * refundBps / 10_000`.
    - Sends refundable share back to buyer.
    - Sends non-refundable share into RevenueRouter as a partial payout.

### 6.3 MVP vs Future

- v1:
  - Implement reservation states and cancellation tracking (`status = CANCELLED`, `cancelledAt`).
  - Implement `getCancellationRefundBps` logic.
  - Actual token-level cancellation flow (splits) may be implemented later in Marketplace using this function.
- Core invariant:
  - HousingManager defines the **rules and math** for partial refund entitlement.
  - Marketplace applies the token math when cancellations are wired in.

---

## 7. Check-in / Check-out

HousingManager tracks the stay lifecycle:

```solidity
function checkIn(uint256 reservationId) external;
function checkOut(uint256 reservationId) external;
```

Rules:

- `checkIn`:
  - Allowed only for `ReservationStatus.CONFIRMED`.
  - Optionally require `block.timestamp >= startDate`.
  - Sets `status = CHECKED_IN`, `checkedInAt = now`.

- `checkOut`:
  - Allowed only for `ReservationStatus.CHECKED_IN`.
  - Optionally require `block.timestamp >= endDate` (or allow early check-out).
  - Sets `status = CHECKED_OUT`, `checkedOutAt = now`.

Marketplace may use `CHECKED_OUT` as a signal to allow sellers to mark the corresponding order as fulfilled or auto-mark it fulfilled via a hook or off-chain process.

---

## 8. Integrations

- **Marketplace**
  - Calls `quote` and `consume` via ModuleProduct interface.
  - Stores `reservationId` returned by `consume`.
  - Uses reservation state and (eventually) cancellation refund logic to manage token flows.

- **CommunityRegistry**
  - Ensures the correct HousingManager instance is used per community.

- **ParamController**
  - Holds:
    - `minStayNights` per community.
    - Global cancellation policy parameters.

- **CommerceDisputes**
  - Handles disputes for housing stays (as Marketplace order disputes).
  - HousingManager only exposes the facts (reservation data); CommerceDisputes and Marketplace decide money outcome.

- **UnitToken (ownership)**
  - Provides underlying representation for ownership and fractions.

---

## 9. Events

Suggested event set:

- `UnitCreated(unitId, communityId, unitToken, unitTokenId)`
- `UnitUpdated(unitId, basePricePerNight, pricingCurrency, stablecoin, listed)`
- `UnitStaked(unitId, owner)`
- `UnitUnstaked(unitId, owner)`

- `ReservationCreated(reservationId, unitId, communityId, guest, startDate, endDate)`
- `ReservationCancelled(reservationId, guestOrOwner, cancelledAt)`
- `ReservationCheckedIn(reservationId, timestamp)`
- `ReservationCheckedOut(reservationId, timestamp)`

These events support:

- Indexers building availability calendars,
- UIs showing reservation history,
- Future analytics on usage and cancellation.

---

## 10. Config & Parameters

Key parameters (per community), likely managed through ParamController:

- `minStayNights` (3 or 30, etc.).
- Cancellation policy parameters:
  - `refundBps_beforeXDays`,
  - `refundBps_afterXDays`,
  - or similar simple scheme.
- Which UnitToken contracts are supported / trusted.

---

## 11. Open Edges / Future Extensions

Not required for initial implementation, but to keep in mind:

- Direct integration of cancellation flows in Marketplace using `getCancellationRefundBps`.
- More complex min-stay rules (per-unit overrides).
- Dynamic pricing (seasonal, weekend, demand-based).
- Per-unit or per-owner cancellation policies layered on top of the global minimum.
- Automatic feeding of reservation revenue into **housing-specific cohorts** for investors.

---
