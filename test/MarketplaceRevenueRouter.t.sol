// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {Marketplace} from "contracts/modules/Marketplace.sol";
import {RevenueRouter} from "contracts/modules/RevenueRouter.sol";
import {Errors} from "contracts/libs/Errors.sol";
import {Roles} from "contracts/libs/Roles.sol";
import {IValuableActionSBT} from "contracts/core/interfaces/IValuableActionSBT.sol";
import {Types} from "contracts/libs/Types.sol";

contract MockERC20 {
    string public name = "MockToken";
    string public symbol = "MOCK";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        _transfer(from, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}

contract ParamControllerMock {
    uint16 public minTreasuryBps;
    uint16 public minPositionsBps;
    uint8 public spilloverTarget;
    uint16 public splitBps;

    function setRevenuePolicy(uint256, uint16 _treasury, uint16 _positions, uint8 _target, uint16 _split) external {
        minTreasuryBps = _treasury;
        minPositionsBps = _positions;
        spilloverTarget = _target;
        splitBps = _split;
    }

    function getRevenuePolicy(uint256) external view returns (uint16, uint16, uint8, uint16) {
        return (minTreasuryBps, minPositionsBps, spilloverTarget, splitBps);
    }
}

contract CohortRegistryMock {
    struct CohortData {
        uint256 communityId;
        uint256 investedTotal;
        bool active;
    }

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

    uint256[] public activeCohorts;
    mapping(uint256 => CohortData) public cohorts;
    mapping(uint256 => uint256) public tokenWeight;

    function setActiveCohorts(uint256[] memory ids) external {
        activeCohorts = ids;
    }

    function setCohort(uint256 id, uint256 communityId, uint256 investedTotal, bool active) external {
        cohorts[id] = CohortData(communityId, investedTotal, active);
    }

    function setInvestmentWeight(uint256 tokenId, uint256 weight) external {
        tokenWeight[tokenId] = weight;
    }

    function getActiveCohorts() external view returns (uint256[] memory) {
        return activeCohorts;
    }

    function getCohort(uint256 cohortId) external view returns (Cohort memory cohort) {
        CohortData memory data = cohorts[cohortId];
        cohort.id = cohortId;
        cohort.communityId = data.communityId;
        cohort.investedTotal = data.investedTotal;
        cohort.active = data.active;
    }

    function isCohortActive(uint256 cohortId) external view returns (bool) {
        return cohorts[cohortId].active;
    }

    function getCohortCommunity(uint256 cohortId) external view returns (uint256) {
        return cohorts[cohortId].communityId;
    }

    function getInvestmentAmountByToken(uint256 tokenId) external view returns (uint256) {
        return tokenWeight[tokenId];
    }
}

contract ValuableActionSBTMock is IValuableActionSBT {
    mapping(uint256 => TokenData) private data;
    mapping(uint256 => address) private owners;
    uint256 public nextId = 1;

    function mintPosition(address to, uint256 communityId, uint32 points) external returns (uint256 tokenId) {
        tokenId = nextId++;
        owners[tokenId] = to;
        data[tokenId] = TokenData({
            kind: TokenKind.POSITION,
            communityId: communityId,
            actionTypeId: bytes32(0),
            roleTypeId: bytes32(0),
            cohortId: 0,
            points: points,
            weight: 0,
            issuedAt: 0,
            endedAt: 0,
            expiry: 0,
            closeOutcome: 0,
            verifier: address(0)
        });
    }

    function setEndedAtMock(uint256 tokenId, uint64 endedAt) external {
        data[tokenId].endedAt = endedAt;
    }

    // Interface compliance
    function mintEngagement(address, Types.EngagementSubtype, bytes32, bytes calldata) external pure returns (uint256) { revert("unused"); }
    function mintPosition(address, bytes32, uint32, bytes calldata) external pure returns (uint256) { revert("unused"); }
    function mintInvestment(address to, uint256 cohortId, uint32 weight, bytes calldata) external returns (uint256 tokenId) {
        uint256 localCommunityId = 1;
        tokenId = _mintInvestment(to, localCommunityId, cohortId, weight);
    }
    function mintRoleFromPosition(address, bytes32, uint32, uint64, uint64, uint8, bytes calldata) external pure returns (uint256) { revert("unused"); }
    function setEndedAt(uint256, uint64) external pure { revert("unused"); }
    function closePositionToken(uint256, uint8) external pure { revert("unused"); }

    // Legacy helper kept for local tests that still pass explicit communityId.
    function mintInvestment(address to, uint256 communityId, uint256 cohortId, uint32 weight, bytes calldata) external returns (uint256 tokenId) {
        tokenId = _mintInvestment(to, communityId, cohortId, weight);
    }

    function mintInvestment(address to, uint256 communityId, uint256 cohortId, uint32 weight) external returns (uint256 tokenId) {
        tokenId = _mintInvestment(to, communityId, cohortId, weight);
    }

    function _mintInvestment(address to, uint256 communityId, uint256 cohortId, uint32 weight) private returns (uint256 tokenId) {
        tokenId = nextId++;
        owners[tokenId] = to;
        data[tokenId] = TokenData({
            kind: TokenKind.INVESTMENT,
            communityId: communityId,
            actionTypeId: bytes32(0),
            roleTypeId: bytes32(0),
            cohortId: cohortId,
            points: 0,
            weight: weight,
            issuedAt: 0,
            endedAt: 0,
            expiry: 0,
            closeOutcome: 0,
            verifier: address(0)
        });
    }

    function getTokenData(uint256 tokenId) external view returns (TokenData memory) {
        return data[tokenId];
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        return owners[tokenId];
    }
}

contract MarketplaceRevenueRouterTest is Test {
    RevenueRouter public router;
    AccessManager public accessManager;
    ParamControllerMock public paramController;
    CohortRegistryMock public cohortRegistry;
    ValuableActionSBTMock public sbt;
    MockERC20 public token;

    address public admin = address(this);
    address public treasury = address(0xBEEF);
    address public distributor = address(0xD1);
    address public positionHolder = address(0xAA);

    uint256 public constant COMMUNITY_ID = 1;

    function setUp() public {
        paramController = new ParamControllerMock();
        cohortRegistry = new CohortRegistryMock();
        sbt = new ValuableActionSBTMock();
        token = new MockERC20();

        accessManager = new AccessManager(admin);
        router = new RevenueRouter(address(accessManager), address(paramController), address(cohortRegistry), address(sbt), COMMUNITY_ID);

        vm.startPrank(admin, admin);
        bytes4[] memory adminSelectors = new bytes4[](4);
        adminSelectors[0] = router.setCommunityTreasury.selector;
        adminSelectors[1] = router.setSupportedToken.selector;
        adminSelectors[2] = router.setParamController.selector;
        adminSelectors[3] = router.setCohortRegistry.selector;
        accessManager.setTargetFunctionRole(address(router), adminSelectors, accessManager.ADMIN_ROLE());

        bytes4[] memory distributorSelectors = new bytes4[](1);
        distributorSelectors[0] = router.routeRevenue.selector;
        accessManager.setTargetFunctionRole(address(router), distributorSelectors, Roles.REVENUE_ROUTER_DISTRIBUTOR_ROLE);

        bytes4[] memory positionSelectors = new bytes4[](2);
        positionSelectors[0] = router.registerPosition.selector;
        positionSelectors[1] = router.unregisterPosition.selector;
        accessManager.setTargetFunctionRole(address(router), positionSelectors, Roles.REVENUE_ROUTER_POSITION_MANAGER_ROLE);

        accessManager.grantRole(accessManager.ADMIN_ROLE(), admin, 0); // ensure admin can call setup
        accessManager.grantRole(Roles.REVENUE_ROUTER_DISTRIBUTOR_ROLE, distributor, 0);
        accessManager.grantRole(Roles.REVENUE_ROUTER_POSITION_MANAGER_ROLE, admin, 0);
        vm.stopPrank();

        router.setCommunityTreasury(COMMUNITY_ID, treasury);
        router.setSupportedToken(COMMUNITY_ID, address(token), true);

        token.mint(distributor, 1_000e18);
    }

    function testRouteRevenueAccruesPositions() public {
        paramController.setRevenuePolicy(COMMUNITY_ID, 2000, 3000, 0, 0); // 20% treasury, 30% positions, spill to positions

        uint256 positionId = sbt.mintPosition(positionHolder, COMMUNITY_ID, 100);
        router.registerPosition(positionId);

        vm.startPrank(distributor, distributor);
        token.approve(address(router), type(uint256).max);
        router.routeRevenue(COMMUNITY_ID, address(token), 1_000e18);
        vm.stopPrank();

        uint256 claimable = router.getClaimablePosition(positionId, address(token));
        assertEq(claimable, 800e18); // 300e18 min positions + 700e18 spillover

        vm.prank(positionHolder);
        router.claimPosition(positionId, address(token), positionHolder);
        assertEq(token.balanceOf(positionHolder), 800e18);

        assertEq(router.treasuryAccrual(COMMUNITY_ID, address(token)), 200e18); // min treasury
    }

    function testRegisterPositionRejectsEndedToken() public {
        uint256 positionId = sbt.mintPosition(positionHolder, COMMUNITY_ID, 100);
        sbt.setEndedAtMock(positionId, 1);

        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Position ended"));
        router.registerPosition(positionId);
    }

    function testClaimPositionRequiresOwnerAndIsIdempotent() public {
        paramController.setRevenuePolicy(COMMUNITY_ID, 0, 3000, 1, 0);

        uint256 positionId = sbt.mintPosition(positionHolder, COMMUNITY_ID, 100);
        router.registerPosition(positionId);

        vm.startPrank(distributor, distributor);
        token.approve(address(router), type(uint256).max);
        router.routeRevenue(COMMUNITY_ID, address(token), 1_000e18);
        vm.stopPrank();

        address other = address(0xBB);
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, other));
        vm.prank(other);
        router.claimPosition(positionId, address(token), other);

        vm.prank(positionHolder);
        router.claimPosition(positionId, address(token), positionHolder);
        assertGt(token.balanceOf(positionHolder), 0);

        uint256 before = token.balanceOf(positionHolder);
        vm.prank(positionHolder);
        router.claimPosition(positionId, address(token), positionHolder);
        assertEq(token.balanceOf(positionHolder), before);
    }

    function testSpilloverToTreasuryWhenNoPositions() public {
        paramController.setRevenuePolicy(COMMUNITY_ID, 0, 3000, 1, 0); // min positions with treasury spillover

        vm.startPrank(distributor, distributor);
        token.approve(address(router), type(uint256).max);
        router.routeRevenue(COMMUNITY_ID, address(token), 1_000e18);
        vm.stopPrank();

        assertEq(router.treasuryAccrual(COMMUNITY_ID, address(token)), 1_000e18);
    }

    function testWithdrawTreasuryAuthAndBalance() public {
        paramController.setRevenuePolicy(COMMUNITY_ID, 1000, 0, 1, 0);

        vm.startPrank(distributor, distributor);
        token.approve(address(router), type(uint256).max);
        router.routeRevenue(COMMUNITY_ID, address(token), 1_000e18);
        vm.stopPrank();

        address payout = address(0xFEED);
        vm.prank(treasury);
        router.withdrawTreasury(COMMUNITY_ID, address(token), 500e18, payout);

        assertEq(token.balanceOf(payout), 500e18);
        assertEq(router.treasuryAccrual(COMMUNITY_ID, address(token)), 500e18);

        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, distributor));
        vm.prank(distributor);
        router.withdrawTreasury(COMMUNITY_ID, address(token), 1, distributor);
    }

    function testSpilloverSplitDefaultsToHalf() public {
        paramController.setRevenuePolicy(COMMUNITY_ID, 1000, 0, 2, 0); // split with default 50/50

        uint256 positionId = sbt.mintPosition(positionHolder, COMMUNITY_ID, 100);
        router.registerPosition(positionId);

        vm.startPrank(distributor, distributor);
        token.approve(address(router), type(uint256).max);
        router.routeRevenue(COMMUNITY_ID, address(token), 1_000e18);
        vm.stopPrank();

        // Treasury: 10% min = 100, plus half of remaining 900 -> 450 => 550 total
        assertEq(router.treasuryAccrual(COMMUNITY_ID, address(token)), 550e18);

        // Positions: half of remaining 900 => 450 claimable
        uint256 claimable = router.getClaimablePosition(positionId, address(token));
        assertEq(claimable, 450e18);
    }

    function testRouteRevenueZeroAmountReverts() public {
        paramController.setRevenuePolicy(COMMUNITY_ID, 2000, 0, 1, 0);
        vm.startPrank(distributor, distributor);
        token.approve(address(router), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Zero amount"));
        router.routeRevenue(COMMUNITY_ID, address(token), 0);
        vm.stopPrank();
    }
}

