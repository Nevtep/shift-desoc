# ARN-00X · Disputes Architecture  
_WorkClaims vs CommerceDisputes vs Marketplace_

**Status:** Draft  
**Owner:** Shift DeSoc  
**Date:** YYYY-MM-DD  
**Related Modules:** ClaimManager (WorkClaims), Marketplace, HousingManager, VerifierPowerToken1155, VerifierElection

---

## 1. Context

Shift currently has a **Claims / ClaimManager** flow that is tightly bound to **ValuableActions**:

- Workers perform ValuableActions.
- They submit a **Claim** to prove that action was completed.
- Verifiers review evidence and vote.
- If approved → system mints a **ValuableAction SBT**, updates worker status to **Active Community Member**, and routes any rewards.

This is **work verification**, not commerce.

We now introduce a **Marketplace** (and HousingManager as a specialized product adapter) where:

- Buyers purchase offers (services, goods, housing stays).
- Funds are held in escrow.
- We need a way to handle **disputes** (e.g. “service not delivered”, “room not as described”).

We want:

- To **reuse the verifier ecosystem** (VerifierPowerToken, VerifierElection, evidence model).
- But **not overload** the existing WorkClaims logic, which is conceptually about workers proving ValuableActions to earn SBTs.

---

## 2. Goals / Non-Goals

### Goals

- Keep existing **WorkClaims / ClaimManager** dedicated to ValuableActions:
  - Worker → Claim → verification → SBT + rewards + membership.
- Introduce a **separate CommerceDisputes module** for:
  - Marketplace order disputes.
  - Housing reservation disputes.
  - Future commerce-like flows.
- Reuse the **same verifier infrastructure** for both:
  - VerifierElection, VerifierPowerToken, evidence URIs/hashes, cooldowns, etc.
- Provide a simple, deterministic flow from:
  - Marketplace escrow → dispute outcome → refund or settlement via RevenueRouter.

### Non-Goals (v1)

- No generic cross-domain “unified disputes” contract combining all types.
- No automatic reputation slashing beyond basic hooks (can be added later).
- No partial refund / complex settlement logic in v1 (MVP: full refund or full pay).
- No integration with external courts (Kleros, Aragon, etc.) in this ARN (can be future ADR).

---

## 3. Design Overview

### 3.1. Separation of concerns

We split disputes into **two domains**:

1. **WorkClaims (existing ClaimManager)**
   - Purpose: verify ValuableActions performed by workers.
   - Actor: worker / contributor.
   - Outcome:
     - Mint ValuableAction SBT.
     - Update worker status (Active Community Member).
     - Route rewards (MembershipToken, WorkerSBT, etc.).

2. **CommerceDisputes (new module)**
   - Purpose: resolve disputes for **commerce flows**:
     - Marketplace orders.
     - Housing reservations.
   - Actors: buyer vs seller (or guest vs host).
   - Outcome:
     - Decide what happens with **escrowed funds**.
     - Optionally add reputation signals for sellers.

Both can reuse:

- Verifier election,
- Juror voting,
- Evidence URIs/hashes,
- Community-specific verifier policies.

But they have **separate state machines** and domain semantics.

### 3.2. Relationships

- **Marketplace**
  - Holds escrow for orders.
  - Knows `orderId`, `buyer`, `seller`, `amount`, `communityId`.
  - Integrates with **CommerceDisputes** for refunds / payouts.

- **HousingManager**
  - Tracks housing units and reservations.
  - Exposes reservation IDs and statuses.
  - Calls into Marketplace / CommerceDisputes only when needed (e.g. to open disputes for reservations if we want that flow).

- **CommerceDisputes**
  - Keeps disputes for **commerce actions**.
  - Uses verifiers/jurors to decide on outcomes.
  - Calls back into Marketplace (and potentially other modules) to execute the economic consequence.

- **WorkClaims / ClaimManager**
  - Unchanged semantically:
    - Only handles ValuableAction claims.
    - No direct role in marketplace/housing disputes.

---

## 4. Data Structures & State

### 4.1. CommerceDisputes

Conceptual types:

