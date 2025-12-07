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
        ReservationStatus status;   // Current reservation status
    }

    enum ReservationStatus {
        PENDING,
        CONFIRMED,
        CHECKED_IN,
        CHECKED_OUT,
        CANCELLED
    }
}
```

### Priority and Pricing System

```solidity
// Planned: Dynamic pricing and priority allocation
struct PricingRule {
    uint256 workerSBTDiscount;      // Discount for WorkerSBT holders
    uint256 seniorityMultiplier;    // Pricing based on community seniority
    uint256 demandMultiplier;       // Dynamic pricing based on demand
    uint256 seasonalAdjustment;     // Seasonal pricing adjustments
}

struct PriorityRule {
    uint256 sbtWeight;              // WorkerSBT priority weight
    uint256 tenureWeight;           // Community membership length weight
    uint256 contributionWeight;     // Recent contribution weight
    uint256 needWeight;             // Special needs consideration weight
}
```

## ⚙️ Current Implementation

```solidity
contract HousingManager {
    event UnitListed(uint256 indexed unitId, string name, uint256 basePricePerNight);
    event Reserved(uint256 indexed unitId, uint256 night, address indexed user);

    function listUnit(string calldata name, uint256 basePricePerNight)
        external returns (uint256 unitId) {
        // TODO: alta de unidad + calendario
        unitId = 1;
        emit UnitListed(unitId, name, basePricePerNight);
    }

    function reserve(uint256 unitId, uint256 nightTs) external payable {
        // TODO: reglas de prioridad, descuentos, cobro en stable/token, NFT de reserva
        emit Reserved(unitId, nightTs, msg.sender);
    }
}
```

**Current Functionality**:

- ✅ Basic event emission for unit listing
- ✅ Basic event emission for reservations
- ❌ No actual unit storage or management
- ❌ No pricing logic or payment processing
- ❌ No priority or discount systems
- ❌ No calendar or availability management

## 🛡️ Planned Security Features

### Access Control

- Unit owners can manage their properties
- Community governance can set pricing rules
- Reservation system prevents double-booking
- Emergency admin controls for dispute resolution

### Payment Security

- Escrow system for reservation payments
- Automatic refunds for cancelled reservations
- Community token integration for seamless payments
- Dispute resolution mechanisms

### Privacy Protection

- Selective information sharing for residents
- Opt-in location sharing and contact details
- Reservation history privacy controls

## 🔗 Planned Integration Points

### WorkerSBT Integration

```solidity
// Planned: Worker discounts and priority
interface IWorkerSBT {
    function balanceOf(address owner) external view returns (uint256);
    function getWorkerPoints(address worker) external view returns (uint256);
}

function calculateWorkerDiscount(address resident)
    external view returns (uint256 discountBps) {
    uint256 sbtCount = workerSBT.balanceOf(resident);
    uint256 workerPoints = workerSBT.getWorkerPoints(resident);

    // Calculate discount based on contributions
    return _calculateDiscount(sbtCount, workerPoints);
}
```

### CommunityToken Integration

```solidity
// Planned: Payment processing with community tokens
function processReservationPayment(
    uint256 unitId,
    uint256 nights,
    address resident
) external {
    uint256 totalCost = calculateTotalCost(unitId, nights, resident);

    // Transfer community tokens for payment
    IERC20(communityToken).safeTransferFrom(
        resident,
        address(this),
        totalCost
    );

    // Issue reservation NFT
    _mintReservationNFT(resident, unitId, nights);
}
```

### Revenue Distribution Integration

```solidity
// Planned: Revenue sharing with community treasury
function distributeHousingRevenue(uint256 reservationId) external {
    Reservation memory reservation = reservations[reservationId];

    uint256 unitOwnerShare = (reservation.totalCost * 7000) / 10000; // 70%
    uint256 treasuryShare = (reservation.totalCost * 2000) / 10000;  // 20%
    uint256 maintenanceShare = (reservation.totalCost * 1000) / 10000; // 10%

    // Distribute payments accordingly
}
```

## 📊 Planned Use Case Flows

### 1. Property Onboarding Flow

```
Property Owner → Lists Unit → Community Approval →
Calendar Setup → Pricing Configuration →
Unit Available for Reservations
```

### 2. Reservation Flow

```
Resident Search → Available Units → Priority Check →
Pricing Calculation → Payment Processing →
Reservation Confirmation → NFT Issuance
```

### 3. Check-in/Check-out Flow

```
Reservation Date → Smart Lock Integration →
Check-in Process → Stay Period →
Check-out Process → Review System
```

## 🎛️ Planned Configuration Examples

### Community Co-Housing Setup

```solidity
// Configure community-owned housing units
listUnit("Community House Alpha", 50e18); // 50 tokens per night
setPricingRules(unitId, PricingRule({
    workerSBTDiscount: 2000,      // 20% discount for contributors
    seniorityMultiplier: 500,     // 5% discount per year of membership
    demandMultiplier: 1500,       // Up to 15% surge pricing
    seasonalAdjustment: 1000      // 10% seasonal adjustment
}));
```

### Individual Property Sharing

```solidity
// Individual community members sharing their properties
listUnit("Alice's Guest Room", 30e18); // 30 tokens per night
setPriorityRules(unitId, PriorityRule({
    sbtWeight: 4000,              // 40% priority for WorkerSBT holders
    tenureWeight: 3000,           // 30% priority for long-term members
    contributionWeight: 2000,     // 20% priority for recent contributors
    needWeight: 1000              // 10% priority for special needs
}));
```

## 🚀 Development Roadmap

### Phase 2 Implementation Plan

1. **Core Housing Management**
   - Unit registration and calendar management
   - Availability tracking and booking system
   - Payment processing with community tokens

2. **Priority and Pricing Engine**
   - WorkerSBT-based discount system
   - Dynamic pricing based on demand
   - Fair allocation mechanisms for high-demand periods

3. **NFT Reservation System**
   - ERC1155 reservation tokens (one per night)
   - Transferable reservations for flexibility
   - Integration with community reputation systems

4. **Revenue Distribution**
   - Automatic revenue sharing with property owners
   - Community treasury integration
   - Maintenance fund management

### Technical Integration Requirements

- **Smart Lock Integration**: Physical access control via blockchain
- **Oracle Integration**: External pricing data and demand metrics
- **IPFS Storage**: Unit photos, descriptions, and amenities data
- **Mobile App**: Reservation management and check-in interfaces

## 💡 Innovation Opportunities

### Decentralized Hospitality Model

- Community-owned property networks
- Cross-community reciprocal housing agreements
- Reputation-based travel networks

### Economic Experiments

- Time-banking integration (work hours → housing credits)
- Seasonal worker housing programs
- Co-living experiment coordination

### Sustainability Integration

- Carbon offset programs for housing usage
- Renewable energy incentives for property owners
- Community garden and resource sharing coordination

---

**Note**: The HousingManager stub provides the foundation for a comprehensive community housing coordination system. The minimal current implementation allows the architecture to account for future housing features without blocking current community deployment.

For immediate housing coordination needs, communities can:

1. Use external platforms with community token integration
2. Implement manual coordination through RequestHub discussions
3. Create custom ValuableActions for housing contributions
4. Utilize governance proposals for housing-related decisions

The planned full implementation will create a unique **decentralized hospitality and co-housing ecosystem** that aligns economic incentives with community values and sustainable resource sharing.
