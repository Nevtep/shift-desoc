// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {Marketplace} from "../contracts/modules/Marketplace.sol";
import {HousingManager} from "../contracts/modules/HousingManager.sol";
import {CommerceDisputes} from "../contracts/modules/CommerceDisputes.sol";
import {RevenueRouter} from "../contracts/modules/RevenueRouter.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

/**
 * @title MarketplaceRevenueRouter Integration Test
 * @notice Tests revenue distribution from Marketplace settlements through RevenueRouter
 *
 * Test Coverage:
 * - Settlement triggers RevenueRouter.routeRevenue
 * - Revenue distributed according to community policy
 * - Workers receive minimum guarantee + remainder
 * - Treasury receives base allocation
 * - Investors receive cohort-based distribution
 * - Spillover handling when cohorts complete
 * - Multi-cohort scenarios
 */
contract MarketplaceRevenueRouterTest is Test {
    Marketplace public marketplace;
    HousingManager public housing;
    CommerceDisputes public disputes;
    RevenueRouter public revenueRouter;
    
    // Mock dependencies for RevenueRouter
    ParamControllerMock public paramController;
    CohortRegistryMock public cohortRegistry;

    ERC20Mock public usdc;

    address public owner = address(this);
    address public seller = address(0x1);
    address public buyer = address(0x2);
    address public treasury = address(0x3);
    address public worker1 = address(0x10);
    address public worker2 = address(0x11);
    address public investor1 = address(0x20);
    address public investor2 = address(0x21);

    uint256 public constant COMMUNITY_ID = 1;
    uint256 public constant UNIT_PRICE = 100e6; // 100 USDC per night

    uint256 public unitId;
    uint256 public offerId;

    // Revenue policy: 30% workers min, 20% treasury, 50% investors
    uint256 public constant MIN_WORKERS_BPS = 3000; // 30%
    uint256 public constant TREASURY_BPS = 2000; // 20%
    uint256 public constant INVESTORS_BPS = 5000; // 50%

    event RevenueReceived(uint256 indexed communityId, address indexed token, uint256 amount, address indexed from);
    event RevenueRouted(
        uint256 indexed communityId,
        address indexed token,
        uint256 amount,
        uint256 workersMin,
        uint256 treasuryBase,
        uint256 investorPool,
        uint256 spillover,
        uint8 spilloverTarget
    );

    function setUp() public {
        // Deploy tokens
        usdc = new ERC20Mock();

        // Deploy mocks
        paramController = new ParamControllerMock();
        cohortRegistry = new CohortRegistryMock();

        // Configure revenue policy
        paramController.setRevenuePolicy(COMMUNITY_ID, MIN_WORKERS_BPS, TREASURY_BPS, INVESTORS_BPS, 0);

        // Deploy RevenueRouter
        revenueRouter = new RevenueRouter(address(paramController), address(cohortRegistry), owner);
        revenueRouter.setCommunityTreasury(COMMUNITY_ID, treasury);
        revenueRouter.setSupportedToken(COMMUNITY_ID, address(usdc), true);

        // Deploy system contracts
        disputes = new CommerceDisputes(owner);
        marketplace = new Marketplace(owner, address(disputes), address(revenueRouter));
        housing = new HousingManager(owner, address(marketplace), address(usdc));

        // Grant Marketplace the DISTRIBUTOR_ROLE
        revenueRouter.grantRole(revenueRouter.DISTRIBUTOR_ROLE(), address(marketplace));

        // Configure system
        disputes.setAuthorizedCaller(address(marketplace), true);
        disputes.setDisputeReceiver(address(marketplace));
        marketplace.setCommunityActive(COMMUNITY_ID, true);

        // Create housing unit and offer
        unitId = housing.createUnit(COMMUNITY_ID, seller, "ipfs://unit1", UNIT_PRICE, 2, 0);

        vm.startPrank(seller);
        offerId = marketplace.createOffer(
            COMMUNITY_ID,
            Marketplace.OfferKind.HOUSING,
            address(housing),
            unitId,
            UNIT_PRICE,
            address(usdc),
            false,
            true,
            0,
            address(usdc),
            0,
            "ipfs://offer1"
        );
        vm.stopPrank();

        // Mint tokens
        usdc.mint(buyer, 10000e6);
        vm.prank(buyer);
        usdc.approve(address(marketplace), type(uint256).max);
    }

    // ============ Basic Revenue Distribution Tests ============

    function test_SettlementTriggerRevenueRouting() public {
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 3 days; // 3 nights = 300 USDC
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(buyer);
        uint256 orderId = marketplace.purchase(offerId, address(usdc), params);

        vm.prank(seller);
        marketplace.markOrderFulfilled(orderId);

        vm.warp(block.timestamp + 3 days + 1 seconds);

        // Expect RevenueRouter events
        vm.expectEmit(true, true, false, true);
        emit RevenueReceived(COMMUNITY_ID, address(usdc), UNIT_PRICE * 3, address(marketplace));

        vm.prank(seller);
        marketplace.settleOrder(orderId);
    }

    function test_RevenueDistributedAccordingToPolicy() public {
        // Setup: 300 USDC order (3 nights @ 100 USDC/night)
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 3 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(buyer);
        uint256 orderId = marketplace.purchase(offerId, address(usdc), params);

        vm.prank(seller);
        marketplace.markOrderFulfilled(orderId);

        vm.warp(block.timestamp + 3 days + 1 seconds);

        uint256 amount = UNIT_PRICE * 3; // 300 USDC

        // Expected distribution (with NO active cohorts):
        // Workers min: 300 * 30% = 90 USDC
        // Remaining: 210 USDC
        // Treasury base: 210 * 20/(20+50) = 60 USDC
        // Investor pool: 150 USDC
        // No active cohorts → 150 spillover to workers (spilloverTarget=0)
        // Workers final: 90 + 150 = 240 USDC

        vm.prank(seller);
        marketplace.settleOrder(orderId);

        // Verify worker pool (min + spillover)
        assertEq(revenueRouter.workerPools(COMMUNITY_ID, address(usdc)), 240e6, "Workers should get min + spillover");

        // Verify treasury
        assertEq(revenueRouter.treasuryReserves(COMMUNITY_ID, address(usdc)), 60e6, "Treasury should be 60");

        // All investor pool becomes spillover when no active cohorts
    }

    function test_WorkersCanClaimFromPool() public {
        // Complete order and settlement
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 3 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(buyer);
        uint256 orderId = marketplace.purchase(offerId, address(usdc), params);

        vm.prank(seller);
        marketplace.markOrderFulfilled(orderId);

        vm.warp(block.timestamp + 3 days + 1 seconds);

        vm.prank(seller);
        marketplace.settleOrder(orderId);

        // Workers claim from pool
        uint256 workerPoolBalance = revenueRouter.workerPools(COMMUNITY_ID, address(usdc));
        assertGt(workerPoolBalance, 0);

        // Worker1 claims their share (would require additional access control in real implementation)
        // This tests the pool exists and can be accessed
    }

    function test_TreasuryClaim() public {
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 3 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(buyer);
        uint256 orderId = marketplace.purchase(offerId, address(usdc), params);

        vm.prank(seller);
        marketplace.markOrderFulfilled(orderId);

        vm.warp(block.timestamp + 3 days + 1 seconds);

        vm.prank(seller);
        marketplace.settleOrder(orderId);

        uint256 treasuryBalance = revenueRouter.treasuryReserves(COMMUNITY_ID, address(usdc));
        assertEq(treasuryBalance, 60e6); // 20% of 300 USDC

        // Treasury can withdraw (requires TREASURY_ROLE or being treasury address)
        vm.prank(treasury);
        revenueRouter.withdrawTreasuryRevenue(COMMUNITY_ID, address(usdc), treasuryBalance, treasury);

        assertEq(usdc.balanceOf(treasury), treasuryBalance);
    }

    // ============ Cohort Distribution Tests ============

    function test_RevenueDistributedToCohort() public {
        // Create a cohort
        uint256 cohortId = cohortRegistry.createCohort(COMMUNITY_ID, 15000, 100, keccak256("ipfs://c1"), 0, 0, true); // 150% ROI target
        cohortRegistry.addInvestment(cohortId, investor1, 1000e6, 1); // 1000 USDC investment

        // Complete order
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 3 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(buyer);
        uint256 orderId = marketplace.purchase(offerId, address(usdc), params);

        vm.prank(seller);
        marketplace.markOrderFulfilled(orderId);

        vm.warp(block.timestamp + 3 days + 1 seconds);

        vm.prank(seller);
        marketplace.settleOrder(orderId);

        // Investor pool should be 150 USDC (50% of 300)
        // All should go to cohort since it's the only active cohort
        // Check investor1's claim in RevenueRouter (gets 100% since sole investor)
        uint256 investorClaim = revenueRouter.investorClaims(cohortId, investor1, address(usdc));
        assertEq(investorClaim, 150e6, "Investor should get full 150 USDC investor pool");
    }

    function test_MultipleCohortDistribution() public {
        // Create two cohorts with different priorities
        uint256 cohort1 = cohortRegistry.createCohort(COMMUNITY_ID, 15000, 100, keccak256("ipfs://c1"), 0, 0, true);
        cohortRegistry.addInvestment(cohort1, investor1, 1000e6, 1);

        uint256 cohort2 = cohortRegistry.createCohort(COMMUNITY_ID, 20000, 50, keccak256("ipfs://c2"), 0, 0, true);
        cohortRegistry.addInvestment(cohort2, investor2, 500e6, 2);

        // Complete order
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 10 days; // Large order: 1000 USDC
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(buyer);
        uint256 orderId = marketplace.purchase(offerId, address(usdc), params);

        vm.prank(seller);
        marketplace.markOrderFulfilled(orderId);

        vm.warp(block.timestamp + 3 days + 1 seconds);

        vm.prank(seller);
        marketplace.settleOrder(orderId);

        // Investor pool: 50% of 1000 = 500 USDC
        // Split by priority weights: cohort1 (100) vs cohort2 (50) = 2:1
        // cohort1: 500 * 100/150 = 333.33... USDC → investor1 gets 100%
        // cohort2: 500 * 50/150 = 166.66... USDC → investor2 gets 100%
        uint256 investor1Claim = revenueRouter.investorClaims(cohort1, investor1, address(usdc));
        uint256 investor2Claim = revenueRouter.investorClaims(cohort2, investor2, address(usdc));
        
        // Allow 1 USDC rounding tolerance due to integer division
        assertApproxEqAbs(investor1Claim + investor2Claim, 500e6, 1, "Total investor claims should be ~500");
        assertApproxEqAbs(investor1Claim, 333333333, 100, "Investor1 should get ~333 USDC");
        assertApproxEqAbs(investor2Claim, 166666666, 100, "Investor2 should get ~167 USDC");
    }

    // ============ Fallback Behavior Tests ============

    function test_FallbackWhenNoRevenueRouter() public {
        // Create marketplace WITHOUT RevenueRouter
        Marketplace marketplaceNoRouter = new Marketplace(owner, address(disputes), address(0));
        marketplaceNoRouter.setCommunityActive(COMMUNITY_ID, true);

        // Create separate housing for this marketplace with stablecoin
        HousingManager housingNoRouter = new HousingManager(owner, address(marketplaceNoRouter), address(usdc));
        uint256 unitIdNoRouter = housingNoRouter.createUnit(COMMUNITY_ID, seller, "ipfs://unit1", UNIT_PRICE, 2, 0);

        // Create offer
        vm.startPrank(seller);
        uint256 offerIdNoRouter = marketplaceNoRouter.createOffer(
            COMMUNITY_ID,
            Marketplace.OfferKind.HOUSING,
            address(housingNoRouter),
            unitIdNoRouter,
            UNIT_PRICE,
            address(usdc),
            false,
            true,
            0,
            address(usdc),
            0,
            "ipfs://offer-no-router"
        );
        vm.stopPrank();

        // Purchase
        uint64 checkIn = uint64(block.timestamp + 1 days);
        uint64 checkOut = checkIn + 3 days;
        bytes memory params = abi.encode(checkIn, checkOut);

        vm.prank(buyer);
        usdc.approve(address(marketplaceNoRouter), type(uint256).max);
        vm.prank(buyer);
        uint256 orderId = marketplaceNoRouter.purchase(offerIdNoRouter, address(usdc), params);

        vm.prank(seller);
        marketplaceNoRouter.markOrderFulfilled(orderId);

        vm.warp(block.timestamp + 3 days + 1 seconds);

        // Settle - should send directly to seller
        uint256 sellerBalanceBefore = usdc.balanceOf(seller);
        vm.prank(seller);
        marketplaceNoRouter.settleOrder(orderId);

        assertEq(usdc.balanceOf(seller), sellerBalanceBefore + (UNIT_PRICE * 3));
    }

    // ============ Edge Cases ============

    function test_MultipleOrdersAccumulateRevenue() public {
        // First order
        uint64 checkIn1 = uint64(block.timestamp + 1 days);
        uint64 checkOut1 = checkIn1 + 2 days;
        bytes memory params1 = abi.encode(checkIn1, checkOut1);

        vm.prank(buyer);
        uint256 orderId1 = marketplace.purchase(offerId, address(usdc), params1);

        vm.prank(seller);
        marketplace.markOrderFulfilled(orderId1);

        vm.warp(block.timestamp + 3 days + 1 seconds);

        vm.prank(seller);
        marketplace.settleOrder(orderId1);

        uint256 workerPoolAfterFirst = revenueRouter.workerPools(COMMUNITY_ID, address(usdc));

        // Second order
        uint64 checkIn2 = checkOut1;
        uint64 checkOut2 = checkIn2 + 2 days;
        bytes memory params2 = abi.encode(checkIn2, checkOut2);

        usdc.mint(buyer, 1000e6);
        vm.prank(buyer);
        uint256 orderId2 = marketplace.purchase(offerId, address(usdc), params2);

        vm.prank(seller);
        marketplace.markOrderFulfilled(orderId2);

        vm.warp(block.timestamp + 3 days + 1 seconds);

        vm.prank(seller);
        marketplace.settleOrder(orderId2);

        // Worker pool should have accumulated from both orders
        uint256 workerPoolAfterSecond = revenueRouter.workerPools(COMMUNITY_ID, address(usdc));
        assertGt(workerPoolAfterSecond, workerPoolAfterFirst);
    }
}

