# CommerceDisputes Contract

## 🎯 Purpose & Role

The **CommerceDisputes** contract provides a dedicated dispute resolution system for commercial transactions within the Shift DeSoc ecosystem, specifically handling disputes from the Marketplace and HousingManager modules. Unlike the Claims contract (which handles work verification), CommerceDisputes focuses on buyer-seller transaction disputes with escrow resolution.

**Key Separation of Concerns:**
- **Claims Contract**: Work verification and ValuableAction completion
- **CommerceDisputes**: Commercial transaction dispute resolution (orders, reservations)

This separation ensures that commercial dispute resolution doesn't interfere with the work verification system and allows for specialized workflows appropriate to each domain.

## 🏗️ Core Architecture

### Data Structures

```solidity
enum DisputeType {
    MARKETPLACE_ORDER,      // Dispute over a marketplace service order
    HOUSING_RESERVATION     // Dispute over housing reservation
}

enum DisputeOutcome {
    NONE,                   // Not yet decided
    REFUND_BUYER,          // Full refund to buyer
    PAY_SELLER             // Full payment to seller
}

enum DisputeStatus {
    OPEN,                   // Awaiting resolution
    RESOLVED,              // Outcome decided and executed
    CANCELLED              // Dispute cancelled (rare)
}

struct Dispute {
    uint256 disputeId;
    uint256 communityId;
    DisputeType disputeType;
    uint256 relatedId;      // orderId or reservationId
    address buyer;
    address seller;
    uint256 amount;         // Escrowed amount
    string evidenceURI;     // IPFS evidence reference
    DisputeOutcome outcome;
    DisputeStatus status;
    uint64 createdAt;
    uint64 resolvedAt;
}
```

### State Management

```solidity
// Dispute storage
mapping(uint256 => Dispute) public disputes;
uint256 public nextDisputeId;

// Access control
address public owner;
mapping(address => bool) public authorizedCallers;  // Modules that can open disputes
address public disputeReceiver;                      // Marketplace or receiver contract

// Prevent duplicate disputes
mapping(DisputeType => mapping(uint256 => uint256)) public activeDisputeFor;
```

## ⚙️ Key Functions & Logic

### Opening Disputes

```solidity
function openDispute(
    uint256 communityId,
    DisputeType disputeType,
    uint256 relatedId,
    address buyer,
    address seller,
    uint256 amount,
    string calldata evidenceURI
) external onlyAuthorized returns (uint256 disputeId)
```

**Process:**
1. Verify caller is authorized module (Marketplace, HousingManager)
2. Check no duplicate dispute exists for this resource
3. Create new dispute with OPEN status
4. Track as active dispute for the resource
5. Emit `DisputeOpened` event

**Example Usage (Marketplace):**
```solidity
// Buyer opens dispute on order
uint256 disputeId = commerceDisputes.openDispute(
    communityId,
    DisputeType.MARKETPLACE_ORDER,
    orderId,
    buyer,
    seller,
    orderAmount,
    evidenceIPFSHash
);
```

### Resolving Disputes

```solidity
function finalizeDispute(
    uint256 disputeId,
    DisputeOutcome outcome
) external onlyOwner
```

**MVP Implementation:**
- Admin-only resolution (owner decides outcome)
- Binary outcomes: REFUND_BUYER or PAY_SELLER
- Callbacks to receiver contract to execute economic decision

**Future Enhancement:**
Integration with VerifierManager for juror-based dispute resolution:
```solidity
// FUTURE: Verifier-based resolution
function submitDisputeVote(uint256 disputeId, DisputeOutcome vote) external onlyVerifier
function tallyDisputeVotes(uint256 disputeId) internal returns (DisputeOutcome)
```

### Dispute Callbacks

The contract uses the `IDisputeReceiver` interface to notify modules of resolution:

```solidity
interface IDisputeReceiver {
    function onDisputeResolved(uint256 disputeId, uint8 outcome) external;
}
```