```solidity
enum DisputeType {
    MARKETPLACE_ORDER,
    HOUSING_RESERVATION
    // FUTURE: OTHER_COMMERCE
}

enum DisputeOutcome {
    NONE,          // Not yet decided
    REFUND_BUYER,  // Return all escrow to buyer
    PAY_SELLER     // Release escrow to seller (via RevenueRouter)
    // FUTURE: SPLIT, CUSTOM
}

enum DisputeStatus {
    OPEN,
    VOTING,
    RESOLVED,
    CANCELLED
}

struct Dispute {
    uint256        disputeId;
    DisputeType    disputeType;
    uint256        relatedId;    // orderId or reservationId
    uint256        communityId;
    address        buyer;
    address        seller;
    uint256        amount;       // amount in escrow under dispute
    string         evidenceURI;  // link to off-chain evidence
    DisputeStatus  status;
    DisputeOutcome outcome;
    // juror selection, voting rounds, timestamps...
}
```

Storage (conceptual):

```solidity
mapping(uint256 => Dispute) public disputes;
uint256 public nextDisputeId;
```

### 4.2. Marketplace (changes)

We extend the marketplace `Order` type:

```solidity
struct Order {
    uint256 orderId;
    uint256 offerId;
    address buyer;
    uint256 amount;
    address currency;
    uint8   status;        // enum-like; ESCROWED, FULFILLED, DISPUTED, SETTLED, REFUNDED, ...
    uint256 reservationId; // for HOUSING offers (0 otherwise)
    uint256 disputeId;     // 0 if no dispute
}
```

---

## 5. APIs / Events

### 5.1. CommerceDisputes

**Opening a dispute** (called by trusted modules, not arbitrary EOAs):

```solidity
function openDispute(
    uint256     communityId,
    DisputeType disputeType,
    uint256     relatedId,    // orderId or reservationId
    address     buyer,
    address     seller,
    uint256     amount,
    string      evidenceURI
) external returns (uint256 disputeId);
```

- **Caller:** Marketplace (for MARKETPLACE_ORDER) or other trusted module (e.g. HousingManager if it ever opens disputes directly).
- Preconditions:
  - Only whitelisted modules can open disputes.
  - `amount` should match escrowed amount in the caller module.
  - Dispute for `(disputeType, relatedId)` must not already be open.

**Finalizing a dispute** (after verifier voting):

```solidity
function finalizeDispute(uint256 disputeId) external;
```

Internally, `finalizeDispute`:

- Calculates `DisputeOutcome` based on juror votes.
- Updates `disputes[disputeId].outcome` and `status = RESOLVED`.
- Emits event.
- Calls back into the dispute origin module (e.g. Marketplace) via an interface:

```solidity
interface IDisputeReceiver {
    function onDisputeResolved(
        uint256 disputeId,
        DisputeOutcome outcome
    ) external;
}
```

**Events:**

- `DisputeOpened(disputeId, disputeType, relatedId, communityId, buyer, seller, amount)`
- `DisputeFinalized(disputeId, outcome)`

Juror selection, voting, and evidence-handling APIs can mirror WorkClaims, but are not fully specified here.

### 5.2. Marketplace (disputes integration)

**Buyer-facing function:**

```solidity
function openOrderDispute(
    uint256 orderId,
    string  evidenceURI
) external;
```

Internal behavior:

1. Validate `msg.sender == order.buyer`.
2. Check order is in a disputable state (e.g. ESCROWED or FULFILLED, not yet disputed).
3. Call `commerceDisputes.openDispute(...)` with:
   - `DisputeType.MARKETPLACE_ORDER`
   - `relatedId = orderId`
   - `communityId`, `buyer`, `seller`, `amount`, `evidenceURI`
4. Store `disputeId` in the order.
5. Mark order status as `DISPUTED`.

**Callback from CommerceDisputes:**

```solidity
function onDisputeResolved(
    uint256           disputeId,
    DisputeOutcome    outcome
) external; // onlyCommerceDisputes
```

Behavior (MVP):

- Look up `orderId` from `disputeId`.
- If `outcome == REFUND_BUYER`:
  - Transfer full escrow back to buyer.
  - Mark order `REFUNDED`.
- If `outcome == PAY_SELLER`:
  - Call `RevenueRouter` with `communityId`, `amount`, seller identity, etc.
  - Mark order `SETTLED`.

Optional future extension: support SPLIT.

---

## 6. Security Analysis

### 6.1. Access control

- **CommerceDisputes.openDispute**:
  - MUST only allow calls from whitelisted modules:
    - Marketplace (for MARKETPLACE_ORDER).
    - (Possibly) HousingManager for HOUSING_RESERVATION, if needed.
