# Marketplace Contract

## 🎯 Purpose & Role

The Marketplace contract is designed to facilitate **decentralized commerce within Shift DeSoc communities**, enabling members to buy and sell goods and services using community tokens while generating revenue for the community treasury through transaction fees.

**⚠️ CURRENT STATUS: STUB IMPLEMENTATION**

This contract is currently a minimal placeholder with basic event emission, planned for full implementation in Phase 2 of the development roadmap.

## 🏗️ Planned Architecture

### Product Management Structure

```solidity
// Planned implementation structure
contract Marketplace {
    struct Product {
        uint256 skuId;               // Unique product identifier
        address seller;              // Product seller
        address tokenContract;       // ERC1155/ERC721 token for product
        uint256 tokenId;            // Specific token ID
        uint256 price;              // Price in community tokens
        uint256 priceStable;        // Alternative price in USDC
        uint256 quantity;           // Available quantity
        string metadataURI;         // Product metadata (IPFS)
        bool acceptsStable;         // Whether USDC payments accepted
        bool active;                // Product availability
        uint256 createdAt;          // Listing timestamp
    }

    struct Purchase {
        uint256 purchaseId;         // Unique purchase identifier
        uint256 skuId;             // Purchased product
        address buyer;             // Purchaser address
        uint256 quantity;          // Quantity purchased
        uint256 totalPaid;         // Total payment amount
        address paymentToken;      // Token used for payment
        uint256 timestamp;         // Purchase timestamp
        PurchaseStatus status;     // Current status
    }

    enum PurchaseStatus {
        PENDING,
        CONFIRMED,
        SHIPPED,
        DELIVERED,
        DISPUTED,
        REFUNDED
    }
}
```

### Revenue and Fee Structure

```solidity
// Planned: Community fee collection and distribution
struct MarketplaceFees {
    uint256 transactionFeeBps;     // Fee percentage in basis points
    uint256 listingFeeBps;         // Fee for listing products
    uint256 disputeFee;            // Fee for dispute resolution
    address treasuryAddress;       // Community treasury recipient
}

struct RevenueDistribution {
    uint256 treasuryShare;         // Percentage to community treasury
    uint256 workerShare;           // Percentage to worker reward pool
    uint256 marketplaceShare;      // Percentage for marketplace operations
}
```

## ⚙️ Current Implementation

```solidity
contract Marketplace {
    event SkuListed(uint256 indexed skuId, address indexed token, uint256 price, bool stable);
    event Purchased(uint256 indexed skuId, address indexed buyer, uint256 qty, bool paidStable);

    function listSku(address token, uint256 price, bool paidInStable)
        external returns (uint256 skuId) {
        // TODO almacenar SKU (ERC1155 o ERC721) + price
        skuId = 1;
        emit SkuListed(skuId, token, price, paidInStable);
    }

    function buy(uint256 skuId, uint256 qty, bool payStable) external {
        // TODO transferencias y recaudación
        emit Purchased(skuId, msg.sender, qty, payStable);
    }
}
```

**Current Functionality**:

- ✅ Basic event emission for product listings
- ✅ Basic event emission for purchases
- ❌ No actual product storage or inventory management
- ❌ No payment processing or token transfers
- ❌ No fee collection or revenue distribution
- ❌ No dispute resolution or escrow systems

## 🛡️ Planned Security Features

### Payment Security

- Escrow system for high-value transactions
- Automatic payment processing with community tokens
- Multi-token support (Community Token + USDC)
- Protection against double-spending and fraud

### Seller Protection

- Reputation system for buyers and sellers
- Dispute resolution through community governance
- Seller verification through WorkerSBT integration
- Protection against chargebacks and false claims

### Quality Control

- Community moderation of product listings
- Reporting system for inappropriate content
- Automated filtering based on community rules
- Integration with community reputation systems

## 🔗 Planned Integration Points

### CommunityToken Integration

```solidity
// Planned: Seamless payment with community tokens
function processPurchase(
    uint256 skuId,
    uint256 quantity,
    bool useStablePayment
) external nonReentrant {
    Product storage product = products[skuId];
    require(product.active && product.quantity >= quantity, "Product unavailable");

    uint256 totalPrice;
    address paymentToken;

    if (useStablePayment && product.acceptsStable) {
        totalPrice = product.priceStable * quantity;
        paymentToken = USDC;
    } else {
        totalPrice = product.price * quantity;
        paymentToken = communityToken;
    }

    // Process payment with fee collection
    uint256 fee = (totalPrice * transactionFeeBps) / 10000;
    uint256 sellerAmount = totalPrice - fee;

    IERC20(paymentToken).safeTransferFrom(msg.sender, product.seller, sellerAmount);
    IERC20(paymentToken).safeTransferFrom(msg.sender, treasury, fee);

    // Update inventory and create purchase record
    product.quantity -= quantity;
    _createPurchaseRecord(skuId, msg.sender, quantity, totalPrice, paymentToken);

    emit PurchaseCompleted(skuId, msg.sender, quantity, totalPrice, paymentToken);
}
```

### WorkerSBT Integration