**Workflow:**
1. CommerceDisputes resolves dispute with outcome
2. Calls `disputeReceiver.onDisputeResolved(disputeId, outcome)`
3. Receiver (Marketplace) executes economic action:
   - `REFUND_BUYER`: Return escrowed funds to buyer
   - `PAY_SELLER`: Release payment to seller via RevenueRouter

## 🛡️ Security Features

### Access Control

```solidity
modifier onlyOwner() {
    if (msg.sender != owner) revert UnauthorizedCaller();
    _;
}

modifier onlyAuthorized() {
    if (!authorizedCallers[msg.sender]) revert UnauthorizedCaller();
    _;
}
```

**Three-Tier Security Model:**
1. **Owner**: Can finalize disputes, manage authorized callers, set receiver
2. **Authorized Callers**: Modules (Marketplace, HousingManager) can open disputes
3. **Receiver Contract**: Executes economic outcomes via callback

### Duplicate Prevention

```solidity
// Prevents multiple disputes for same resource
uint256 existing = activeDisputeFor[disputeType][relatedId];
if (existing != 0 && disputes[existing].status == DisputeStatus.OPEN) {
    revert DisputeAlreadyExists(existing);
}
```

**Rationale:** Only one active dispute per order/reservation at a time to prevent confusion and double-processing.

### Evidence Immutability

- Evidence URI stored on-chain (IPFS hash)
- Cannot be modified after dispute creation
- Ensures transparent resolution based on original evidence

## 🔗 Integration Points

### Marketplace Integration

```solidity
contract Marketplace is IDisputeReceiver {
    CommerceDisputes public disputes;
    
    // Open dispute when buyer complains
    function openOrderDispute(uint256 orderId, string calldata evidenceURI) external {
        Order memory order = orders[orderId];
        require(msg.sender == order.buyer, "Only buyer can dispute");
        
        disputes.openDispute(
            order.communityId,
            DisputeType.MARKETPLACE_ORDER,
            orderId,
            order.buyer,
            order.seller,
            order.price,
            evidenceURI
        );
    }
    
    // Callback from CommerceDisputes
    function onDisputeResolved(uint256 disputeId, uint8 outcome) external override {
        require(msg.sender == address(disputes), "Only disputes contract");
        
        Dispute memory dispute = disputes.getDispute(disputeId);
        Order storage order = orders[dispute.relatedId];
        
        if (outcome == 1) { // REFUND_BUYER
            // Return escrowed funds to buyer
            communityToken.transfer(dispute.buyer, dispute.amount);
        } else if (outcome == 2) { // PAY_SELLER
            // Release payment to seller via RevenueRouter
            revenueRouter.distributeSaleRevenue(dispute.amount, dispute.seller);
        }
        
        order.status = OrderStatus.DISPUTED_RESOLVED;
    }
}
```

### HousingManager Integration

```solidity
contract HousingManager is IDisputeReceiver {
    // Similar pattern for housing reservation disputes
    function openReservationDispute(uint256 reservationId, string calldata evidenceURI) external {
        // Open dispute for housing reservation
    }
    
    function onDisputeResolved(uint256 disputeId, uint8 outcome) external override {
        // Handle housing dispute resolution
    }
}
```

## 📊 Economic Model

### Escrow Flow

```
Buyer Purchase → Escrow Held → Dispute Opened
                                    ↓
                          Admin Resolution Decision
                                    ↓
                    ┌───────────────┴───────────────┐
                    ↓                               ↓
              REFUND_BUYER                    PAY_SELLER
                    ↓                               ↓
          Funds → Buyer                   Funds → RevenueRouter
                                                    ↓
                                          Distributed per revenueSplit
```

**Security Note:** Funds remain in escrow (held by Marketplace/HousingManager) until dispute resolution, preventing fraudulent withdrawal during dispute period.

## 🎛️ Configuration Examples

### Initial Setup