contract MarketplaceSettlementRegressionTest is Test {
    AccessManager public accessManager;
    Marketplace public marketplace;
    RevenueRouter public router;
    ParamControllerMock public paramController;
    CohortRegistryMock public cohortRegistry;
    ValuableActionSBTMock public sbt;
    MockERC20 public token;

    address public admin = address(this);
    address public seller = address(0x1111);
    address public buyer = address(0x2222);
    address public treasury = address(0x3333);

    uint256 public constant COMMUNITY_ID = 1;

    function setUp() public {
        paramController = new ParamControllerMock();
        cohortRegistry = new CohortRegistryMock();
        sbt = new ValuableActionSBTMock();
        token = new MockERC20();

        accessManager = new AccessManager(admin);
        router = new RevenueRouter(address(accessManager), address(paramController), address(cohortRegistry), address(sbt), COMMUNITY_ID);
        marketplace = new Marketplace(address(accessManager), address(0), address(router), COMMUNITY_ID);

        vm.startPrank(admin, admin);

        bytes4[] memory routerAdminSelectors = new bytes4[](2);
        routerAdminSelectors[0] = router.setCommunityTreasury.selector;
        routerAdminSelectors[1] = router.setSupportedToken.selector;
        accessManager.setTargetFunctionRole(address(router), routerAdminSelectors, accessManager.ADMIN_ROLE());

        bytes4[] memory routerDistributorSelectors = new bytes4[](1);
        routerDistributorSelectors[0] = router.routeRevenue.selector;
        accessManager.setTargetFunctionRole(
            address(router), routerDistributorSelectors, Roles.REVENUE_ROUTER_DISTRIBUTOR_ROLE
        );

        bytes4[] memory marketplaceAdminSelectors = new bytes4[](2);
        marketplaceAdminSelectors[0] = marketplace.setCommunityActive.selector;
        marketplaceAdminSelectors[1] = marketplace.setCommunityToken.selector;
        accessManager.setTargetFunctionRole(address(marketplace), marketplaceAdminSelectors, accessManager.ADMIN_ROLE());

        accessManager.grantRole(Roles.REVENUE_ROUTER_DISTRIBUTOR_ROLE, address(marketplace), 0);
        vm.stopPrank();

        marketplace.setCommunityActive(COMMUNITY_ID, true);
        marketplace.setCommunityToken(COMMUNITY_ID, address(0xCAFE));
        router.setCommunityTreasury(COMMUNITY_ID, treasury);

        token.mint(buyer, 1_000e18);
        vm.prank(buyer);
        token.approve(address(marketplace), type(uint256).max);

        paramController.setRevenuePolicy(COMMUNITY_ID, 10_000, 0, 1, 0);
    }

    function _createGenericOffer() internal returns (uint256 offerId) {
        vm.prank(seller);
        offerId = marketplace.createOffer(
            COMMUNITY_ID,
            Marketplace.OfferKind.GENERIC,
            address(0),
            0,
            100e18,
            address(token),
            false,
            true,
            0,
            address(token),
            0,
            "ipfs://offer"
        );
    }

    function testSettleRoutesWhenTokenSupported() public {
        router.setSupportedToken(COMMUNITY_ID, address(token), true);

        uint256 offerId = _createGenericOffer();

        vm.prank(buyer);
        uint256 orderId = marketplace.purchase(offerId, address(token), "");

        vm.prank(seller);
        marketplace.markOrderFulfilled(orderId);

        vm.warp(block.timestamp + 3 days + 1);

        vm.prank(seller);
        marketplace.settleOrder(orderId);

        Marketplace.Order memory order = marketplace.getOrder(orderId);
        assertEq(uint8(order.status), uint8(Marketplace.OrderStatus.SETTLED));
        assertEq(token.balanceOf(address(marketplace)), 0);
        assertEq(router.treasuryAccrual(COMMUNITY_ID, address(token)), order.amount);
        assertEq(token.balanceOf(seller), 0);
    }

    function testSettleFallsBackWhenTokenUnsupported() public {
        uint256 offerId = _createGenericOffer();

        vm.prank(buyer);
        uint256 orderId = marketplace.purchase(offerId, address(token), "");

        vm.prank(seller);
        marketplace.markOrderFulfilled(orderId);

        vm.warp(block.timestamp + 3 days + 1);

        uint256 sellerBefore = token.balanceOf(seller);
        vm.prank(seller);
        marketplace.settleOrder(orderId);

        Marketplace.Order memory order = marketplace.getOrder(orderId);
        assertEq(uint8(order.status), uint8(Marketplace.OrderStatus.SETTLED));
        assertEq(token.balanceOf(seller), sellerBefore + order.amount);
        assertEq(router.treasuryAccrual(COMMUNITY_ID, address(token)), 0);
    }
}
