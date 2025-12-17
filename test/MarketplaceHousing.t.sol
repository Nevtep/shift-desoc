// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {Marketplace} from "../contracts/modules/Marketplace.sol";
import {HousingManager} from "../contracts/modules/HousingManager.sol";
import {CommerceDisputes} from "../contracts/modules/CommerceDisputes.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

/**
 * @title MarketplaceHousing Integration Test
 * @notice Tests complete housing reservation lifecycle via Marketplace
 *
 * Test Coverage:
 * - Unit creation and offer listing
 * - Reservation creation via ModuleProduct.consume
 * - Price calculation (quote with multi-night stays)
 * - Availability enforcement (no double-bookings)
 * - Check-in/check-out lifecycle
 * - Settlement after checkout
 * - Cancellation refund calculations
 * - Edge cases (overlapping dates, min stay violations)
 */
contract MarketplaceHousingTest is Test {
    Marketplace public marketplace;
    HousingManager public housing;
    CommerceDisputes public disputes;

    ERC20Mock public usdc;

    address public owner = address(this);
    address public unitOwner = address(0x10);
    address public guest1 = address(0x20);
    address public guest2 = address(0x21);

    uint256 public constant COMMUNITY_ID = 1;
    uint256 public constant PRICE_PER_NIGHT = 50e6; // 50 USDC
    uint256 public constant UNIT_CAPACITY = 2;

    uint256 public unitId;
    uint256 public offerId;

    event ReservationCreated(
        uint256 indexed reservationId,
        uint256 indexed unitId,
        uint256 indexed orderId,
        address guest,
        uint64 checkInDate,
        uint64 checkOutDate
    );

    event CheckedIn(uint256 indexed reservationId, uint64 timestamp);
    event CheckedOut(uint256 indexed reservationId, uint64 timestamp);

    function setUp() public {
        // Deploy tokens
        usdc = new ERC20Mock();

        // Deploy system contracts
        disputes = new CommerceDisputes(owner);
        marketplace = new Marketplace(owner, address(disputes), address(0));
        housing = new HousingManager(owner, address(marketplace), address(usdc));

        // Configure disputes system
        disputes.setAuthorizedCaller(address(marketplace), true);
        disputes.setDisputeReceiver(address(marketplace));

        // Configure marketplace
        marketplace.setCommunityActive(COMMUNITY_ID, true);

        // Create housing unit
        unitId = housing.createUnit(
            COMMUNITY_ID,
            unitOwner,
            "ipfs://unit1-metadata",
            PRICE_PER_NIGHT,
            UNIT_CAPACITY,
            0 // No custom cancellation policy (use defaults)
        );

        // Unit owner creates marketplace offer
        vm.startPrank(unitOwner);
        offerId = marketplace.createOffer(
            COMMUNITY_ID,
            Marketplace.OfferKind.HOUSING,
            address(housing),
            unitId,
            PRICE_PER_NIGHT,
            address(usdc),
            false, // No community token
            true, // Accept stablecoin
            0, // No discount
            address(usdc),
            0, // All cohorts
            "ipfs://housing-offer1"
        );
        vm.stopPrank();

        // Mint tokens to guests
        usdc.mint(guest1, 10000e6);
        usdc.mint(guest2, 10000e6);

        vm.prank(guest1);
        usdc.approve(address(marketplace), type(uint256).max);

        vm.prank(guest2);
        usdc.approve(address(marketplace), type(uint256).max);
    }

    // ============ Unit & Offer Creation Tests ============

    function test_UnitCreationMintsToken() public {
        // Verify unit owner received ERC1155 token
        assertEq(housing.balanceOf(unitOwner, unitId), 1);

        HousingManager.Unit memory unit = housing.getUnit(unitId);
        assertEq(unit.unitId, unitId);
        assertEq(unit.communityId, COMMUNITY_ID);
        assertEq(unit.owner, unitOwner);
        assertEq(unit.basePrice, PRICE_PER_NIGHT);
        assertEq(unit.capacity, UNIT_CAPACITY);
        assertTrue(unit.active);
    }

    function test_OfferLinksToUnit() public {
        Marketplace.Offer memory offer = marketplace.getOffer(offerId);
        assertEq(uint8(offer.kind), uint8(Marketplace.OfferKind.HOUSING));
        assertEq(offer.productContract, address(housing));
        assertEq(offer.productId, unitId);
        assertEq(offer.basePrice, PRICE_PER_NIGHT);
    }

    // ============ Pricing & Quote Tests ============

    function test_QuoteCalculatesMultiNightPrice() public {
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 5 days; // 5 nights
        bytes memory params = abi.encode(checkIn, checkOut);

        uint256 quotedPrice = housing.quote(unitId, params, PRICE_PER_NIGHT);
        assertEq(quotedPrice, PRICE_PER_NIGHT * 5);
    }

    function test_RevertWhen_StayTooShort() public {
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn; // 0 nights
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.expectRevert();
        housing.quote(unitId, params, PRICE_PER_NIGHT);
    }

    function test_RevertWhen_InvalidDateRange() public {
        uint64 checkIn = uint64(block.timestamp + 5 days);
        uint64 checkOut = checkIn - 1 days; // checkOut before checkIn
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.expectRevert();
        housing.quote(unitId, params, PRICE_PER_NIGHT);
    }

    // ============ Reservation Creation Tests ============

    function test_PurchaseCreatesReservation() public {
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 3 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(guest1);
        vm.expectEmit(true, true, true, true);
        emit ReservationCreated(1, unitId, 0, guest1, checkIn, checkOut);
        uint256 orderId = marketplace.purchase(offerId, address(usdc), params);

        // Verify order created
        Marketplace.Order memory order = marketplace.getOrder(orderId);
        assertEq(order.buyer, guest1);
        assertEq(order.amount, PRICE_PER_NIGHT * 3);
        assertEq(order.resourceId, 1); // reservationId

        // Verify reservation created
        HousingManager.Reservation memory reservation = housing.getReservation(1);
        assertEq(reservation.reservationId, 1);
        assertEq(reservation.unitId, unitId);
        assertEq(reservation.guest, guest1);
        assertEq(reservation.checkInDate, checkIn);
        assertEq(reservation.checkOutDate, checkOut);
        assertEq(reservation.totalPrice, PRICE_PER_NIGHT * 3);
        assertEq(uint8(reservation.status), uint8(HousingManager.ReservationStatus.PENDING));
    }

    function test_ReservationMarksUnavailable() public {
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 3 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        // Initially available
        assertTrue(housing.isAvailable(unitId, checkIn, checkOut));

        vm.prank(guest1);
        marketplace.purchase(offerId, address(usdc), params);

        // Now unavailable
        assertFalse(housing.isAvailable(unitId, checkIn, checkOut));
    }

    function test_RevertWhen_DoubleBooking() public {
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 3 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        // First booking succeeds
        vm.prank(guest1);
        marketplace.purchase(offerId, address(usdc), params);

        // Second booking with overlapping dates fails
        vm.prank(guest2);
        vm.expectRevert();
        marketplace.purchase(offerId, address(usdc), params);
    }

    function test_NonOverlappingReservationsAllowed() public {
        // First reservation: days 1-4
        uint64 checkIn1 = uint64(block.timestamp + 1 days);
        uint64 checkOut1 = checkIn1 + 3 days;
        bytes memory params1 = abi.encode(checkIn1, checkOut1);

        vm.prank(guest1);
        marketplace.purchase(offerId, address(usdc), params1);

        // Second reservation: days 4-7 (starts when first ends)
        uint64 checkIn2 = checkOut1; // No overlap
        uint64 checkOut2 = checkIn2 + 3 days;
        bytes memory params2 = abi.encode(checkIn2, checkOut2);

        vm.prank(guest2);
        uint256 orderId2 = marketplace.purchase(offerId, address(usdc), params2);

        // Both reservations should exist
        assertGt(orderId2, 0);
    }

    // ============ Check-in / Check-out Tests ============

    function test_GuestCheckIn() public {
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 3 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(guest1);
        marketplace.purchase(offerId, address(usdc), params);

        // Fast forward to check-in date
        vm.warp(checkIn);

        vm.prank(guest1);
        vm.expectEmit(true, false, false, false);
        emit CheckedIn(1, uint64(checkIn));
        housing.checkIn(1);

        HousingManager.Reservation memory reservation = housing.getReservation(1);
        assertEq(uint8(reservation.status), uint8(HousingManager.ReservationStatus.CHECKED_IN));
        assertEq(reservation.checkedInAt, checkIn);
    }

    function test_RevertWhen_CheckInTooEarly() public {
        uint64 checkIn = uint64(block.timestamp + 10 days);
        uint64 checkOut = checkIn + 3 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(guest1);
        marketplace.purchase(offerId, address(usdc), params);

        // Try to check in immediately (before checkInDate)
        vm.prank(guest1);
        vm.expectRevert();
        housing.checkIn(1);
    }

    function test_RevertWhen_NonGuestTriesToCheckIn() public {
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 3 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(guest1);
        marketplace.purchase(offerId, address(usdc), params);

        vm.warp(checkIn);

        // guest2 tries to check in to guest1's reservation
        vm.prank(guest2);
        vm.expectRevert();
        housing.checkIn(1);
    }

    function test_GuestCheckOut() public {
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 3 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(guest1);
        marketplace.purchase(offerId, address(usdc), params);

        vm.warp(checkIn);
        vm.prank(guest1);
        housing.checkIn(1);

        vm.warp(checkOut);
        vm.prank(guest1);
        vm.expectEmit(true, false, false, false);
        emit CheckedOut(1, uint64(checkOut));
        housing.checkOut(1);

        HousingManager.Reservation memory reservation = housing.getReservation(1);
        assertEq(uint8(reservation.status), uint8(HousingManager.ReservationStatus.CHECKED_OUT));
        assertEq(reservation.checkedOutAt, checkOut);
    }

    function test_RevertWhen_CheckOutBeforeCheckIn() public {
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 3 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(guest1);
        marketplace.purchase(offerId, address(usdc), params);

        // Try to check out without checking in
        vm.prank(guest1);
        vm.expectRevert();
        housing.checkOut(1);
    }

    // ============ Settlement Tests ============

    function test_SettlementAfterCheckout() public {
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 3 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(guest1);
        uint256 orderId = marketplace.purchase(offerId, address(usdc), params);

        // Complete stay lifecycle
        vm.warp(checkIn);
        vm.prank(guest1);
        housing.checkIn(1);

        vm.warp(checkOut);
        vm.prank(guest1);
        housing.checkOut(1);

        // Seller marks fulfilled
        vm.prank(unitOwner);
        marketplace.markOrderFulfilled(orderId);

        // Wait for dispute window
        vm.warp(block.timestamp + 3 days + 1 seconds);

        // Settle order
        uint256 sellerBalanceBefore = usdc.balanceOf(unitOwner);
        vm.prank(unitOwner);
        marketplace.settleOrder(orderId);

        // Verify seller received payment
        Marketplace.Order memory order = marketplace.getOrder(orderId);
        assertEq(usdc.balanceOf(unitOwner), sellerBalanceBefore + order.amount);
    }

    // ============ Cancellation Policy Tests ============

    function test_CancellationRefundCalculation_FullRefund() public {
        uint64 checkIn = uint64(block.timestamp + 10 days);
        uint64 checkOut = checkIn + 3 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(guest1);
        marketplace.purchase(offerId, address(usdc), params);

        // Cancel 8 days before check-in (>7 days = 100% refund)
        vm.warp(checkIn - 8 days);
        uint256 refundBps = housing.getCancellationRefundBps(1);
        assertEq(refundBps, 10000); // 100%
    }

    function test_CancellationRefundCalculation_HalfRefund() public {
        uint64 checkIn = uint64(block.timestamp + 10 days);
        uint64 checkOut = checkIn + 3 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(guest1);
        marketplace.purchase(offerId, address(usdc), params);

        // Cancel 5 days before check-in (3-7 days = 50% refund)
        vm.warp(checkIn - 5 days);
        uint256 refundBps = housing.getCancellationRefundBps(1);
        assertEq(refundBps, 5000); // 50%
    }

    function test_CancellationRefundCalculation_NoRefund() public {
        uint64 checkIn = uint64(block.timestamp + 10 days);
        uint64 checkOut = checkIn + 3 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(guest1);
        marketplace.purchase(offerId, address(usdc), params);

        // Cancel 2 days before check-in (<3 days = 0% refund)
        vm.warp(checkIn - 2 days);
        uint256 refundBps = housing.getCancellationRefundBps(1);
        assertEq(refundBps, 0); // 0%
    }

    // ============ Dispute Integration Tests ============

    function test_DisputeFreesReservationDates() public {
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 3 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(guest1);
        uint256 orderId = marketplace.purchase(offerId, address(usdc), params);

        // Verify dates occupied
        assertFalse(housing.isAvailable(unitId, checkIn, checkOut));

        // Complete stay and open dispute
        vm.warp(checkOut);
        vm.prank(unitOwner);
        marketplace.markOrderFulfilled(orderId);

        vm.prank(guest1);
        marketplace.openOrderDispute(orderId, "ipfs://complaint");

        Marketplace.Order memory order = marketplace.getOrder(orderId);

        // Resolve dispute with refund
        vm.prank(owner);
        disputes.finalizeDispute(order.disputeId, CommerceDisputes.DisputeOutcome.REFUND_BUYER);

        // Dates should be freed
        assertTrue(housing.isAvailable(unitId, checkIn, checkOut));
    }

    // ============ Multi-Unit Scenario Tests ============

    function test_MultipleUnitsIndependentAvailability() public {
        // Create second unit
        uint256 unitId2 = housing.createUnit(
            COMMUNITY_ID,
            unitOwner,
            "ipfs://unit2",
            PRICE_PER_NIGHT * 2, // Different price
            4,
            0
        );

        vm.startPrank(unitOwner);
        uint256 offerId2 = marketplace.createOffer(
            COMMUNITY_ID,
            Marketplace.OfferKind.HOUSING,
            address(housing),
            unitId2,
            PRICE_PER_NIGHT * 2,
            address(usdc),
            false,
            true,
            0,
            address(usdc),
            0,
            "ipfs://unit2-offer"
        );
        vm.stopPrank();

        // Book unit 1
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 3 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(guest1);
        marketplace.purchase(offerId, address(usdc), params);

        // Unit 1 unavailable
        assertFalse(housing.isAvailable(unitId, checkIn, checkOut));

        // Unit 2 still available
        assertTrue(housing.isAvailable(unitId2, checkIn, checkOut));

        // Book unit 2 for same dates
        vm.prank(guest2);
        uint256 orderId2 = marketplace.purchase(offerId2, address(usdc), params);
        assertGt(orderId2, 0);
    }

    // ============ View Function Tests ============

    function test_GetInvestorStake() public {
        // No stake initially
        assertEq(housing.getInvestorStake(unitId, guest1), 0);

        // After staking (would need staking implementation)
        // This is tested more thoroughly in HousingManager unit tests
    }
}
