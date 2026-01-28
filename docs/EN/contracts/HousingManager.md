# HousingManager Contract

## 🎯 Purpose & Role

The HousingManager contract is designed to manage **co-housing reservations and community property sharing** within Shift DeSoc communities. It will enable communities to coordinate shared housing resources, implement fair allocation mechanisms, and generate revenue from property utilization.

**⚠️ CURRENT STATUS: STUB IMPLEMENTATION**

This contract is currently a basic placeholder with minimal functionality, planned for full implementation in Phase 2 of the development roadmap.

## 🏗️ Planned Architecture

### Property Management Structure

```solidity
// Planned implementation structure
contract HousingManager {
    struct HousingUnit {
        uint256 unitId;              // Unique unit identifier
        string name;                 // Unit name/description
        string location;             // Physical location
        uint256 basePricePerNight;   // Base pricing in community tokens
        uint256 maxOccupancy;        // Maximum residents
        bool active;                 // Unit availability
        address[] amenities;         // Available amenities (ERC1155 tokens)
        uint256[] availableDates;    // Calendar availability
    }

    struct Reservation {
        uint256 reservationId;       // Unique reservation ID
        uint256 unitId;             // Reserved unit
        address resident;           // Who made the reservation
        uint256 checkIn;            // Check-in timestamp
        uint256 checkOut;           // Check-out timestamp
        uint256 totalCost;          // Total payment amount
        uint256 workerDiscount;     // Applied discount percentage
        # HousingManager Contract

        ## 🎯 Purpose & Role

        The HousingManager contract manages **co-housing reservations and unit inventory** for communities. It integrates with Marketplace via the IModuleProduct interface to price reservations, create bookings, and respond to settlement outcomes (paid/refunded). It also supports investor staking of stablecoin backing per unit.

        ## 🏗️ Core Architecture

        ### Key Data Structures

        - `Unit`: per-property listing (owner, pricing, capacity, active status, cancellation policy, and staked backing).
        - `Reservation`: booking created via Marketplace with check-in/out dates and status.
        - `unitOccupied[unitId][day]`: day-level occupancy bitmap for double-booking prevention.
        - `investorStakes[unitId][investor]`: stablecoin stake tracking per unit.

        ### Access Control

        - **AccessManager-gated selectors** (via `restricted` and target function roles):
          - `createUnit` (admin role wired in deployment)
          - `consume`, `onOrderSettled` (role `HOUSING_MARKETPLACE_CALLER_ROLE`)
        - **Owner/guest guards**:
          - `updateUnit`: only `unit.owner`
          - `checkIn` / `checkOut`: only `reservation.guest`

        ## ⚙️ Key Functions & Logic

        ### Unit Management

        - `createUnit(...)` (restricted): registers a unit and mints ERC1155 unit token to the owner.
        - `updateUnit(unitId, active, basePrice)`: owner can toggle availability and adjust price.

        ### Pricing & Reservations (IModuleProduct)

        - `quote(productId, params, basePrice)`: calculates price by nights × unit base price (min stay enforced).
        - `consume(productId, buyer, params, amountPaid)` (restricted): validates availability, marks occupancy, and creates reservation.
        - `onOrderSettled(productId, resourceId, outcome)` (restricted): handles refunds by freeing occupancy; paid outcomes remain pending until check-in.

        ### Reservation Lifecycle

        - `checkIn(reservationId)`: guest-only; requires `PENDING` status and check-in date.
        - `checkOut(reservationId)`: guest-only; requires `CHECKED_IN` status.

        ### Investor Staking

        - `stakeForUnit(unitId, amount)`: deposits stablecoin backing.
        - `unstakeFromUnit(unitId, amount)`: withdraws previously staked backing.

        ## 🛡️ Security Features

        - **AccessManager enforcement** for privileged and Marketplace callback functions.
        - **Double-booking protection** via day-level occupancy tracking.
        - **Role separation**: Marketplace callbacks are isolated to `HOUSING_MARKETPLACE_CALLER_ROLE`.
        - **SafeERC20** for all staking transfers.

        ## 🔗 Integration Points

        - **Marketplace**: uses `quote`, `consume`, and `onOrderSettled` callbacks.
        - **AccessManager**: configured via deployment to assign target function roles.
        - **Stablecoin**: staking uses the configured ERC20 (typically USDC).

        ## 📊 Economic Model

        - Pricing is per-night, configured on each unit.
        - Investor stakes increase unit backing; no automatic yield distribution is implemented in this contract.

        ## 🎛️ Configuration Examples

        ### AccessManager Role Wiring

        - `consume` and `onOrderSettled` are wired to `HOUSING_MARKETPLACE_CALLER_ROLE`.
        - Deployment grants `HOUSING_MARKETPLACE_CALLER_ROLE` to Marketplace.

        ### Unit Creation

        - Governance grants admin role → `createUnit(communityId, owner, uri, basePrice, capacity, policyBps)`.

        ## 🚀 Advanced Features (Future)

        - Discounts based on community reputation or SBTs.
        - Automated revenue routing and maintenance splits.
        - Extended cancellation policy schedules.
- Opt-in location sharing and contact details
