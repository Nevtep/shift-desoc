# Commerce & Housing Modules

## 1. Overview

The commerce and housing layer delivers on-chain coordination for products, services, and co-housing experiences inside Shift communities. Marketplace and HousingManager expose user-facing transaction rails, CommerceDisputes enforces trust with escrow-backed adjudication, and ProjectFactory provisions project shells that wire commerce flows to cohorts, valuable actions, and revenue routing. Together they:

- Tokenize listings, bookings, and project campaigns so work verification and governance can reason about them.
- Escrow payments in-community currencies or approved stablecoins, then settle through `RevenueRouter` and (future) `TreasuryAdapter` to respect cohort ROI, treasury allocations, and worker payouts.
- Bridge project lifecycles with economic primitives—projects spin up listings, tap cohorts for capital, and pipe outcomes to ValuableActions and community analytics.
- Provide enforceable resolution mechanisms so housing stays and service orders remain fair, with dispute outcomes feeding back into reputation and payment settlement.

## 2. Components

### 2.1 Marketplace

- **Purpose**: Canonical commerce exchange for goods, services, and module-driven products (including housing stays) scoped per community.
- **Responsibilities**:
  - Register and manage offers with `OfferKind` routing (`GENERIC`, `HOUSING`, future adapters) and payment preferences.
  - Hold buyer funds in escrow, create orders, and coordinate fulfillment hooks (`quote`, `consume`) via ModuleProduct interfaces.
  - Emit events for offer lifecycle, orders, fulfillment, disputes, and settlements to power off-chain UX and analytics.
- **Capabilities**:
  - Supports community token payments (with configurable discounts) and approved stablecoins.
  - Handles immediate buys, module-backed reservations, and integrates with cohorts through `cohortTag` targeting.
  - Enforces listing permissions via community governance (allowed currencies, offer kinds) and ParamController policies.

### 2.2 HousingManager

- **Purpose**: Specialized module managing co-housing inventory, reservations, and lifecycle checkpoints while delegating payment custody to Marketplace.
- **Responsibilities**:
  - Maintain canonical `HousingUnit` records with ownership references, pricing, metadata, and listing status.
  - Implement ModuleProduct `quote` and `consume` to validate availability, enforce minimum stays, and produce reservation records.
  - Track reservation states (confirmed, check-in/out, cancellation) and compute refund entitlements per community policy.
- **Relations**:
  - One-to-one mapping between units and Marketplace housing offers; Marketplace calls back for reservations and completion signals.
  - Supports per-community configuration (min stay, cancellation policy) via ParamController and respects SBT-based access rules where defined.

### 2.3 CommerceDisputes

- **Purpose**: Dedicated dispute resolution contract for Marketplace orders and HousingManager reservations, separated from work verification disputes.
- **Responsibilities**:
  - Allow authorized modules to open disputes with evidence, lock associated orders, and prevent duplicates.
  - Manage state transitions (open → resolved/cancelled) and store immutable reasons, participants, and escrow values.
  - Notify receivers (Marketplace/HousingManager) upon resolution so refunds or settlements execute deterministically.
- **Governance Model**:
  - MVP uses admin/owner resolution with binary outcomes (`REFUND_BUYER`, `PAY_SELLER`), paving the way for verifier- or governance-driven juries.

### 2.4 ProjectFactory

- **Purpose**: Register project instances that bundle metadata, ERC-1155 crowdfunding tokens, and module wiring for community ventures.
- **Responsibilities**:
  - Create project IDs with IPFS descriptors and associated funding tokens, ensuring consistent initialization.
  - Serve as anchor objects for future integrations (milestone tracking, cohort linkage, ValuableAction gating).
- **Context**:
  - Projects can spawn Marketplace listings, allocate housing inventory, or configure cohorts/revenue routes, giving contributors and investors a common reference.

## 3. Data Structures & State

- **Marketplace**:
  - `Offer`: seller, communityId, `OfferKind`, product adapter, productId, base price, accepted currencies, discount bps, cohort tag, metadata.
  - `Order`: orderId, offerId, buyer, payment token, escrowed amount, status flags, timestamps, reservationId (for housing), disputeId.
  - Indexing: by offerId, seller, community, cohort tag, and project references in metadata.
- **HousingManager**:
  - `HousingUnit`: unitId, communityId, ownership token references, pricing currency, listing flags, metadata URI.
  - `Reservation`: reservationId, unitId, guest, start/end dates, quoted amount, status, lifecycle timestamps.
  - Ensures bookings reference valid units and communities, with availability enforced before reservation creation.
- **CommerceDisputes**:
  - `Dispute`: disputeId, communityId, type (order vs reservation), related resource id, buyer/seller, amount, evidence URI, status, outcome, timestamps.
  - Active dispute mapping per resource prevents parallel disputes.
- **ProjectFactory**:
  - `Project`: projectId, creator, IPFS cid, ERC-1155 token, active flag.
  - Mappings by projectId and aggregated views per community enable cross-module lookups.

## 4. Core Flows

### 4.1 Listings, Orders & Fulfillment

- **Listing creation**: authorized sellers (or modules) call Marketplace to register offers, specifying community, product adapter, pricing, accepted tokens, cohort tags, and metadata. Governance-configured guards validate currencies, offer kinds, and listing states.
- **Order placement**: buyers select an offer, Marketplace consults the adapter (`quote`) for final pricing, pulls funds (community token or stablecoin) into escrow, records the order, and for module products invokes `consume` to materialize resources.
- **Fulfillment**: sellers or module hooks call `markOrderFulfilled`; Marketplace timestamps `fulfilledAt` and opens a 72-hour dispute window. Absent disputes, `settleOrder` routes funds to RevenueRouter/TreasuryAdapter respecting community split policies.