- **CommerceDisputes.finalizeDispute**:
  - Should be called by the verifier/juror subsystem or a governance-validated process.
  - Needs protection against:
    - Re-finalizing the same dispute (idempotent guard).
- **Marketplace.onDisputeResolved**:
  - MUST only be callable by CommerceDisputes contract.

### 6.2. Escrow safety

- Escrow funds are held in **Marketplace**, not in CommerceDisputes.
- CommerceDisputes never moves funds directly:
  - It only signals the outcome.
  - Marketplace enforces economic effects (refund or settlement).
- This reduces the attack surface within CommerceDisputes:
  - No reentrancy via token transfers inside finalizeDispute.

### 6.3. Reentrancy

- Token transfers (refunds, RevenueRouter calls) happen in Marketplace.
- Marketplace should:
  - Use reentrancy guards around settlement and refund flows.
  - Update state before external calls when possible.

### 6.4. Economic / griefing risks

- Malicious buyers could open disputes just to delay settlement → needs:
  - Time windows for when disputes can be opened.
  - Possible penalties for clearly abusive disputes (future).
- Malicious verifiers could collude:
  - Existing verifier systems (cooldowns, power, reputation) should apply here, same as WorkClaims.

---

## 7. Gas & Complexity

- CommerceDisputes adds:
  - Storage for disputes.
  - Juror selection and voting similar to WorkClaims (but reused patterns).
- Gas costs are acceptable because:
  - Dispute flows are infrequent relative to normal purchases.
  - Only disputed orders pay the extra gas cost.
- Marketplace changes:
  - Additional storage fields (`disputeId`) per order.
  - One extra external call when opening a dispute.
- Overall complexity:
  - Increased, but modular:
    - WorkClaims: work verification only.
    - CommerceDisputes: commerce disputes only.
    - Marketplace: escrow and routing.

---

## 8. Testing Plan

### 8.1. Unit tests

**CommerceDisputes**

- Can open a dispute via Marketplace-only caller.
- Cannot open with unknown caller.
- Cannot open more than one dispute for `(DisputeType, relatedId)`.
- Juror voting and `finalizeDispute`:
  - Correctly sets outcome based on votes in simplified stub.
  - Prevents re-finalization of the same dispute.

**Marketplace**

- `openOrderDispute`:
  - Only buyer can open.
  - Sets order `DISPUTED` and stores `disputeId`.
- `onDisputeResolved`:
  - Only callable by CommerceDisputes.
  - `REFUND_BUYER` → correct token balance changes and order status.
  - `PAY_SELLER` → correct call into RevenueRouter and order status.

### 8.2. Property / fuzz tests

- For any valid order with escrowed funds:
  - At most one dispute can lead to exactly one of:
    - Full refund to buyer, or
    - Settlement via RevenueRouter.
- No path leaves escrowed funds permanently locked (eventual resolution ensures funds move).

### 8.3. Integration tests

- End-to-end:
  1. Buyer purchases through Marketplace (escrow).
  2. Buyer opens dispute → CommerceDisputes.
  3. Test stub of juror voting finalizes with `REFUND_BUYER`.
  4. Assert buyer receives funds; order status is `REFUNDED`.

- Same with `PAY_SELLER` outcome.

---

## 9. Open Questions / Next Steps

1. **Dispute Outcomes**
   - Is MVP `REFUND_BUYER` / `PAY_SELLER` enough, or do we want `SPLIT` from v1?
2. **Time windows**
   - How long after purchase / completion can a buyer open a dispute?
3. **Role of HousingManager**
   - Should housing disputes always go through Marketplace (recommended), or can HousingManager open disputes directly?
4. **Reputation**
   - Do we want automatic penalties (e.g. strikes) for sellers with repeated losses?
5. **Governance overrides**
   - Should Governor be able to override a dispute outcome in extreme cases?

Next step: implement minimal `CommerceDisputes` with two outcomes and wire it into Marketplace for orders. HousingManager can be wired later using the same pattern.

---

# Copilot Implementation Guide · Disputes & Marketplace

Use this as high-signal context for GitHub Copilot.

## 1. Files & Modules

- [ ] Create new contract: `contracts/disputes/CommerceDisputes.sol`
- [ ] Ensure `Marketplace.sol` is updated to:
  - Track `disputeId` in `Order`.
  - Call `CommerceDisputes.openDispute` from `openOrderDispute`.
  - Implement `IDisputeReceiver.onDisputeResolved`.
