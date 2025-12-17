// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IModuleProduct} from "./interfaces/IModuleProduct.sol";
import {IDisputeReceiver} from "./interfaces/IDisputeReceiver.sol";
import {CommerceDisputes} from "./CommerceDisputes.sol";
import {RevenueRouter} from "./RevenueRouter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Errors} from "../libs/Errors.sol";

/**
 * @title Marketplace
 * @notice Canonical commerce surface for community transactions
 * @dev Handles offers, orders, escrow, and settlement for all commerce types
 *
 * Key Features:
 * - Multi-offer types (GENERIC, HOUSING) via ModuleProduct adapters
 * - Community token + stablecoin payments with configurable discounts
 * - Escrow-based order fulfillment with 3-day dispute window
 * - Integration with CommerceDisputes for buyer protection
 * - Revenue routing through cohort system via RevenueRouter
 *
 * Architecture:
 * - Marketplace holds all escrow (no funds in modules)
 * - ModuleProduct adapters (e.g. HousingManager) handle domain logic
 * - CommerceDisputes handles all dispute resolution
 * - RevenueRouter distributes settlement proceeds
 */
contract Marketplace is IDisputeReceiver, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    uint256 public constant DISPUTE_WINDOW = 3 days;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    // Settlement outcomes for ModuleProduct callbacks
    uint8 public constant OUTCOME_PAID = 1;
    uint8 public constant OUTCOME_REFUNDED = 2;

    // ============ Types ============

    enum OfferKind {
        GENERIC, // Simple services/products
        HOUSING // Housing stays via HousingManager
            // FUTURE: Add more offer kinds as needed
    }

    enum OrderStatus {
        NONE,
        ESCROWED, // Payment held, awaiting fulfillment
        FULFILLED, // Seller marked done, dispute window active
        DISPUTED, // Buyer opened dispute
        SETTLED, // Funds released to seller via RevenueRouter
        REFUNDED, // Funds returned to buyer
        CANCELLED // Order cancelled (future: pre-fulfillment cancellation)
    }

    struct Offer {
        uint256 offerId;
        uint256 communityId;
        address seller;
        OfferKind kind;
        address productContract; // ModuleProduct adapter (0 for GENERIC)
        uint256 productId; // Module-specific ID (e.g. unitId for HOUSING)
        uint256 basePrice; // Nominal price in pricingCurrency
        address pricingCurrency; // Reference currency (usually stablecoin)
        bool acceptCommunityToken; // Allow payment with community token
        bool acceptStablecoin; // Allow payment with stablecoin
        uint256 communityTokenDiscountBps; // Discount when paying with community token
        address stablecoin; // Allowed stablecoin if acceptStablecoin=true
        bool active; // Whether offer can be purchased
        uint256 cohortTag; // 0 = distribute to all cohorts, else specific cohortId
        string metadataURI; // Off-chain description, terms, etc.
    }

    struct Order {
        uint256 orderId;
        uint256 offerId;
        address buyer;
        address paymentToken; // community token or stablecoin
        uint256 amount; // Amount in escrow
        OrderStatus status;
        uint64 createdAt;
        uint64 fulfilledAt; // When seller marked done (0 if never)
        uint256 resourceId; // Module-specific resource (e.g. reservationId for HOUSING)
        uint256 disputeId; // CommerceDisputes ID (0 if none)
    }

    // ============ State ============

    mapping(uint256 => Offer) public offers;
    uint256 public nextOfferId = 1;

    mapping(uint256 => Order) public orders;
    uint256 public nextOrderId = 1;

    // Dispute tracking
    mapping(uint256 => uint256) public disputeToOrder; // disputeId => orderId

    // Module references
    CommerceDisputes public commerceDisputes;
    RevenueRouter public revenueRouter;
    mapping(uint256 => address) public communityTokens; // communityId => token address

    // Access control
    address public owner;
    mapping(uint256 => bool) public communityActive; // communityId => active

    // ============ Events ============

    event OfferCreated(
        uint256 indexed offerId,
        uint256 indexed communityId,
        address indexed seller,
        OfferKind kind,
        address productContract,
        uint256 productId
    );

    event OfferUpdated(uint256 indexed offerId, bool active, uint256 basePrice);

    event OrderCreated(
        uint256 indexed orderId, uint256 indexed offerId, address indexed buyer, address paymentToken, uint256 amount
    );

    event OrderFulfilled(uint256 indexed orderId, uint64 fulfilledAt);

    event OrderDisputeOpened(uint256 indexed orderId, uint256 indexed disputeId);

    event OrderDisputeResolved(
        uint256 indexed orderId,
        uint256 indexed disputeId,
        uint8 outcome,
        address seller,
        address buyer,
        uint256 communityId
    );

    event OrderSettled(uint256 indexed orderId, uint256 amount, address paymentToken);

    event OrderRefunded(uint256 indexed orderId, uint256 amount, address paymentToken);

    // ============ Errors ============

    error OfferNotFound(uint256 offerId);
    error OfferNotActive(uint256 offerId);
    error OrderNotFound(uint256 orderId);
    error InvalidStatus(OrderStatus current, OrderStatus required);
    error PaymentTokenNotAccepted(address token);
    error DisputeWindowClosed();
    error DisputeWindowActive();
    error OnlyBuyer();
    error OnlySeller();
    error InvalidDiscount();
    error CommunityNotActive(uint256 communityId);

    // ============ Modifiers ============

    modifier onlyOwner() {
        if (msg.sender != owner) revert Errors.UnauthorizedCaller(msg.sender);
        _;
    }

    modifier offerExists(uint256 offerId) {
        if (offers[offerId].offerId == 0) revert OfferNotFound(offerId);
        _;
    }

    modifier orderExists(uint256 orderId) {
        if (orders[orderId].orderId == 0) revert OrderNotFound(orderId);
        _;
    }

    // ============ Constructor ============

    constructor(address _owner, address _commerceDisputes, address _revenueRouter) {
        owner = _owner;
        commerceDisputes = CommerceDisputes(_commerceDisputes);
        revenueRouter = RevenueRouter(_revenueRouter);
    }

    // ============ Admin Functions ============

    function setCommunityActive(uint256 communityId, bool active) external onlyOwner {
        communityActive[communityId] = active;
    }

    function setCommunityToken(uint256 communityId, address token) external onlyOwner {
        communityTokens[communityId] = token;
    }

    function setCommerceDisputes(address _commerceDisputes) external onlyOwner {
        commerceDisputes = CommerceDisputes(_commerceDisputes);
    }

    function setRevenueRouter(address _revenueRouter) external onlyOwner {
        revenueRouter = RevenueRouter(_revenueRouter);
    }

    // ============ Offer Management ============

    /**
     * @notice Create a new marketplace offer
     * @dev Seller must approve Marketplace to manage productContract resources if applicable
     */
    function createOffer(
        uint256 communityId,
        OfferKind kind,
        address productContract,
        uint256 productId,
        uint256 basePrice,
        address pricingCurrency,
        bool acceptCommunityToken,
        bool acceptStablecoin,
        uint256 communityTokenDiscountBps,
        address stablecoin,
        uint256 cohortTag,
        string calldata metadataURI
    ) external returns (uint256 offerId) {
        if (!communityActive[communityId]) revert CommunityNotActive(communityId);
        if (communityTokenDiscountBps > BPS_DENOMINATOR) revert InvalidDiscount();

        offerId = nextOfferId++;

        offers[offerId] = Offer({
            offerId: offerId,
            communityId: communityId,
            seller: msg.sender,
            kind: kind,
            productContract: productContract,
            productId: productId,
            basePrice: basePrice,
            pricingCurrency: pricingCurrency,
            acceptCommunityToken: acceptCommunityToken,
            acceptStablecoin: acceptStablecoin,
            communityTokenDiscountBps: communityTokenDiscountBps,
            stablecoin: stablecoin,
            active: true,
            cohortTag: cohortTag,
            metadataURI: metadataURI
        });

        emit OfferCreated(offerId, communityId, msg.sender, kind, productContract, productId);
    }

    /**
     * @notice Update offer status and pricing
     * @dev Only seller can modify their offers
     */
    function updateOffer(uint256 offerId, bool active, uint256 basePrice) external offerExists(offerId) {
        Offer storage offer = offers[offerId];
        if (msg.sender != offer.seller) revert OnlySeller();

        offer.active = active;
        if (basePrice > 0) {
            offer.basePrice = basePrice;
        }

        emit OfferUpdated(offerId, active, basePrice);
    }

    // ============ Purchase & Escrow ============

    /**
     * @notice Purchase an offer (GENERIC or HOUSING)
     * @param offerId The offer to purchase
     * @param paymentToken Token to pay with (community token or stablecoin)
     * @param params Module-specific parameters (e.g. dates for HOUSING)
     * @return orderId The created order ID
     */
    function purchase(uint256 offerId, address paymentToken, bytes calldata params)
        external
        nonReentrant
        offerExists(offerId)
        returns (uint256 orderId)
    {
        Offer storage offer = offers[offerId];
        if (!offer.active) revert OfferNotActive(offerId);

        // Validate payment token and calculate final price
        uint256 finalPrice = _calculatePrice(offer, paymentToken, params);

        // Pull payment into escrow
        IERC20(paymentToken).safeTransferFrom(msg.sender, address(this), finalPrice);

        // For non-GENERIC offers, call ModuleProduct to create resource
        uint256 resourceId = 0;
        if (offer.kind != OfferKind.GENERIC && offer.productContract != address(0)) {
            resourceId = IModuleProduct(offer.productContract).consume(offer.productId, msg.sender, params, finalPrice);
        }

        // Create order
        orderId = nextOrderId++;
        orders[orderId] = Order({
            orderId: orderId,
            offerId: offerId,
            buyer: msg.sender,
            paymentToken: paymentToken,
            amount: finalPrice,
            status: OrderStatus.ESCROWED,
            createdAt: uint64(block.timestamp),
            fulfilledAt: 0,
            resourceId: resourceId,
            disputeId: 0
        });

        emit OrderCreated(orderId, offerId, msg.sender, paymentToken, finalPrice);
    }

    /**
     * @notice Calculate final price considering discounts and module pricing
     */
    function _calculatePrice(Offer storage offer, address paymentToken, bytes calldata params)
        internal
        view
        returns (uint256 finalPrice)
    {
        // Validate payment token is accepted
        bool isCommunityToken = paymentToken == communityTokens[offer.communityId];
        bool isStablecoin = paymentToken == offer.stablecoin;

        if (isCommunityToken && !offer.acceptCommunityToken) {
            revert PaymentTokenNotAccepted(paymentToken);
        }
        if (isStablecoin && !offer.acceptStablecoin) {
            revert PaymentTokenNotAccepted(paymentToken);
        }
        if (!isCommunityToken && !isStablecoin) {
            revert PaymentTokenNotAccepted(paymentToken);
        }

        // Get base price from module or use offer.basePrice
        uint256 basePrice = offer.basePrice;
        if (offer.productContract != address(0)) {
            basePrice = IModuleProduct(offer.productContract).quote(offer.productId, params, offer.basePrice);
        }

        // Apply community token discount if applicable
        if (isCommunityToken && offer.communityTokenDiscountBps > 0) {
            finalPrice = (basePrice * (BPS_DENOMINATOR - offer.communityTokenDiscountBps)) / BPS_DENOMINATOR;
        } else {
            finalPrice = basePrice;
        }
    }

    // ============ Order Fulfillment ============

    /**
     * @notice Seller marks order as fulfilled
     * @dev Starts 3-day dispute window for buyer
     */
    function markOrderFulfilled(uint256 orderId) external orderExists(orderId) {
        Order storage order = orders[orderId];
        Offer storage offer = offers[order.offerId];

        if (msg.sender != offer.seller) revert OnlySeller();
        if (order.status != OrderStatus.ESCROWED) {
            revert InvalidStatus(order.status, OrderStatus.ESCROWED);
        }

        order.status = OrderStatus.FULFILLED;
        order.fulfilledAt = uint64(block.timestamp);

        emit OrderFulfilled(orderId, order.fulfilledAt);
    }

    /**
     * @notice Settle order after dispute window expires
     * @dev Sends funds to seller via RevenueRouter
     */
    function settleOrder(uint256 orderId) external nonReentrant orderExists(orderId) {
        Order storage order = orders[orderId];
        Offer storage offer = offers[order.offerId];

        if (msg.sender != offer.seller) revert OnlySeller();
        if (order.status != OrderStatus.FULFILLED) {
            revert InvalidStatus(order.status, OrderStatus.FULFILLED);
        }

        // Ensure dispute window has passed
        if (block.timestamp < order.fulfilledAt + DISPUTE_WINDOW) {
            revert DisputeWindowActive();
        }

        order.status = OrderStatus.SETTLED;

        // Route settlement through RevenueRouter
        _settleToSeller(order, offer);

        emit OrderSettled(orderId, order.amount, order.paymentToken);
    }

    /**
     * @notice Internal settlement logic via RevenueRouter
     */
    function _settleToSeller(Order storage order, Offer storage offer) internal {
        // Route settlement through RevenueRouter for cohort distribution
        if (address(revenueRouter) != address(0)) {
            // Approve RevenueRouter to pull funds
            IERC20(order.paymentToken).forceApprove(address(revenueRouter), order.amount);
            
            // Route revenue through cohort system
            // Note: RevenueRouter will distribute according to community policy:
            // - Workers minimum guarantee
            // - Treasury base allocation
            // - Investor cohorts based on unrecovered amounts
            // - Spillover handling
            revenueRouter.routeRevenue(offer.communityId, order.paymentToken, order.amount);
        } else {
            // Fallback: direct transfer to seller (for testing/MVP without RevenueRouter)
            IERC20(order.paymentToken).safeTransfer(offer.seller, order.amount);
        }

        // Notify product module of settlement
        if (offer.productContract != address(0)) {
            IModuleProduct(offer.productContract).onOrderSettled(offer.productId, order.resourceId, OUTCOME_PAID);
        }
    }

    // ============ Dispute Handling ============

    /**
     * @notice Buyer opens a dispute within 3-day window
     * @dev Can only dispute once per order
     */
    function openOrderDispute(uint256 orderId, string calldata evidenceURI)
        external
        nonReentrant
        orderExists(orderId)
    {
        Order storage order = orders[orderId];
        Offer storage offer = offers[order.offerId];

        if (msg.sender != order.buyer) revert OnlyBuyer();
        if (order.status != OrderStatus.FULFILLED) {
            revert InvalidStatus(order.status, OrderStatus.FULFILLED);
        }

        // Ensure within dispute window
        if (block.timestamp > order.fulfilledAt + DISPUTE_WINDOW) {
            revert DisputeWindowClosed();
        }

        // Prevent duplicate disputes
        if (order.disputeId != 0) revert Errors.InvalidInput("Dispute already exists");

        // Create dispute in CommerceDisputes
        uint256 disputeId = commerceDisputes.openDispute(
            offer.communityId,
            CommerceDisputes.DisputeType.MARKETPLACE_ORDER,
            orderId,
            order.buyer,
            offer.seller,
            order.amount,
            evidenceURI
        );

        order.status = OrderStatus.DISPUTED;
        order.disputeId = disputeId;
        disputeToOrder[disputeId] = orderId;

        emit OrderDisputeOpened(orderId, disputeId);
    }

    /**
     * @notice IDisputeReceiver callback from CommerceDisputes
     * @dev Executes economic outcome (refund or settlement)
     */
    function onDisputeResolved(uint256 disputeId, uint8 outcomeValue) external override nonReentrant {
        if (msg.sender != address(commerceDisputes)) {
            revert Errors.UnauthorizedCaller(msg.sender);
        }

        uint256 orderId = disputeToOrder[disputeId];
        if (orderId == 0) revert OrderNotFound(orderId);

        Order storage order = orders[orderId];
        Offer storage offer = offers[order.offerId];

        if (order.status != OrderStatus.DISPUTED) {
            revert InvalidStatus(order.status, OrderStatus.DISPUTED);
        }

        if (outcomeValue == 1) {
            // REFUND_BUYER
            order.status = OrderStatus.REFUNDED;
            IERC20(order.paymentToken).safeTransfer(order.buyer, order.amount);

            // Notify product module
            if (offer.productContract != address(0)) {
                IModuleProduct(offer.productContract).onOrderSettled(offer.productId, order.resourceId, OUTCOME_REFUNDED);
            }

            emit OrderRefunded(orderId, order.amount, order.paymentToken);
        } else if (outcomeValue == 2) {
            // PAY_SELLER
            order.status = OrderStatus.SETTLED;
            _settleToSeller(order, offer);

            emit OrderSettled(orderId, order.amount, order.paymentToken);
        }

        emit OrderDisputeResolved(orderId, disputeId, outcomeValue, offer.seller, order.buyer, offer.communityId);
    }

    // ============ View Functions ============

    function getOffer(uint256 offerId) external view returns (Offer memory) {
        return offers[offerId];
    }

    function getOrder(uint256 orderId) external view returns (Order memory) {
        return orders[orderId];
    }

    function canOpenDispute(uint256 orderId) external view returns (bool) {
        Order storage order = orders[orderId];
        return order.status == OrderStatus.FULFILLED && block.timestamp <= order.fulfilledAt + DISPUTE_WINDOW
            && order.disputeId == 0;
    }

    function canSettle(uint256 orderId) external view returns (bool) {
        Order storage order = orders[orderId];
        return order.status == OrderStatus.FULFILLED && block.timestamp > order.fulfilledAt + DISPUTE_WINDOW;
    }
}