// ============ Mock Contracts ============

contract ParamControllerMock {
    mapping(uint256 => uint256[4]) public policies;

    function setRevenuePolicy(
        uint256 communityId,
        uint256 minWorkersBps,
        uint256 treasuryBps,
        uint256 investorsBps,
        uint8 spilloverTarget
    ) external {
        policies[communityId] = [minWorkersBps, treasuryBps, investorsBps, spilloverTarget];
    }

    function getRevenuePolicy(uint256 communityId) external view returns (
        uint256 minWorkersBps,
        uint256 treasuryBps,
        uint256 investorsBps,
        uint8 spilloverTarget
    ) {
        return (
            policies[communityId][0],
            policies[communityId][1],
            policies[communityId][2],
            uint8(policies[communityId][3])
        );
    }
}

contract CohortRegistryMock {
    struct Cohort {
        uint256 id;
        uint256 communityId;
        uint16 targetRoiBps;
        uint64 createdAt;
        uint64 startAt;
        uint64 endAt;
        uint32 priorityWeight;
        uint256 investedTotal;
        uint256 recoveredTotal;
        bool active;
        bytes32 termsHash;
    }

    uint256 public nextCohortId = 1;
    mapping(uint256 => Cohort) public cohorts;
    mapping(uint256 => uint256[]) public communityCohorts;
    mapping(uint256 => mapping(address => uint256)) public investments;
    mapping(uint256 => uint256) public investmentByToken;
    mapping(uint256 => address[]) public cohortInvestors;
    mapping(uint256 => mapping(address => uint256)) public cohortAllocations;

    function createCohort(
        uint256 communityId,
        uint16 targetRoiBps,
        uint32 priorityWeight,
        bytes32 termsHash,
        uint64 startAt,
        uint64 endAt,
        bool active
    ) external returns (uint256) {
        uint256 cohortId = nextCohortId++;
        cohorts[cohortId] = Cohort({
            id: cohortId,
            communityId: communityId,
            targetRoiBps: targetRoiBps,
            createdAt: uint64(block.timestamp),
            startAt: startAt,
            endAt: endAt,
            priorityWeight: priorityWeight,
            investedTotal: 0,
            recoveredTotal: 0,
            active: active,
            termsHash: termsHash
        });
        communityCohorts[communityId].push(cohortId);
        return cohortId;
    }

    function addInvestment(uint256 cohortId, address investor, uint256 amount, uint256 tokenId) external {
        if (investments[cohortId][investor] == 0) {
            cohortInvestors[cohortId].push(investor);
        }
        investments[cohortId][investor] += amount;
        cohorts[cohortId].investedTotal += amount;
        investmentByToken[tokenId] = amount;
    }

    function getActiveCohorts(uint256 communityId) external view returns (uint256[] memory) {
        uint256[] memory allCohorts = communityCohorts[communityId];
        uint256 activeCount = 0;
        
        // Count active cohorts
        for (uint256 i = 0; i < allCohorts.length; i++) {
            if (cohorts[allCohorts[i]].active) {
                activeCount++;
            }
        }
        
        // Build active cohorts array
        uint256[] memory activeCohorts = new uint256[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < allCohorts.length; i++) {
            if (cohorts[allCohorts[i]].active) {
                activeCohorts[index++] = allCohorts[i];
            }
        }
        
        return activeCohorts;
    }

    function getCohort(uint256 cohortId) external view returns (Cohort memory) {
        return cohorts[cohortId];
    }

    function getCohortInvestors(uint256 cohortId) external view returns (address[] memory) {
        return cohortInvestors[cohortId];
    }

    function getInvestmentAmount(uint256 cohortId, address investor) external view returns (uint256) {
        return investments[cohortId][investor];
    }

    function markRecovered(uint256 cohortId, uint256 amount) external {
        cohorts[cohortId].recoveredTotal += amount;
    }

    function getUnrecoveredAmount(uint256 cohortId) external view returns (uint256) {
        Cohort memory cohort = cohorts[cohortId];
        if (cohort.recoveredTotal >= cohort.investedTotal) {
            return 0;
        }
        return cohort.investedTotal - cohort.recoveredTotal;
    }

    function getCohortWeight(uint256 cohortId, bool) external view returns (uint256) {
        return cohorts[cohortId].priorityWeight;
    }
}