```solidity
// Planned: Seller verification and reputation
interface IWorkerSBT {
    function balanceOf(address owner) external view returns (uint256);
    function getReputation(address worker) external view returns (uint256);
}

function getSellerTier(address seller) external view returns (uint8) {
    uint256 sbtCount = workerSBT.balanceOf(seller);
    uint256 reputation = workerSBT.getReputation(seller);

    if (sbtCount >= 5 && reputation >= 1000) return 3; // Premium seller
    if (sbtCount >= 2 && reputation >= 500) return 2;  // Verified seller
    if (sbtCount >= 1) return 1;                       // Basic seller
    return 0; // Unverified
}
```

### ERC1155/ERC721 Product Integration

```solidity
// Planned: NFT marketplace functionality
function listNFTProduct(
    address nftContract,
    uint256 tokenId,
    uint256 price,
    bool acceptsStable
) external returns (uint256 skuId) {
    require(IERC721(nftContract).ownerOf(tokenId) == msg.sender, "Not token owner");

    // Transfer NFT to marketplace escrow
    IERC721(nftContract).safeTransferFrom(msg.sender, address(this), tokenId);

    skuId = ++lastSkuId;
    products[skuId] = Product({
        skuId: skuId,
        seller: msg.sender,
        tokenContract: nftContract,
        tokenId: tokenId,
        price: price,
        priceStable: acceptsStable ? _convertToUSDC(price) : 0,
        quantity: 1,
        metadataURI: IERC721Metadata(nftContract).tokenURI(tokenId),
        acceptsStable: acceptsStable,
        active: true,
        createdAt: block.timestamp
    });

    emit NFTListed(skuId, nftContract, tokenId, price);
}
```

## 📊 Planned Use Case Flows

### 1. Digital Product Marketplace Flow

```
Creator → Mint Product NFT → List on Marketplace →
Buyer Discovery → Purchase with Community Tokens →
Automatic Transfer → Revenue Distribution
```

### 2. Physical Goods Commerce Flow

```
Seller → Create Product Listing → Set Shipping Terms →
Buyer Purchase → Escrow Payment → Shipping Confirmation →
Delivery Verification → Payment Release to Seller
```

### 3. Service Marketplace Flow

```
Service Provider → List Service Offering →
Buyer Books Service → Milestone-Based Payments →
Work Completion → Community Review → Final Payment
```

## 🎛️ Planned Configuration Examples

### Community Marketplace Setup

```solidity
// Configure marketplace fees and revenue distribution
setMarketplaceFees(MarketplaceFees({
    transactionFeeBps: 250,        // 2.5% transaction fee
    listingFeeBps: 100,            // 1% listing fee
    disputeFee: 50e18,             // 50 tokens dispute fee
    treasuryAddress: communityTreasury
}));

setRevenueDistribution(RevenueDistribution({
    treasuryShare: 6000,           // 60% to community treasury
    workerShare: 3000,             // 30% to worker reward pool
    marketplaceShare: 1000         // 10% for marketplace operations
}));
```

### Seller Tier Configuration

```solidity
// Configure seller benefits based on WorkerSBT status
setSellerBenefits(1, SellerBenefits({
    maxListings: 10,               // Basic sellers: 10 active listings
    reducedFees: 0,                // No fee reduction
    prioritySupport: false,        // Standard support
    featuredListings: 0            // No featured listings
}));

setSellerBenefits(3, SellerBenefits({
    maxListings: 100,              // Premium sellers: 100 active listings
    reducedFees: 5000,             // 50% fee reduction
    prioritySupport: true,         // Priority customer support
    featuredListings: 5            // 5 featured listings allowed
}));
```

## 🚀 Development Roadmap

### Phase 2 Implementation Plan

1. **Core Marketplace Engine**
   - Product listing and inventory management
   - Multi-token payment processing
   - Fee collection and revenue distribution
   - Basic search and discovery features

2. **Quality and Trust Systems**
   - Seller verification through WorkerSBT integration
   - Buyer/seller reputation and review systems
   - Community moderation and reporting tools
   - Dispute resolution mechanisms

3. **Advanced Commerce Features**
   - Escrow system for high-value transactions
   - Subscription and recurring payment support
   - Auction and bidding functionality
   - Cross-community marketplace federation

4. **Mobile and Web Integration**
   - Marketplace browsing and purchasing UI
   - Seller dashboard for inventory management
   - Mobile-optimized commerce experience
   - Integration with community social features

### Technical Integration Requirements

- **IPFS Integration**: Decentralized storage for product images and metadata
- **Oracle Integration**: Price feeds for USDC conversion and market data
- **Search Engine**: Advanced product discovery and filtering
- **Analytics Engine**: Sales tracking and marketplace insights

## 💡 Innovation Opportunities

### Community-Centric Commerce

- Local community goods and services prioritization
- Community currency circulation incentives
- Collaborative purchasing and group buying features

### Sustainable Commerce Model

- Carbon footprint tracking for shipped products
- Local-first marketplace optimization
- Circular economy and product lifecycle tracking

### Integration with Work Verification

- Products created through verified community work
- Quality assurance through community review processes
- Revenue sharing with communities that contributed to product creation

---

**Note**: The Marketplace stub establishes the foundation for a comprehensive community commerce system. The minimal current implementation allows the architecture to account for future marketplace features without blocking current community deployment.

For immediate commerce needs, communities can:

1. Use external marketplaces with community token integration
2. Coordinate sales through RequestHub discussions
3. Create ValuableActions for commerce-related contributions
4. Implement manual payment processing via governance

The planned full implementation will create a **community-owned commerce ecosystem** that aligns economic incentives with community values, supports local economies, and generates sustainable revenue for community development.