### 4.2 Housing Stays Lifecycle

- **Inventory setup**: housing stewards register units, stake ownership tokens, and toggle `listed` once inventory is available and staked.
- **Booking**: buyer triggers Marketplace housing purchase with desired dates; HousingManager `quote` validates availability, min stay, and price, `consume` creates `Reservation` and returns id back to Marketplace.
- **Stay execution**: check-in/check-out functions transition reservation states, enabling automatic or manual order fulfillment. Cancellation rules compute refund bps for future Marketplace upgrades handling partial refunds.
- **Post-stay**: reservation completions can emit events consumed by ValuableAction flows or analytics; check-out typically triggers seller fulfillment and settlement countdown.

### 4.3 Dispute & Resolution Flows

- **Opening**: during dispute window buyers (or hosts in housing) request dispute via Marketplace; Marketplace calls CommerceDisputes with context, locking order/reservation and attaching evidence.
- **Review**: authorized resolver (current admin) assesses evidence; future iterations delegate to verifier juries or governance workflows.
- **Resolution**: CommerceDisputes finalizes with outcome, updates state, and invokes receiver callback. Marketplace refunds escrow to buyer or forwards net amount to RevenueRouter, updating order status accordingly. Housing disputes follow the same callback pattern referencing reservation ids.
- **Appeals/Future**: roadmap includes custom splits, appeals, and auto-resolution for stale disputes.

### 4.4 Project Creation & Lifecycle

- **Creation**: project sponsor supplies IPFS metadata and ERC-1155 token; ProjectFactory assigns id, stores mapping, and emits `ProjectCreated` for indexing.
- **Operational wiring**: project metadata references cohorts, offers, or housing units; scripts or governance proposals link project id to Marketplace listings, HousingManager inventory, and RevenueRouter parameters.
- **Lifecycle**: as milestones complete, ValuableActions and Claims can mint rewards; cohorts receive revenue from project-specific sales via `cohortTag`; disputes, bookings, and orders reference project context through metadata.
- **Closure**: projects can be marked inactive, disabling new listings/bookings and signaling downstream modules to settle outstanding revenue or shut down cohorts.

## 5. Pricing, Fees & Settlement

- **Pricing**:
  - Marketplace base prices defined per offer; housing uses per-night pricing multiplied by stay length.
  - Community governance may enforce min/max price bounds or dynamic discounts through ParamController.
- **Fees**:
  - Community token discount basis points stored on offers; global caps controlled via governance.
  - Protocol or community fees (seller/buyer side) encoded as RevenueRouter splits or ParamController percentages.
  - Housing-specific fees (cleaning, service) modeled as additional line items or adjusted base prices.
- **Settlement**:
  - Escrow resides in Marketplace until dispute window closes; settlement calls RevenueRouter to distribute workers/tresury/investors shares and respect cohort targeting.
  - Refunds reverse escrow to buyers; partial refunds (future) would split between buyer and RevenueRouter outputs.
  - TreasuryAdapter integration will allow governance-approved disbursements from treasury reserves when implemented.

## 6. Security & Invariants

- **Access control**:
  - Listings limited to authorized sellers or module owners; bookings require valid community membership policies; disputes can only be opened by transaction participants via Marketplace; project creation gated to authenticated creators.
- **Funds safety**:
  - Escrow amounts tracked per order; settlements only occur once per order; RevenueRouter handles downstream distributions with reentrancy guards; no direct seller withdrawals.
- **Data integrity**:
  - Orders must reference active offers; reservations must reference listed units; disputes require existing orders/reservations; projects ensure unique ids and immutable metadata links.
- **Griefing resistance**:
  - Governance-configurable rate limits, listing deposits, or membership thresholds reduce spam offers/bookings; duplicate dispute prevention stops repeated locking attempts; cancellation policies guard against last-minute griefing.
- **Economic invariants**:
  - Completed bookings cannot revert to cancellable states; dispute outcomes are final absent defined appeals; cohort-targeted revenue respects ROI ceilings via CohortRegistry deactivation.

## 7. Integration Points

- **Economic/Cohort Engine**:
  - Marketplace settlement passes allocations to RevenueRouter, optionally tagging specific cohorts; Housing revenue participates in the same waterfall; ProjectFactory references cohorts for investor participation.
- **Coordination Layer**:
  - CommunityRegistry stores module addresses; ParamController supplies dispute windows, pricing constraints, min stay policies, and fee parameters that Marketplace and HousingManager enforce.
- **Verification & Reputation Layer**:
  - Completed orders or stays can trigger ValuableActions and SBT issuance; dispute losses emit events used to apply reputation penalties; housing maintenance tasks route through Claims.
- **Governance Core**:
  - Governance adjusts fee schedules, allowed payment tokens, min stay policies, dispute resolver roles, and project templates through timelock-controlled proposals.

## 8. Testing Considerations

- **Marketplace**:
  - Verify offer lifecycle, escrow accounting, currency discounts, cohort tagging, fulfillment timing, and dispute window edge cases.
- **HousingManager**:
  - Test availability checks, min stay enforcement, overlapping reservations, check-in/out flows, cancellation refund calculations, and integration with Marketplace adapters.
- **CommerceDisputes**:
  - Exercise dispute creation, duplicate prevention, resolution callbacks, outcome-based fund movements, and permission boundaries.
- **ProjectFactory**:
  - Validate project creation, metadata integrity, token association, id uniqueness, and activation toggles.
- **Integration**:
  - End-to-end scenarios covering project setup → listing → booking/order → settlement → dispute handling, including failure modes (unauthorized access, invalid dates, missing modules).
- **Fuzz/Property Tests**:
  - Randomized listing/booking sequences across communities, stress tests for reservation calendars, dispute timing fuzzing, and invariant checks on escrow balances and cohort repayments.