- [ ] Do **not** change the semantics of existing **ClaimManager** (WorkClaims). It remains dedicated to ValuableActions.

## 2. CommerceDisputes.sol – Skeleton

Guidance for Copilot:

- Use Solidity `^0.8.x`.
- Add basic access control:
  - Whitelisted caller(s) for `openDispute`.
  - Only owner / governance / verifier system for `finalizeDispute` (stub for now).
- MVP: focus on storing disputes and emitting events. No full verifier logic needed in first iteration (can be stubbed and replaced later).

**Desired structure:**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.XX;

interface IDisputeReceiver {
    function onDisputeResolved(uint256 disputeId, uint8 outcome) external;
}

contract CommerceDisputes {
    enum DisputeType { MARKETPLACE_ORDER, HOUSING_RESERVATION }
    enum DisputeOutcome { NONE, REFUND_BUYER, PAY_SELLER }
    enum DisputeStatus { OPEN, RESOLVED, CANCELLED }

    struct Dispute {
        uint256        disputeId;
        DisputeType    disputeType;
        uint256        relatedId;
        uint256        communityId;
        address        buyer;
        address        seller;
        uint256        amount;
        string         evidenceURI;
        DisputeStatus  status;
        DisputeOutcome outcome;
    }

    uint256 public nextDisputeId;
    mapping(uint256 => Dispute) public disputes;

    // Whitelisted dispute receivers (e.g. Marketplace)
    mapping(address => bool) public isDisputeCaller;
    mapping(address => bool) public isDisputeReceiver; // modules implementing IDisputeReceiver

    event DisputeOpened(uint256 indexed disputeId, DisputeType disputeType, uint256 indexed relatedId, uint256 communityId, address buyer, address seller, uint256 amount);
    event DisputeFinalized(uint256 indexed disputeId, DisputeOutcome outcome);

    // TODO: add governance / owner modifier
    function setDisputeCaller(address caller, bool allowed) external { /* onlyOwner */ }
    function setDisputeReceiver(address receiver, bool allowed) external { /* onlyOwner */ }

    function openDispute(
        uint256     communityId,
        DisputeType disputeType,
        uint256     relatedId,
        address     buyer,
        address     seller,
        uint256     amount,
        string calldata evidenceURI
    ) external returns (uint256 disputeId) {
        require(isDisputeCaller[msg.sender], "Not allowed to open");
        // Optionally check no existing dispute for (disputeType, relatedId)

        disputeId = ++nextDisputeId;

        disputes[disputeId] = Dispute({
            disputeId: disputeId,
            disputeType: disputeType,
            relatedId: relatedId,
            communityId: communityId,
            buyer: buyer,
            seller: seller,
            amount: amount,
            evidenceURI: evidenceURI,
            status: DisputeStatus.OPEN,
            outcome: DisputeOutcome.NONE
        });

        emit DisputeOpened(disputeId, disputeType, relatedId, communityId, buyer, seller, amount);
    }

    function finalizeDispute(uint256 disputeId, DisputeOutcome outcome) external {
        // TODO: restrict to verifier system / governance for MVP
        Dispute storage d = disputes[disputeId];
        require(d.status == DisputeStatus.OPEN, "Already resolved");

        d.status = DisputeStatus.RESOLVED;
        d.outcome = outcome;

        emit DisputeFinalized(disputeId, outcome);

        // Notify the appropriate receiver (e.g. Marketplace)
        // For MVP, we assume a single dispute receiver (Marketplace).
        // In future, we can route based on DisputeType or community.
        for (uint256 i = 0; i < 1; i++) {
            // replaced by direct call to known receiver e.g. marketplace
        }
    }
}
```

> NOTE to Copilot: Replace placeholder loops and comments with real logic, including:
>
> - A way to map disputes to their receiver (e.g. a single Marketplace address, or a mapping by DisputeType).
> - `onlyOwner` / governance modifiers on `setDisputeCaller` and `setDisputeReceiver`.
> - Access control on `finalizeDispute`.

## 3. Marketplace.sol – Dispute Handling

### 3.1. Order struct

Update `Order` struct to include `disputeId`:

```solidity
struct Order {
    uint256 orderId;
    uint256 offerId;
    address buyer;
    uint256 amount;
    address currency;
    uint8   status;
    uint256 reservationId; // 0 for non-housing
    uint256 disputeId;     // 0 if none
}
```

### 3.2. State

- Add reference to CommerceDisputes:

```solidity
CommerceDisputes public commerceDisputes;
```

- Add function to set the CommerceDisputes address (onlyOwner / onlyGovernor).

### 3.3. openOrderDispute

Add a function:

```solidity
function openOrderDispute(
    uint256 orderId,
    string calldata evidenceURI
) external {
    Order storage order = orders[orderId];
    require(order.buyer == msg.sender, "Not buyer");
    require(order.status == STATUS_ESCROWED || order.status == STATUS_FULFILLED, "Not disputable");
    require(order.disputeId == 0, "Already disputed");

    uint256 disputeId = commerceDisputes.openDispute(
        communityIdForOrder(orderId),            // TODO: implement lookup
        CommerceDisputes.DisputeType.MARKETPLACE_ORDER,
        orderId,
        order.buyer,
        sellerForOrder(orderId),                 // TODO: implement lookup
        order.amount,
        evidenceURI
    );

    order.disputeId = disputeId;
    order.status = STATUS_DISPUTED;
}
```

> NOTE to Copilot:
>
> - Use real status enums/consts from Marketplace.
> - Implement `communityIdForOrder` and `sellerForOrder` based on existing data structures.
> - Ensure this function is non-reentrant if it interacts with external contracts.

### 3.4. Implement IDisputeReceiver.onDisputeResolved

Make Marketplace implement `IDisputeReceiver`:

```solidity
function onDisputeResolved(
    uint256 disputeId,
    uint8 outcomeRaw
) external {
    require(msg.sender == address(commerceDisputes), "Not disputes contract");

    CommerceDisputes.DisputeOutcome outcome = CommerceDisputes.DisputeOutcome(outcomeRaw);

    // Find order by disputeId (store mapping disputeId => orderId when opening the dispute)
    uint256 orderId = disputeOrder[disputeId];
    Order storage order = orders[orderId];

    require(order.status == STATUS_DISPUTED, "Order not disputed");

    if (outcome == CommerceDisputes.DisputeOutcome.REFUND_BUYER) {
        // Refund full escrow to buyer
        _refundBuyer(order);
        order.status = STATUS_REFUNDED;
    } else if (outcome == CommerceDisputes.DisputeOutcome.PAY_SELLER) {
        // Release funds to seller via RevenueRouter
        _settleOrderToSeller(order);
        order.status = STATUS_SETTLED;
    } else {
        revert("Invalid outcome");
    }
}
```

> NOTE to Copilot:
>
> - Implement `_refundBuyer` and `_settleOrderToSeller` based on existing payment logic.
> - `_settleOrderToSeller` should use RevenueRouter to respect community revenue splits.
> - Store `mapping(uint256 => uint256) disputeOrder` when opening disputes.

## 4. WorkClaims / ClaimManager

Instructions to Copilot:

- **Do not** change core semantics of WorkClaims / ClaimManager.
- If the term “Claim” is confusing, we can:
  - Only adjust comments and docs to clarify it is **WorkClaim for ValuableActions**.
  - Later, consider renaming internally to `WorkClaims` or `ValuableActionClaims`, but that is a separate migration decision.

## 5. MVP Scope Checklist

For the first version, Copilot should aim for:

- [ ] **CommerceDisputes**:
  - [ ] Stores disputes and exposes `openDispute` and `finalizeDispute`.
  - [ ] Whitelists Marketplace as allowed caller for `openDispute`.
  - [ ] Emits `DisputeOpened` and `DisputeFinalized`.
  - [ ] Calls `onDisputeResolved` on the configured Marketplace.
- [ ] **Marketplace**:
  - [ ] Adds `disputeId` and optional `disputeOrder` mapping.
  - [ ] Implements `openOrderDispute` (buyer → dispute).
  - [ ] Implements `onDisputeResolved` (CommerceDisputes → refund or settlement).
  - [ ] Uses existing escrow and RevenueRouter flows; no duplicated logic.
- [ ] **No changes** to ValuableAction SBT minting or WorkClaims flows.
- [ ] Tests for:
  - [ ] Dispute open → resolved → refund.
  - [ ] Dispute open → resolved → seller paid via RevenueRouter.

After MVP is stable, we can iterate on:

- Juror integration (Verifier stack),
- Fancy outcomes (partial refunds),
- Seller / host reputation impacts,
- Housing-specific dispute flows using the same pattern.
