// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ParamController} from "contracts/modules/ParamController.sol";
import {CommunityRegistry} from "contracts/modules/CommunityRegistry.sol";
import {ValuableActionRegistry} from "contracts/modules/ValuableActionRegistry.sol";
import {ValuableActionSBT} from "contracts/modules/ValuableActionSBT.sol";
import {RevenueRouter} from "contracts/modules/RevenueRouter.sol";
import {CohortRegistry} from "contracts/modules/CohortRegistry.sol";
import {PositionManager} from "contracts/modules/PositionManager.sol";
import {InvestmentCohortManager} from "contracts/modules/InvestmentCohortManager.sol";
import {RequestHub} from "contracts/modules/RequestHub.sol";
import {CredentialManager} from "contracts/modules/CredentialManager.sol";
import {Types} from "contracts/libs/Types.sol";

contract ERC20Mock {
    string public name = "Mock";
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

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
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

    function _transfer(address from, address to, uint256 amount) internal {
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}

contract TreasuryAdapterMock {
    event Payout(address token, uint256 amount, address to);

    function payoutBounty(address token, uint256 amount, address to) external {
        ERC20Mock(token).transfer(to, amount);
        emit Payout(token, amount, to);
    }
}

contract WiringTest is Test {
    ParamController paramController;
    CommunityRegistry communityRegistry;
    ValuableActionRegistry valuableActionRegistry;
    ValuableActionSBT sbt;
    RevenueRouter router;
    CohortRegistry cohortRegistry;
    PositionManager positionManager;
    InvestmentCohortManager investmentManager;
    RequestHub requestHub;
    CredentialManager credentialManager;

    ERC20Mock token;
    TreasuryAdapterMock treasuryAdapter;

    address governance = address(this);
    address distributor = address(0xD1);
    address positionHolder = address(0xAA);
    address investor = address(0xB0);
    address credentialApplicant = address(0xC0);
    address requestWinner = address(0xE0);
    address treasury = address(0xF0);

    uint256 communityId;
    uint256 valuableActionId;

    bytes32 constant ROLE_TYPE = bytes32("role:ops");
    bytes32 constant COURSE_ID = bytes32("course:alpha");
    bytes32 constant PROPOSAL_REF = bytes32("proposal-ref");

    function setUp() public {
        token = new ERC20Mock();
        treasuryAdapter = new TreasuryAdapterMock();

        paramController = new ParamController(governance);
        communityRegistry = new CommunityRegistry(governance, address(paramController));
        valuableActionRegistry = new ValuableActionRegistry(governance, address(communityRegistry));
        sbt = new ValuableActionSBT(governance, governance, governance);
        cohortRegistry = new CohortRegistry(governance);
        router = new RevenueRouter(address(paramController), address(cohortRegistry), address(sbt), governance);
        positionManager = new PositionManager(governance, address(valuableActionRegistry), address(sbt));
        investmentManager = new InvestmentCohortManager(
            governance,
            address(cohortRegistry),
            address(valuableActionRegistry),
            address(sbt)
        );
        requestHub = new RequestHub(address(communityRegistry), address(valuableActionRegistry), address(treasuryAdapter));
        credentialManager = new CredentialManager(governance, address(valuableActionRegistry), address(sbt));

        communityId = communityRegistry.registerCommunity("Comm", "Desc", "ipfs://meta", 0);

        communityRegistry.setModuleAddress(communityId, keccak256("governor"), governance);
        communityRegistry.setModuleAddress(communityId, keccak256("timelock"), governance);
        communityRegistry.setModuleAddress(communityId, keccak256("valuableActionRegistry"), address(valuableActionRegistry));

        // Wire SBT manager + issuance allowlists
        vm.startPrank(governance);
        valuableActionRegistry.setValuableActionSBT(address(sbt));
        sbt.grantRole(sbt.MANAGER_ROLE(), address(valuableActionRegistry));
        sbt.grantRole(sbt.MANAGER_ROLE(), address(credentialManager));
        valuableActionRegistry.setIssuanceModule(address(positionManager), true);
        valuableActionRegistry.setIssuanceModule(address(investmentManager), true);
        valuableActionRegistry.setIssuanceModule(address(requestHub), true);
        valuableActionRegistry.setIssuanceModule(address(credentialManager), true);
        valuableActionRegistry.setModerator(governance, true);
        vm.stopPrank();

        // Revenue policy + router wiring
        paramController.setRevenuePolicy(communityId, 1000, 0, 0, 0); // 10% treasury, spillover to positions
        router.setCommunityTreasury(communityId, treasury);
        router.setSupportedToken(communityId, address(token), true);
        router.grantRole(router.POSITION_MANAGER_ROLE(), address(positionManager));
        router.grantRole(router.DISTRIBUTOR_ROLE(), distributor);
        positionManager.setRevenueRouter(address(router));

        // Cohort registry wiring
        cohortRegistry.setRevenueRouter(address(router));
        cohortRegistry.setValuableActionSBT(address(sbt));
        cohortRegistry.setInvestmentManager(address(investmentManager));

        // Position type setup
        vm.prank(governance);
        positionManager.definePositionType(ROLE_TYPE, communityId, 10, true);

        // Valuable action for RequestHub one-shot
        Types.ValuableAction memory action = Types.ValuableAction({
            membershipTokenReward: 1,
            communityTokenReward: 0,
            investorSBTReward: 0,
            category: Types.ActionCategory.ENGAGEMENT_ONE_SHOT,
            roleTypeId: bytes32(0),
            positionPoints: 0,
            verifierPolicy: Types.VerifierPolicy.JURY,
            metadataSchemaId: bytes32("schema"),
            jurorsMin: 1,
            panelSize: 1,
            verifyWindow: 1 days,
            verifierRewardWeight: 0,
            slashVerifierBps: 0,
            cooldownPeriod: 1,
            maxConcurrent: 1,
            revocable: true,
            evidenceTypes: 1,
            proposalThreshold: 0,
            proposer: governance,
            evidenceSpecCID: "cid",
            titleTemplate: "title",
            automationRules: new bytes32[](0),
            activationDelay: 0,
            deprecationWarning: 0
        });

        vm.startPrank(governance);
        valuableActionId = valuableActionRegistry.proposeValuableAction(communityId, action, PROPOSAL_REF);
        valuableActionRegistry.activateFromGovernance(valuableActionId, PROPOSAL_REF);
        communityRegistry.grantCommunityRole(communityId, governance, communityRegistry.MODERATOR_ROLE());
        vm.stopPrank();
    }

    function testWiringEndToEnd() public {
        // ---- Position flow ----
        vm.prank(positionHolder);
        uint256 appId = positionManager.applyForPosition(ROLE_TYPE, bytes("evidence"));

        vm.prank(governance);
        uint256 positionTokenId = positionManager.approveApplication(appId, bytes("metadata"));

        token.mint(distributor, 1_000e18);
        vm.startPrank(distributor);
        token.approve(address(router), type(uint256).max);
        router.routeRevenue(communityId, address(token), 1_000e18);
        vm.stopPrank();

        uint256 claimablePosition = router.getClaimablePosition(positionTokenId, address(token));
        assertEq(claimablePosition, 900e18); // 10% treasury, rest to positions

        vm.prank(positionHolder);
        router.claimPosition(positionTokenId, address(token), positionHolder);
        assertEq(token.balanceOf(positionHolder), 900e18);

        vm.prank(governance);
        positionManager.closePosition(positionTokenId, PositionManager.CloseOutcome.SUCCESS, bytes("role"));

        token.mint(distributor, 1_000e18);
        vm.prank(distributor);
        router.routeRevenue(communityId, address(token), 1_000e18);

        assertEq(router.getClaimablePosition(positionTokenId, address(token)), 0);
        assertEq(router.treasuryAccrual(communityId, address(token)), 1_100e18);
        assertFalse(router.positionRegistered(positionTokenId));

        // ---- Investment flow ----
        vm.prank(governance);
        uint256 cohortId = investmentManager.createCohort(
            communityId,
            15000,
            1,
            bytes32("terms"),
            0,
            0,
            true
        );

        vm.prank(governance);
        uint256 investmentTokenId = investmentManager.issueInvestment(investor, cohortId, 1_000, bytes("meta"));

        token.mint(distributor, 1_000e18);
        vm.startPrank(distributor);
        token.approve(address(router), type(uint256).max);
        router.routeRevenue(communityId, address(token), 1_000e18);
        vm.stopPrank();

        uint256 claimableInvestment = router.getClaimableInvestment(investmentTokenId, address(token));
        assertEq(claimableInvestment, 900e18);

        vm.prank(investor);
        router.claimInvestment(investmentTokenId, address(token), investor);
        assertEq(token.balanceOf(investor), 900e18);

        // ---- RequestHub one-shot ----
        vm.prank(governance);
        uint256 requestId = requestHub.createRequest(communityId, "title", "cid", new string[](0));
        requestHub.linkValuableAction(requestId, valuableActionId);
        requestHub.addBounty(requestId, address(token), 100e18);

        token.mint(address(treasuryAdapter), 100e18);

        requestHub.setApprovedWinner(requestId, requestWinner);

        vm.prank(requestWinner);
        requestHub.completeEngagement(requestId, bytes("meta"));
        assertEq(token.balanceOf(requestWinner), 100e18);
        assertEq(router.treasuryAccrual(communityId, address(token)), 1_200e18); // unchanged by RequestHub

        // ---- Credential flow ----
        vm.prank(governance);
        credentialManager.defineCourse(COURSE_ID, communityId, governance, true);

        vm.prank(credentialApplicant);
        uint256 credAppId = credentialManager.applyForCredential(COURSE_ID, bytes("evidence"));

        vm.prank(governance);
        uint256 credentialTokenId = credentialManager.approveApplication(credAppId);
        assertGt(credentialTokenId, 0);

        // Revoke credential and ensure router state untouched
        vm.prank(governance);
        credentialManager.revokeCredential(credentialTokenId, COURSE_ID, bytes("reason"));

        assertEq(router.treasuryAccrual(communityId, address(token)), 1_200e18);
        assertEq(router.getClaimableInvestment(investmentTokenId, address(token)), 0);
    }
}
