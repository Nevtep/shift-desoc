// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {RevenueRouter} from "contracts/modules/RevenueRouter.sol";
import {Errors} from "contracts/libs/Errors.sol";
import {IValuableActionSBT} from "contracts/core/interfaces/IValuableActionSBT.sol";
import {Types} from "contracts/libs/Types.sol";

contract ERC20Simple {
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

contract ParamControllerMock2 {
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

contract CohortRegistryMock2 {
    struct CohortData { uint256 communityId; uint256 investedTotal; bool active; }
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
    uint256[] public active;
    mapping(uint256 => CohortData) public cohorts;
    mapping(uint256 => uint256) public tokenWeight;

    function setActive(uint256[] memory ids) external { active = ids; }
    function setCohort(uint256 id, uint256 communityId, uint256 investedTotal, bool isActive) external {
        cohorts[id] = CohortData(communityId, investedTotal, isActive);
    }
    function setInvestmentWeight(uint256 tokenId, uint256 weight) external { tokenWeight[tokenId] = weight; }

    function getActiveCohorts(uint256) external view returns (uint256[] memory) { return active; }
    function getCohort(uint256 cohortId) external view returns (Cohort memory c) {
        CohortData memory data = cohorts[cohortId];
        c.id = cohortId; c.communityId = data.communityId; c.investedTotal = data.investedTotal; c.active = data.active;
    }
    function isCohortActive(uint256 cohortId) external view returns (bool) { return cohorts[cohortId].active; }
    function getCohortCommunity(uint256 cohortId) external view returns (uint256) { return cohorts[cohortId].communityId; }
    function getInvestmentAmountByToken(uint256 tokenId) external view returns (uint256) { return tokenWeight[tokenId]; }
}

contract SBTMock is IValuableActionSBT {
    mapping(uint256 => TokenData) private data;
    mapping(uint256 => address) private owners;
    uint256 public nextId = 1;

    function mintInvestment(address to, uint256 communityId, uint256 cohortId, uint32 weight) external returns (uint256 tokenId) {
        tokenId = _mintInvestment(to, communityId, cohortId, weight);
    }

    function getTokenData(uint256 tokenId) external view returns (TokenData memory) { return data[tokenId]; }
    function ownerOf(uint256 tokenId) external view returns (address) { return owners[tokenId]; }

    // Unused interface
    function mintEngagement(address, uint256, Types.EngagementSubtype, bytes32, bytes calldata) external pure returns (uint256) { revert("unused"); }
    function mintPosition(address, uint256, bytes32, uint32, bytes calldata) external pure returns (uint256) { revert("unused"); }
    function mintInvestment(address, uint256, uint32, bytes calldata) external pure returns (uint256) { revert("unused"); }
    function mintInvestment(address to, uint256 communityId, uint256 cohortId, uint32 weight, bytes calldata) external returns (uint256 tokenId) {
        tokenId = _mintInvestment(to, communityId, cohortId, weight);
    }
    function mintRoleFromPosition(address, uint256, bytes32, uint32, uint64, uint64, uint8, bytes calldata) external pure returns (uint256) { revert("unused"); }
    function setEndedAt(uint256, uint64) external pure { revert("unused"); }
    function closePositionToken(uint256, uint8) external pure { revert("unused"); }

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
}

contract RevenueRouterCohortTest is Test {
    RevenueRouter public router;
    ParamControllerMock2 public paramController;
    CohortRegistryMock2 public cohorts;
    SBTMock public sbt;
    ERC20Simple public token;

    address public admin = address(this);
    address public treasury = address(0xCAFE);
    address public distributor = address(0xDD);
    address public investor = address(0xAB);
    address public investorB = address(0xAC);

    uint256 public constant COMMUNITY_ID = 1;

    function setUp() public {
        paramController = new ParamControllerMock2();
        cohorts = new CohortRegistryMock2();
        sbt = new SBTMock();
        token = new ERC20Simple();

        router = new RevenueRouter(address(paramController), address(cohorts), address(sbt), admin);
        router.setCommunityTreasury(COMMUNITY_ID, treasury);
        router.setSupportedToken(COMMUNITY_ID, address(token), true);
        router.grantRole(router.DISTRIBUTOR_ROLE(), distributor);
    }

    function testDistributeToCohortsProRata() public {
        paramController.setRevenuePolicy(COMMUNITY_ID, 1000, 0, 1, 0); // 10% treasury, spill to treasury

        cohorts.setActive(_arr(1, 2));
        cohorts.setCohort(1, COMMUNITY_ID, 1000e18, true);
        cohorts.setCohort(2, COMMUNITY_ID, 3000e18, true);

        uint256 investment1 = sbt.mintInvestment(investor, COMMUNITY_ID, 1, 0);
        uint256 investment2 = sbt.mintInvestment(investorB, COMMUNITY_ID, 2, 0);
        cohorts.setInvestmentWeight(investment1, 1000e18);
        cohorts.setInvestmentWeight(investment2, 3000e18);

        token.mint(distributor, 1_000e18);
        vm.startPrank(distributor);
        token.approve(address(router), type(uint256).max);
        router.routeRevenue(COMMUNITY_ID, address(token), 1_000e18);
        vm.stopPrank();

        // Treasury gets min 10%
        assertEq(router.treasuryAccrual(COMMUNITY_ID, address(token)), 100e18);

        // Remaining 900 split 1:3 -> 225 and 675 via indices
        uint256 claimable1 = router.getClaimableInvestment(investment1, address(token));
        uint256 claimable2 = router.getClaimableInvestment(investment2, address(token));

        assertEq(claimable1, 225e18);
        assertEq(claimable2, 675e18);

        vm.prank(investor);
        router.claimInvestment(investment1, address(token), investor);
        vm.prank(investorB);
        router.claimInvestment(investment2, address(token), investorB);

        assertEq(token.balanceOf(investor), 225e18);
        assertEq(token.balanceOf(investorB), 675e18);
    }

    function testUnsupportedTokenReverts() public {
        paramController.setRevenuePolicy(COMMUNITY_ID, 1000, 0, 1, 0);
        vm.prank(distributor);
        token.approve(address(router), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Unsupported token"));
        router.routeRevenue(COMMUNITY_ID, address(0xDEAD), 1);
    }

    function testInactiveCohortsDoNotReceiveRevenue() public {
        paramController.setRevenuePolicy(COMMUNITY_ID, 0, 0, 1, 0);

        cohorts.setActive(_arr(1, 2));
        cohorts.setCohort(1, COMMUNITY_ID, 1_000e18, false); // inactive
        cohorts.setCohort(2, COMMUNITY_ID, 2_000e18, false); // inactive

        uint256 investment = sbt.mintInvestment(investor, COMMUNITY_ID, 1, 0);
        cohorts.setInvestmentWeight(investment, 1_000e18);

        token.mint(distributor, 500e18);
        vm.startPrank(distributor);
        token.approve(address(router), type(uint256).max);
        router.routeRevenue(COMMUNITY_ID, address(token), 500e18);
        vm.stopPrank();

        assertEq(router.treasuryAccrual(COMMUNITY_ID, address(token)), 500e18);
        assertEq(router.getClaimableInvestment(investment, address(token)), 0);
    }

    function testClaimInvestmentRequiresOwner() public {
        paramController.setRevenuePolicy(COMMUNITY_ID, 0, 0, 1, 0);

        cohorts.setActive(_arr(1, 1));
        cohorts.setCohort(1, COMMUNITY_ID, 1_000e18, true);

        uint256 investment = sbt.mintInvestment(investor, COMMUNITY_ID, 1, 0);
        cohorts.setInvestmentWeight(investment, 1_000e18);

        token.mint(distributor, 100e18);
        vm.startPrank(distributor);
        token.approve(address(router), type(uint256).max);
        router.routeRevenue(COMMUNITY_ID, address(token), 100e18);
        vm.stopPrank();

        address other = address(0xEEE);
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, other));
        vm.prank(other);
        router.claimInvestment(investment, address(token), other);
    }

    function _arr(uint256 a, uint256 b) internal pure returns (uint256[] memory out) {
        out = new uint256[](2);
        out[0] = a;
        out[1] = b;
    }
}