```typescript
// Deploy CommerceDisputes
const disputes = await CommerceDisputes.deploy(governanceAddress);

// Authorize Marketplace to open disputes
await disputes.setAuthorizedCaller(marketplaceAddress, true);
await disputes.setAuthorizedCaller(housingManagerAddress, true);

// Set Marketplace as dispute receiver
await disputes.setDisputeReceiver(marketplaceAddress);
```

### Dispute Resolution Workflow

```typescript
// 1. Buyer opens dispute through Marketplace UI
await marketplace.openOrderDispute(orderId, evidenceIPFSHash);

// 2. Admin reviews evidence off-chain
const dispute = await disputes.getDispute(disputeId);
const evidence = await ipfs.cat(dispute.evidenceURI);

// 3. Admin decides outcome
if (evidenceSupportsRefund) {
    await disputes.finalizeDispute(disputeId, DisputeOutcome.REFUND_BUYER);
} else {
    await disputes.finalizeDispute(disputeId, DisputeOutcome.PAY_SELLER);
}

// 4. Marketplace automatically executes outcome via callback
```

## 🚀 Advanced Features

### Future Enhancements (Post-MVP)

#### Verifier-Based Resolution

```solidity
// FUTURE: Democratic dispute resolution
struct DisputeVoting {
    mapping(address => DisputeOutcome) votes;
    uint256 refundVotes;
    uint256 paySellerVotes;
    uint64 votingDeadline;
}

function submitDisputeVote(uint256 disputeId, DisputeOutcome vote) external onlyVerifier {
    // Verifiers vote on outcome
    // Integration with VerifierManager for M-of-N resolution
}
```

#### Partial Outcomes

```solidity
enum DisputeOutcome {
    NONE,
    REFUND_BUYER,
    PAY_SELLER,
    SPLIT_50_50,           // 50% refund, 50% to seller
    SPLIT_CUSTOM           // Custom percentage split
}

struct CustomSplit {
    uint256 buyerPercentage;  // Basis points
    uint256 sellerPercentage; // Basis points
}
```

#### Appeal Mechanism

```solidity
function appealDispute(uint256 disputeId, string calldata appealEvidenceURI) external payable {
    // Appeal to higher authority (governance)
    // Requires appeal fee (prevents spam)
}
```

#### Time-Based Auto-Resolution

```solidity
function autoResolveExpiredDispute(uint256 disputeId) external {
    // If seller doesn't respond within X days, auto-refund buyer
    // Prevents indefinite escrow lockup
}
```

## 🔍 Business Value

### For Buyers

- **Protection**: Escrow ensures funds aren't released until service delivered
- **Fair Resolution**: Independent dispute process for unsatisfactory transactions
- **Evidence-Based**: IPFS evidence ensures transparent decision-making

### For Sellers

- **Payment Guarantee**: Legitimate service delivery ensures payment release
- **Reputation Protection**: False disputes can be defended with evidence
- **Quick Resolution**: Clear dispute process prevents payment delays

### For Communities

- **Trust Infrastructure**: Enables commerce without centralized intermediaries
- **Economic Security**: Protects community treasury from fraud
- **Governance Integration**: Future verifier-based resolution aligns with DAO values

### Competitive Advantages

**vs Traditional Escrow Services:**
- Decentralized (no middleman fees)
- Transparent evidence trail
- Community governance integration
- Programmable outcomes

**vs Other Web3 Marketplaces:**
- Integrated with work verification system
- Community-specific dispute handling
- Flexible outcome options (future)
- Democratic resolution path (future)

## 📝 Summary

CommerceDisputes provides **essential infrastructure for trusted commerce** within Shift DeSoc communities. By separating commercial disputes from work verification, the system maintains clarity while enabling future enhancements like verifier-based resolution, partial outcomes, and governance appeals.

**Current Status:** MVP with admin resolution
**Next Phase:** Verifier integration for democratic dispute resolution
**Long-term Vision:** Fully autonomous dispute resolution with AI-assisted evidence review and governance oversight

This contract demonstrates how **blockchain technology enables trustless commerce** by replacing centralized escrow services with transparent, programmable dispute resolution mechanisms that align with community values.
