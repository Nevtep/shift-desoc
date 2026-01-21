// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {Marketplace} from "contracts/modules/Marketplace.sol";
import {CommerceDisputes} from "contracts/modules/CommerceDisputes.sol";
import {Roles} from "contracts/libs/Roles.sol";
import {HousingManager} from "contracts/modules/HousingManager.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

/**
 * @title MarketplaceDisputes Integration Test
 * @notice Tests dispute lifecycle: purchase → fulfill → dispute → resolution
 *
 * Test Coverage:
 * - Buyer opens dispute within 3-day window
 * - Dispute outcomes (REFUND_BUYER, PAY_SELLER)
 * - Economic flows (escrow → buyer or seller)
 * - HousingManager availability updates on refund
 * - Edge cases (late disputes, duplicate disputes)
 */
contract MarketplaceDisputesTest is Test {
    Marketplace public marketplace;
    CommerceDisputes public disputes;
    HousingManager public housing;
    AccessManager public accessManager;

    ERC20Mock public usdc;
    ERC20Mock public communityToken;

    address public owner = address(this);
    address public seller = address(0x1);
    address public buyer = address(0x2);
    address public verifier = address(0x3);

    uint256 public constant COMMUNITY_ID = 1;
    uint256 public constant UNIT_PRICE = 100e6; // 100 USDC per night
    uint256 public constant DISPUTE_WINDOW = 3 days;

    uint256 public unitId;
    uint256 public offerId;
    uint256 public orderId;

    event OrderDisputeOpened(uint256 indexed orderId, uint256 indexed disputeId);
    event OrderDisputeResolved(
        uint256 indexed orderId,
        uint256 indexed disputeId,
        uint8 outcome,
        address seller,
        address buyer,
        uint256 communityId
    );

    function setUp() public {
        // Deploy tokens
        usdc = new ERC20Mock();
        communityToken = new ERC20Mock();

        // Deploy system contracts
        accessManager = new AccessManager(owner);
        disputes = new CommerceDisputes(address(accessManager));
        marketplace = new Marketplace(address(accessManager), address(disputes), address(0)); // No RevenueRouter for now
        housing = new HousingManager(address(accessManager), address(usdc));

        bytes4[] memory marketplaceAdmin = new bytes4[](4);
        marketplaceAdmin[0] = marketplace.setCommunityActive.selector;
        marketplaceAdmin[1] = marketplace.setCommunityToken.selector;
        marketplaceAdmin[2] = marketplace.setCommerceDisputes.selector;
        marketplaceAdmin[3] = marketplace.setRevenueRouter.selector;
        accessManager.setTargetFunctionRole(address(marketplace), marketplaceAdmin, accessManager.ADMIN_ROLE());

        bytes4[] memory housingAdmin = new bytes4[](1);
        housingAdmin[0] = housing.createUnit.selector;
        accessManager.setTargetFunctionRole(address(housing), housingAdmin, accessManager.ADMIN_ROLE());

        bytes4[] memory housingMarketplaceSelectors = new bytes4[](2);
        housingMarketplaceSelectors[0] = housing.consume.selector;
        housingMarketplaceSelectors[1] = housing.onOrderSettled.selector;
        accessManager.setTargetFunctionRole(
            address(housing),
            housingMarketplaceSelectors,
            Roles.HOUSING_MARKETPLACE_CALLER_ROLE
        );
        accessManager.grantRole(Roles.HOUSING_MARKETPLACE_CALLER_ROLE, address(marketplace), 0);

        bytes4[] memory disputesAdmin = new bytes4[](1);
        disputesAdmin[0] = disputes.setDisputeReceiver.selector;
        accessManager.setTargetFunctionRole(address(disputes), disputesAdmin, accessManager.ADMIN_ROLE());

        bytes4[] memory disputeCaller = new bytes4[](1);
        disputeCaller[0] = disputes.openDispute.selector;
        accessManager.setTargetFunctionRole(address(disputes), disputeCaller, Roles.COMMERCE_DISPUTES_CALLER_ROLE);

        // Configure marketplace
        marketplace.setCommunityActive(COMMUNITY_ID, true);
        marketplace.setCommunityToken(COMMUNITY_ID, address(communityToken));

        // Authorize marketplace as dispute caller via AccessManager
        accessManager.grantRole(Roles.COMMERCE_DISPUTES_CALLER_ROLE, address(marketplace), 0);
        disputes.setDisputeReceiver(address(marketplace));

        // Create housing unit
        unitId = housing.createUnit(COMMUNITY_ID, seller, "ipfs://unit1", UNIT_PRICE, 4, 0);

        // Seller creates marketplace offer
        vm.startPrank(seller);
        offerId = marketplace.createOffer(
            COMMUNITY_ID,
            Marketplace.OfferKind.HOUSING,
            address(housing),
            unitId,
            UNIT_PRICE,
            address(usdc),
            false, // No community token
            true, // Accept stablecoin
            0, // No discount
            address(usdc),
            0, // All cohorts
            "ipfs://offer1"
        );
        vm.stopPrank();

        // Mint tokens to buyer
        usdc.mint(buyer, 1000e6);
        vm.prank(buyer);
        usdc.approve(address(marketplace), type(uint256).max);
    }

    // ============ Purchase & Fulfillment Tests ============

    function test_PurchaseCreatesEscrow() public {
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 2 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(buyer);
        orderId = marketplace.purchase(offerId, address(usdc), params);

        Marketplace.Order memory order = marketplace.getOrder(orderId);
        assertEq(order.buyer, buyer);
        assertEq(order.amount, UNIT_PRICE * 2); // 2 nights
        assertEq(uint8(order.status), uint8(Marketplace.OrderStatus.ESCROWED));
        assertEq(usdc.balanceOf(address(marketplace)), UNIT_PRICE * 2);
    }

    function test_SellerMarksFulfilled() public {
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 2 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(buyer);
        orderId = marketplace.purchase(offerId, address(usdc), params);

        vm.prank(seller);
        marketplace.markOrderFulfilled(orderId);

        Marketplace.Order memory order = marketplace.getOrder(orderId);
        assertEq(uint8(order.status), uint8(Marketplace.OrderStatus.FULFILLED));
        assertGt(order.fulfilledAt, 0);
    }

    function test_RevertWhen_NonSellerTriesToMarkFulfilled() public {
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 2 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(buyer);
        orderId = marketplace.purchase(offerId, address(usdc), params);

        vm.prank(buyer); // Buyer tries to mark fulfilled
        vm.expectRevert();
        marketplace.markOrderFulfilled(orderId);
    }

    // ============ Dispute Opening Tests ============

    function test_BuyerOpensDisputeWithinWindow() public {
        // Setup: purchase and fulfill
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 2 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(buyer);
        orderId = marketplace.purchase(offerId, address(usdc), params);

        vm.prank(seller);
        marketplace.markOrderFulfilled(orderId);

        // Open dispute
        vm.prank(buyer);
        vm.expectEmit(true, true, false, false);
        emit OrderDisputeOpened(orderId, 1); // disputeId should be 1
        marketplace.openOrderDispute(orderId, "ipfs://evidence1");

        Marketplace.Order memory order = marketplace.getOrder(orderId);
        assertEq(uint8(order.status), uint8(Marketplace.OrderStatus.DISPUTED));
        assertEq(order.disputeId, 1);
    }

    function test_RevertWhen_BuyerTriesToDisputeAfterWindow() public {
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 2 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(buyer);
        orderId = marketplace.purchase(offerId, address(usdc), params);

        vm.prank(seller);
        marketplace.markOrderFulfilled(orderId);

        // Fast forward past dispute window
        vm.warp(block.timestamp + DISPUTE_WINDOW + 1 seconds);

        vm.prank(buyer);
        vm.expectRevert();
        marketplace.openOrderDispute(orderId, "ipfs://evidence1");
    }

    function test_RevertWhen_OpeningDuplicateDispute() public {
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 2 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(buyer);
        orderId = marketplace.purchase(offerId, address(usdc), params);

        vm.prank(seller);
        marketplace.markOrderFulfilled(orderId);

        vm.startPrank(buyer);
        marketplace.openOrderDispute(orderId, "ipfs://evidence1");
        vm.expectRevert();
        marketplace.openOrderDispute(orderId, "ipfs://evidence2"); // Should fail
        vm.stopPrank();
    }

    function test_RevertWhen_NonBuyerTriesToOpenDispute() public {
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 2 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(buyer);
        orderId = marketplace.purchase(offerId, address(usdc), params);

        vm.prank(seller);
        marketplace.markOrderFulfilled(orderId);

        vm.prank(seller); // Seller tries to open dispute
        vm.expectRevert();
        marketplace.openOrderDispute(orderId, "ipfs://evidence1");
    }

    // ============ Dispute Resolution Tests ============

    function test_RefundBuyerOutcome() public {
        // Setup: purchase, fulfill, dispute
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 2 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(buyer);
        orderId = marketplace.purchase(offerId, address(usdc), params);

        vm.prank(seller);
        marketplace.markOrderFulfilled(orderId);

        vm.prank(buyer);
        marketplace.openOrderDispute(orderId, "ipfs://evidence1");

        Marketplace.Order memory order = marketplace.getOrder(orderId);
        uint256 disputeId = order.disputeId;
        uint256 escrowAmount = order.amount;

        // Admin finalizes dispute with REFUND_BUYER outcome
        uint256 buyerBalanceBefore = usdc.balanceOf(buyer);
        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit OrderDisputeResolved(orderId, disputeId, 1, seller, buyer, COMMUNITY_ID);
        disputes.finalizeDispute(disputeId, CommerceDisputes.DisputeOutcome.REFUND_BUYER);

        // Verify buyer received refund
        assertEq(usdc.balanceOf(buyer), buyerBalanceBefore + escrowAmount);

        // Verify order status
        order = marketplace.getOrder(orderId);
        assertEq(uint8(order.status), uint8(Marketplace.OrderStatus.REFUNDED));

        // Verify dispute status
        CommerceDisputes.Dispute memory dispute = disputes.getDispute(disputeId);
        assertEq(uint8(dispute.status), uint8(CommerceDisputes.DisputeStatus.RESOLVED));
        assertEq(uint8(dispute.outcome), uint8(CommerceDisputes.DisputeOutcome.REFUND_BUYER));
    }

    function test_PaySellerOutcome() public {
        // Setup: purchase, fulfill, dispute
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 2 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(buyer);
        orderId = marketplace.purchase(offerId, address(usdc), params);

        vm.prank(seller);
        marketplace.markOrderFulfilled(orderId);

        vm.prank(buyer);
        marketplace.openOrderDispute(orderId, "ipfs://evidence1");

        Marketplace.Order memory order = marketplace.getOrder(orderId);
        uint256 disputeId = order.disputeId;
        uint256 escrowAmount = order.amount;

        // Admin finalizes dispute with PAY_SELLER outcome
        uint256 sellerBalanceBefore = usdc.balanceOf(seller);
        vm.prank(owner);
        disputes.finalizeDispute(disputeId, CommerceDisputes.DisputeOutcome.PAY_SELLER);

        // Verify seller received payment
        assertEq(usdc.balanceOf(seller), sellerBalanceBefore + escrowAmount);

        // Verify order status
        order = marketplace.getOrder(orderId);
        assertEq(uint8(order.status), uint8(Marketplace.OrderStatus.SETTLED));
    }

    function test_RefundFreesHousingDates() public {
        // Setup: purchase, fulfill, dispute
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 2 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(buyer);
        orderId = marketplace.purchase(offerId, address(usdc), params);

        // Verify dates initially occupied
        assertFalse(housing.isAvailable(unitId, checkIn, checkOut));

        vm.prank(seller);
        marketplace.markOrderFulfilled(orderId);

        vm.prank(buyer);
        marketplace.openOrderDispute(orderId, "ipfs://evidence1");

        Marketplace.Order memory order = marketplace.getOrder(orderId);
        uint256 disputeId = order.disputeId;

        // Finalize with REFUND_BUYER
        vm.prank(owner);
        disputes.finalizeDispute(disputeId, CommerceDisputes.DisputeOutcome.REFUND_BUYER);

        // Verify dates now available
        assertTrue(housing.isAvailable(unitId, checkIn, checkOut));
    }

    // ============ Settlement Without Dispute Tests ============

    function test_SettleAfterDisputeWindow() public {
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 2 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(buyer);
        orderId = marketplace.purchase(offerId, address(usdc), params);

        vm.prank(seller);
        marketplace.markOrderFulfilled(orderId);

        // Fast forward past dispute window
        vm.warp(block.timestamp + DISPUTE_WINDOW + 1 seconds);

        // Seller settles order
        uint256 sellerBalanceBefore = usdc.balanceOf(seller);
        vm.prank(seller);
        marketplace.settleOrder(orderId);

        // Verify seller received payment
        Marketplace.Order memory order = marketplace.getOrder(orderId);
        assertEq(usdc.balanceOf(seller), sellerBalanceBefore + order.amount);
        assertEq(uint8(order.status), uint8(Marketplace.OrderStatus.SETTLED));
    }

    function test_RevertWhen_SettlingDuringDisputeWindow() public {
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 2 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(buyer);
        orderId = marketplace.purchase(offerId, address(usdc), params);

        vm.prank(seller);
        marketplace.markOrderFulfilled(orderId);

        // Try to settle immediately (should fail)
        vm.prank(seller);
        vm.expectRevert();
        marketplace.settleOrder(orderId);
    }

    // ============ View Function Tests ============

    function test_CanOpenDisputeView() public {
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 2 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(buyer);
        orderId = marketplace.purchase(offerId, address(usdc), params);

        // Initially cannot open dispute (not fulfilled)
        assertFalse(marketplace.canOpenDispute(orderId));

        vm.prank(seller);
        marketplace.markOrderFulfilled(orderId);

        // Now can open dispute
        assertTrue(marketplace.canOpenDispute(orderId));

        // After window expires
        vm.warp(block.timestamp + DISPUTE_WINDOW + 1 seconds);
        assertFalse(marketplace.canOpenDispute(orderId));
    }

    function test_CanSettleView() public {
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 2 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(buyer);
        orderId = marketplace.purchase(offerId, address(usdc), params);

        vm.prank(seller);
        marketplace.markOrderFulfilled(orderId);

        // Initially cannot settle (within dispute window)
        assertFalse(marketplace.canSettle(orderId));

        // After window expires
        vm.warp(block.timestamp + DISPUTE_WINDOW + 1 seconds);
        assertTrue(marketplace.canSettle(orderId));
    }
}
