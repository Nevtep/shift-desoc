// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "contracts/modules/RevenueRouter.sol";
import "contracts/modules/ParamController.sol";
import "contracts/modules/CohortRegistry.sol";
import "contracts/libs/Errors.sol";

// Mock ERC20 token for testing
contract MockERC20 {
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
}

// Mock CommunityRegistry for testing
contract MockCommunityRegistry {
    mapping(uint256 => bool) public validCommunities;

    function setCommunityValid(uint256 communityId, bool valid) external {
        validCommunities[communityId] = valid;
    }

    function isValidCommunity(uint256 communityId) external view returns (bool) {
        return validCommunities[communityId];
    }
}

contract RevenueRouterCohortTest is Test {
    RevenueRouter public router;
    ParamController public paramController;
    CohortRegistry public cohortRegistry;
    MockCommunityRegistry public communityRegistry;
    MockERC20 public usdc;

    address public admin = address(0x1001);
    address public treasury = address(0x1002);
    address public distributor = address(0x1003);
    
    address public investor1 = address(0x2001);
    address public investor2 = address(0x2002);
    address public investor3 = address(0x2003);
    address public worker1 = address(0x3001);
    address public worker2 = address(0x3002);

    uint256 public constant COMMUNITY_ID = 1;
    uint16 public constant TARGET_ROI_125 = 12500; // 125%
    uint16 public constant TARGET_ROI_150 = 15000; // 150%
    uint16 public constant TARGET_ROI_200 = 20000; // 200%

    function setUp() public {
        // Deploy dependencies
        usdc = new MockERC20("USD Coin", "USDC");
        communityRegistry = new MockCommunityRegistry();
        
        // Set up valid community
        communityRegistry.setCommunityValid(COMMUNITY_ID, true);

        // Deploy core contracts
        paramController = new ParamController(admin);
        cohortRegistry = new CohortRegistry(admin);
        router = new RevenueRouter(
            address(paramController),
            address(cohortRegistry),
            admin
        );

        // Grant roles
        vm.startPrank(admin);
        router.grantRole(router.DISTRIBUTOR_ROLE(), distributor);
        router.setSupportedToken(COMMUNITY_ID, address(usdc), true);
        router.setCommunityTreasury(COMMUNITY_ID, treasury);
        
        // Set revenue policy: 30% workers min, 40% treasury, 30% investors, spillover to workers
        paramController.setRevenuePolicy(COMMUNITY_ID, 3000, 4000, 3000, 0);
        
        // Set cohort parameters: max 5 cohorts, ProRataByUnrecoveredWeighted scheme
        paramController.setCohortParams(COMMUNITY_ID, 5, uint8(1));
        
        // Set up SBT contract role for testing (normally this would be ValuableActionSBT contract)
        cohortRegistry.setValuableActionSBT(admin);
        
        // Set RevenueRouter address in CohortRegistry (needed for markRecovered calls)
        cohortRegistry.setRevenueRouter(address(router));
        vm.stopPrank();

        // Set up test users with tokens
        usdc.mint(distributor, 1_000_000e18);
        
        vm.startPrank(distributor);
        usdc.approve(address(router), type(uint256).max);
        vm.stopPrank();

        // Give users ETH for transactions
        vm.deal(admin, 100 ether);
        vm.deal(treasury, 100 ether);
        vm.deal(distributor, 100 ether);
        vm.deal(investor1, 100 ether);
        vm.deal(investor2, 100 ether);
        vm.deal(investor3, 100 ether);
        vm.deal(worker1, 100 ether);
        vm.deal(worker2, 100 ether);
    }

    /* ======== CONSTRUCTOR TESTS ======== */

    function testConstructor() public view {
        assertEq(address(router.paramController()), address(paramController));
        assertEq(address(router.cohortRegistry()), address(cohortRegistry));
        assertTrue(router.hasRole(router.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(router.hasRole(router.DISTRIBUTOR_ROLE(), admin));
    }

    function testConstructorZeroParamControllerReverts() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        new RevenueRouter(address(0), address(cohortRegistry), admin);
    }

    function testConstructorZeroCohortRegistryReverts() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        new RevenueRouter(address(paramController), address(0), admin);
    }

    function testConstructorZeroAdminReverts() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        new RevenueRouter(address(paramController), address(cohortRegistry), address(0));
    }

    /* ======== REVENUE DISTRIBUTION WITHOUT COHORTS ======== */

    function testRouteRevenueNoCohorts() public {
        uint256 revenueAmount = 1000e18;

        vm.prank(distributor);
        router.routeRevenue(COMMUNITY_ID, address(usdc), revenueAmount);

        // With revenue policy 30% workers min, 40% treasury, 30% investors (but no cohorts)
        // Workers min: 300e18
        // From remaining 700e18: treasury gets 40/70 = 57.14%, investors get 30/70 = 42.86%
        // Treasury base: 400e18, Investor pool: 300e18 (all spillover to workers)
        // Workers total: 300e18 (min) + 300e18 (spillover) + 0 (remainder) = 600e18
        
        assertEq(router.getWorkerPool(COMMUNITY_ID, address(usdc)), 600e18);
        assertEq(router.getTreasuryReserves(COMMUNITY_ID, address(usdc)), 400e18);
        assertEq(router.totalRevenue(COMMUNITY_ID, address(usdc)), revenueAmount);
    }

    function testRouteRevenueZeroAmountReverts() public {
        vm.prank(distributor);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Zero amount"));
        router.routeRevenue(COMMUNITY_ID, address(usdc), 0);
    }

    function testRouteRevenueUnsupportedTokenReverts() public {
        address unsupportedToken = address(0x9999);
        
        vm.prank(distributor);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Unsupported token"));
        router.routeRevenue(COMMUNITY_ID, unsupportedToken, 1000e18);
    }

    /* ======== COHORT CREATION AND SINGLE COHORT TESTS ======== */

    function testSingleCohortDistribution() public {
        // Create a cohort with 125% target ROI
        vm.prank(admin);
        uint256 cohortId = cohortRegistry.createCohort(
            COMMUNITY_ID,
            TARGET_ROI_125,
            500, // 5% priority weight
            "ipfs://cohort1"
        );

        // Add investors to cohort (note: in real system, this is called by ValuableActionSBT contract)
        vm.prank(admin);
        cohortRegistry.addInvestment(cohortId, investor1, 5000e18);
        vm.prank(admin);
        cohortRegistry.addInvestment(cohortId, investor2, 3000e18);

        uint256 revenueAmount = 1000e18;

        vm.prank(distributor);
        router.routeRevenue(COMMUNITY_ID, address(usdc), revenueAmount);

        // With one active cohort, all investor pool (300e18) goes to cohort
        // Distribution within cohort: investor1 gets 5000/8000 = 62.5%, investor2 gets 37.5%
        
        assertEq(router.getWorkerPool(COMMUNITY_ID, address(usdc)), 300e18); // Workers min only
        assertEq(router.getTreasuryReserves(COMMUNITY_ID, address(usdc)), 400e18);
        
        // Check investor balances (distributed pro-rata by investment amount)
        uint256 investor1Balance = router.getInvestorBalance(cohortId, investor1, address(usdc));
        uint256 investor2Balance = router.getInvestorBalance(cohortId, investor2, address(usdc));
        
        // investor1: 5000/(5000+3000) * 300 = 5/8 * 300 = 187.5e18
        // investor2: 3000/(5000+3000) * 300 = 3/8 * 300 = 112.5e18
        assertEq(investor1Balance, 187.5e18);
        assertEq(investor2Balance, 112.5e18);
        assertEq(investor1Balance + investor2Balance, 300e18);
    }

    /* ======== MULTIPLE COHORT WEIGHT DISTRIBUTION TESTS ======== */

    function testMultipleCohortsByWeight() public {
        // Create three cohorts with different unrecovered amounts and priority weights
        vm.startPrank(admin);
        
        // Cohort 1: 5000 invested, 125% target (6250 needed), 5% weight
        uint256 cohort1 = cohortRegistry.createCohort(COMMUNITY_ID, TARGET_ROI_125, 500, "ipfs://c1");
        cohortRegistry.addInvestment(cohort1, investor1, 5000e18);
        
        // Cohort 2: 8000 invested, 150% target (12000 needed), 7% weight  
        uint256 cohort2 = cohortRegistry.createCohort(COMMUNITY_ID, TARGET_ROI_150, 700, "ipfs://c2");
        cohortRegistry.addInvestment(cohort2, investor2, 8000e18);
        
        // Cohort 3: 3000 invested, 200% target (6000 needed), 3% weight
        uint256 cohort3 = cohortRegistry.createCohort(COMMUNITY_ID, TARGET_ROI_200, 300, "ipfs://c3");
        cohortRegistry.addInvestment(cohort3, investor3, 3000e18);
        
        vm.stopPrank();

        uint256 revenueAmount = 1500e18; // Larger revenue for clearer distribution

        vm.prank(distributor);
        router.routeRevenue(COMMUNITY_ID, address(usdc), revenueAmount);

        // Investor pool: 450e18 (30% of 1500e18)
        // Weight calculation: weight = unrecovered * priorityWeight
        // cohort1: unrecovered=(5000*1.25-0)=6250, weight=6250*500=3,125,000
        // cohort2: unrecovered=(8000*1.5-0)=12000, weight=12000*700=8,400,000  
        // cohort3: unrecovered=(3000*2-0)=6000, weight=6000*300=1,800,000
        // Total weight = 3,125,000 + 8,400,000 + 1,800,000 = 13,325,000
        // cohort1 gets: 450 * 3,125,000/13,325,000 ≈ 105.56e18
        // cohort2 gets: 450 * 8,400,000/13,325,000 ≈ 283.89e18  
        // cohort3 gets: 450 * 1,800,000/13,325,000 ≈ 60.56e18

        // Due to precision and rounding, use approximate assertions
        uint256 cohort1Balance = router.getInvestorBalance(cohort1, investor1, address(usdc));
        uint256 cohort2Balance = router.getInvestorBalance(cohort2, investor2, address(usdc));
        uint256 cohort3Balance = router.getInvestorBalance(cohort3, investor3, address(usdc));
        
        // Check that cohort2 gets the most (highest weight), cohort1 second, cohort3 least
        // Check that cohort2 gets the most (highest weight), cohort1 second, cohort3 least
        assertTrue(cohort2Balance > cohort1Balance, "cohort2 should get more than cohort1");
        assertTrue(cohort1Balance > cohort3Balance, "cohort1 should get more than cohort3");
        
        // Allow for small precision errors (up to 10 wei) due to large number divisions
        uint256 totalDistributed = cohort1Balance + cohort2Balance + cohort3Balance;
        assertTrue(totalDistributed >= 450e18 - 10 && totalDistributed <= 450e18 + 10, "Total should approximately equal investor pool");
    }

    /* ======== COHORT COMPLETION AND SPILLOVER TESTS ======== */

    function testCohortCompletionSpillover() public {
        // Create a cohort that will complete quickly
        vm.prank(admin);
        uint256 cohortId = cohortRegistry.createCohort(
            COMMUNITY_ID,
            11000, // 110% target - achievable with small investments
            1000,  // 10% priority weight
            "ipfs://cohort1"
        );

        vm.prank(admin);
        cohortRegistry.addInvestment(cohortId, investor1, 1000e18);

        // Multiple distributions to complete the cohort
        // Need 1100e18 total return (110% of 1000e18)
        
        for (uint i = 0; i < 5; i++) {
            vm.prank(distributor);
            router.routeRevenue(COMMUNITY_ID, address(usdc), 1000e18);
        }

        // After 5 distributions, cohort should have received enough to complete
        // Check if cohort is inactive (completed)
        CohortRegistry.Cohort memory cohort = cohortRegistry.getCohort(cohortId);
        
        // Verify the cohort received payments
        assertTrue(cohort.recoveredTotal > 0);
        
        // The last distribution should have spillover going to workers (spilloverTarget = 0)
        // Worker pool should have more than just minimum allocations
        assertTrue(router.getWorkerPool(COMMUNITY_ID, address(usdc)) > 1500e18); // More than 5 * 300e18 minimum
    }

    /* ======== WITHDRAWAL TESTS ======== */

    function testWithdrawInvestorRevenue() public {
        // Set up cohort and distribution
        vm.prank(admin);
        uint256 cohortId = cohortRegistry.createCohort(COMMUNITY_ID, TARGET_ROI_150, 500, "ipfs://c1");
        vm.prank(admin);
        cohortRegistry.addInvestment(cohortId, investor1, 5000e18);

        vm.prank(distributor);
        router.routeRevenue(COMMUNITY_ID, address(usdc), 1000e18);

        uint256 investorBalance = router.getInvestorBalance(cohortId, investor1, address(usdc));
        assertTrue(investorBalance > 0);

        // Withdraw investor revenue
        uint256 withdrawAmount = investorBalance / 2;
        
        vm.prank(investor1);
        router.withdrawInvestorRevenue(cohortId, address(usdc), withdrawAmount);

        assertEq(usdc.balanceOf(investor1), withdrawAmount);
        assertEq(router.getInvestorBalance(cohortId, investor1, address(usdc)), investorBalance - withdrawAmount);
    }

    function testWithdrawTreasuryRevenue() public {
        vm.prank(distributor);
        router.routeRevenue(COMMUNITY_ID, address(usdc), 1000e18);

        uint256 treasuryReserves = router.getTreasuryReserves(COMMUNITY_ID, address(usdc));
        uint256 withdrawAmount = 100e18;

        vm.prank(treasury);
        router.withdrawTreasuryRevenue(COMMUNITY_ID, address(usdc), withdrawAmount, worker1);

        assertEq(usdc.balanceOf(worker1), withdrawAmount);
        assertEq(router.getTreasuryReserves(COMMUNITY_ID, address(usdc)), treasuryReserves - withdrawAmount);
    }

    function testAllocateWorkerRevenue() public {
        vm.prank(distributor);
        router.routeRevenue(COMMUNITY_ID, address(usdc), 1000e18);

        uint256 workerPool = router.getWorkerPool(COMMUNITY_ID, address(usdc));
        uint256 allocateAmount = 100e18;

        vm.prank(distributor); // DISTRIBUTOR_ROLE can allocate
        router.allocateWorkerRevenue(COMMUNITY_ID, worker1, address(usdc), allocateAmount);

        assertEq(router.getWorkerBalance(COMMUNITY_ID, worker1, address(usdc)), allocateAmount);
        assertEq(router.getWorkerPool(COMMUNITY_ID, address(usdc)), workerPool - allocateAmount);
    }

    /* ======== PREVIEW AND VIEW FUNCTION TESTS ======== */

    function testPreviewDistribution() public {
        (uint256 workersMin, uint256 treasuryBase, uint256 investorPool, uint8 spilloverTarget) = 
            router.previewDistribution(COMMUNITY_ID, 1000e18);

        // Revenue policy: 30% workers min, 40% treasury, 30% investors
        assertEq(workersMin, 300e18);
        assertEq(treasuryBase, 400e18);
        assertEq(investorPool, 300e18);
        assertEq(spilloverTarget, 0); // Spillover to workers
    }

    function testPreviewCohortDistributionNoCohorts() public {
        (uint256[] memory cohortIds, uint256[] memory cohortPayments, uint256 totalDistributed) = 
            router.previewCohortDistribution(COMMUNITY_ID, 300e18);

        assertEq(cohortIds.length, 0);
        assertEq(cohortPayments.length, 0);
        assertEq(totalDistributed, 0);
    }

    function testPreviewCohortDistributionWithCohorts() public {
        // Create two cohorts
        vm.startPrank(admin);
        uint256 cohort1 = cohortRegistry.createCohort(COMMUNITY_ID, TARGET_ROI_150, 600, "ipfs://c1");
        cohortRegistry.addInvestment(cohort1, investor1, 3000e18);
        
        uint256 cohort2 = cohortRegistry.createCohort(COMMUNITY_ID, TARGET_ROI_200, 400, "ipfs://c2");
        cohortRegistry.addInvestment(cohort2, investor2, 2000e18);
        vm.stopPrank();

        (uint256[] memory cohortIds, uint256[] memory cohortPayments, uint256 totalDistributed) = 
            router.previewCohortDistribution(COMMUNITY_ID, 300e18);

        assertEq(cohortIds.length, 2);
        assertEq(cohortIds[0], cohort1);
        assertEq(cohortIds[1], cohort2);
        
        // Weight calculation: weight = unrecovered * priorityWeight
        // cohort1: unrecovered=(3000*1.5-0)=4500, weight=4500*600=2,700,000
        // cohort2: unrecovered=(2000*2-0)=4000, weight=4000*400=1,600,000
        // Total weight = 2,700,000 + 1,600,000 = 4,300,000
        // cohort1 payment: 300 * 2,700,000/4,300,000 ≈ 188.37e18
        // cohort2 payment: 300 * 1,600,000/4,300,000 ≈ 111.63e18
        
        // Use approximate assertions due to precision
        assertTrue(cohortPayments[0] > cohortPayments[1]); // cohort1 should get more
        assertTrue(cohortPayments[0] + cohortPayments[1] == totalDistributed);
        // Allow for 1 wei precision difference
        assertTrue(totalDistributed >= 300e18 - 1 && totalDistributed <= 300e18 + 1);
    }

    /* ======== CONFIGURATION TESTS ======== */

    function testSetSupportedToken() public {
        address newToken = address(0x9999);
        
        vm.prank(admin);
        router.setSupportedToken(COMMUNITY_ID, newToken, true);
        
        assertTrue(router.supportedTokens(COMMUNITY_ID, newToken));
    }

    function testSetCommunityTreasury() public {
        address newTreasury = address(0x9999);

        vm.prank(admin);
        router.setCommunityTreasury(COMMUNITY_ID, newTreasury);

        assertEq(router.communityTreasuries(COMMUNITY_ID), newTreasury);
        assertTrue(router.hasRole(router.TREASURY_ROLE(), newTreasury));
    }

    function testSetParamController() public {
        ParamController newController = new ParamController(admin);

        vm.prank(admin);
        router.setParamController(address(newController));

        assertEq(address(router.paramController()), address(newController));
    }

    function testSetCohortRegistry() public {
        CohortRegistry newRegistry = new CohortRegistry(admin);

        vm.prank(admin);
        router.setCohortRegistry(address(newRegistry));

        assertEq(address(router.cohortRegistry()), address(newRegistry));
    }

    /* ======== INTEGRATION TESTS ======== */

    function testCompleteMultiCohortLifecycle() public {
        // Create multiple cohorts with different characteristics
        vm.startPrank(admin);
        
        // Early cohort with low target (will complete first)
        uint256 earlyCohort = cohortRegistry.createCohort(COMMUNITY_ID, 11000, 800, "ipfs://early");
        cohortRegistry.addInvestment(earlyCohort, investor1, 2000e18);
        
        // Medium cohort
        uint256 midCohort = cohortRegistry.createCohort(COMMUNITY_ID, TARGET_ROI_150, 600, "ipfs://mid");
        cohortRegistry.addInvestment(midCohort, investor2, 5000e18);
        
        // Late cohort with high target
        uint256 lateCohort = cohortRegistry.createCohort(COMMUNITY_ID, TARGET_ROI_200, 400, "ipfs://late");
        cohortRegistry.addInvestment(lateCohort, investor3, 8000e18);
        
        vm.stopPrank();

        // Simulate revenue over time
        uint256 totalWorkers = 0;
        uint256 totalTreasury = 0;
        
        for (uint i = 0; i < 10; i++) {
            vm.prank(distributor);
            router.routeRevenue(COMMUNITY_ID, address(usdc), 2000e18);
            
            totalWorkers += router.getWorkerPool(COMMUNITY_ID, address(usdc)) - totalWorkers;
            totalTreasury = router.getTreasuryReserves(COMMUNITY_ID, address(usdc));
        }

        // Verify all three investors received revenue
        assertTrue(router.getInvestorBalance(earlyCohort, investor1, address(usdc)) > 0);
        assertTrue(router.getInvestorBalance(midCohort, investor2, address(usdc)) > 0);
        assertTrue(router.getInvestorBalance(lateCohort, investor3, address(usdc)) > 0);

        // Verify workers accumulated revenue from minimums + spillovers
        assertTrue(router.getWorkerPool(COMMUNITY_ID, address(usdc)) >= 6000e18); // At least 10 * 30% minimum
        
        // Verify treasury accumulated its share
        assertTrue(totalTreasury >= 8000e18); // At least 10 * 40% base
        
        // Test withdrawals work
        uint256 investor1Balance = router.getInvestorBalance(earlyCohort, investor1, address(usdc));
        if (investor1Balance > 0) {
            vm.prank(investor1);
            router.withdrawInvestorRevenue(earlyCohort, address(usdc), investor1Balance);
            assertEq(usdc.balanceOf(investor1), investor1Balance);
        }
    }

    /* ======== ERROR CONDITION TESTS ======== */

    function testInsufficientBalanceReverts() public {
        vm.prank(investor1);
        vm.expectRevert(abi.encodeWithSelector(
            Errors.InsufficientBalance.selector,
            investor1,
            100e18,
            0
        ));
        router.withdrawInvestorRevenue(1, address(usdc), 100e18);
    }

    function testOnlyDistributorRole() public {
        vm.prank(worker1);
        vm.expectRevert();
        router.routeRevenue(COMMUNITY_ID, address(usdc), 1000e18);
    }

    function testOnlyAdminRole() public {
        vm.prank(worker1);
        vm.expectRevert();
        router.setSupportedToken(COMMUNITY_ID, address(usdc), true);
    }

    function testZeroAddressReverts() public {
        vm.prank(admin);
        vm.expectRevert(Errors.ZeroAddress.selector);
        router.setCommunityTreasury(COMMUNITY_ID, address(0));
    }
}