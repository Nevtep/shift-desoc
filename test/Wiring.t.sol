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
import {MembershipTokenERC20Votes} from "contracts/tokens/MembershipTokenERC20Votes.sol";
import {ShiftGovernor} from "contracts/core/ShiftGovernor.sol";
import {Types} from "contracts/libs/Types.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {Roles} from "contracts/libs/Roles.sol";

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
    MembershipTokenERC20Votes membershipToken;
    ShiftGovernor governorContract;
    AccessManager accessManager;

    ERC20Mock token;

    address governance = address(this);
    address distributor = address(0xD1);
    address positionHolder = address(0xAA);
    address investor = address(0xB0);
    address credentialApplicant = address(0xC0);
    address requestWinner = address(0xE0);
    address treasury = address(0xF0);

    uint256 communityId;
    uint256 communityIdTwo;
    uint256 valuableActionId;

    bytes32 constant ROLE_TYPE = bytes32("role:ops");
    bytes32 constant COURSE_ID = bytes32("course:alpha");
    bytes32 constant PROPOSAL_REF = bytes32("proposal-ref");

    function setUp() public {
        token = new ERC20Mock();

        paramController = new ParamController(governance);
        communityRegistry = new CommunityRegistry(address(paramController));
        paramController.setCommunityRegistry(address(communityRegistry));
        communityId = communityRegistry.registerCommunity("Comm", "Desc", "ipfs://meta", 0);
        communityIdTwo = communityRegistry.registerCommunity("Comm 2", "Desc 2", "ipfs://meta-2", 0);
        accessManager = new AccessManager(governance);
        membershipToken = new MembershipTokenERC20Votes("Membership", "MEM", 1, address(accessManager));
        governorContract = new ShiftGovernor(address(membershipToken), address(accessManager), 1 days);
        valuableActionRegistry = new ValuableActionRegistry(
            address(accessManager),
            address(communityRegistry),
            governance,
            communityId
        );
        sbt = new ValuableActionSBT(address(accessManager), communityId);
        cohortRegistry = new CohortRegistry(address(accessManager), communityId);
        router = new RevenueRouter(address(accessManager), address(paramController), address(cohortRegistry), address(sbt), communityId);
        positionManager = new PositionManager(address(accessManager), address(valuableActionRegistry), address(sbt), communityId);
        investmentManager = new InvestmentCohortManager(
            address(accessManager),
            address(cohortRegistry),
            address(valuableActionRegistry),
            address(sbt),
            communityId
        );
        requestHub = new RequestHub(address(communityRegistry), address(valuableActionRegistry));
        credentialManager = new CredentialManager(address(accessManager), address(valuableActionRegistry), address(sbt), communityId);

        communityRegistry.setModuleAddress(communityId, keccak256("governor"), governance);
        communityRegistry.setModuleAddress(communityId, keccak256("timelock"), governance);
        communityRegistry.setModuleAddress(communityId, keccak256("valuableActionRegistry"), address(valuableActionRegistry));
        communityRegistry.setModuleAddress(communityId, keccak256("treasuryVault"), treasury);

        // Wire SBT manager + issuance allowlists
        vm.startPrank(governance, governance);
        bytes4[] memory registryAdminSelectors = new bytes4[](6);
        registryAdminSelectors[0] = valuableActionRegistry.setValuableActionSBT.selector;
        registryAdminSelectors[1] = valuableActionRegistry.setIssuanceModule.selector;
        registryAdminSelectors[2] = valuableActionRegistry.setCommunityNarrowing.selector;
        registryAdminSelectors[3] = valuableActionRegistry.setCommunityIssuanceModule.selector;
        registryAdminSelectors[4] = valuableActionRegistry.addFounder.selector;
        registryAdminSelectors[5] = valuableActionRegistry.setIssuancePaused.selector;
        accessManager.setTargetFunctionRole(address(valuableActionRegistry), registryAdminSelectors, accessManager.ADMIN_ROLE());

        bytes4[] memory registryModeratorSelectors = new bytes4[](1);
        registryModeratorSelectors[0] = valuableActionRegistry.setModerator.selector;
        accessManager.setTargetFunctionRole(
            address(valuableActionRegistry),
            registryModeratorSelectors,
            Roles.VALUABLE_ACTION_REGISTRY_MODERATOR_ROLE
        );

        bytes4[] memory registryIssuerSelectors = new bytes4[](5);
        registryIssuerSelectors[0] = valuableActionRegistry.issueEngagement.selector;
        registryIssuerSelectors[1] = valuableActionRegistry.issuePosition.selector;
        registryIssuerSelectors[2] = valuableActionRegistry.issueInvestment.selector;
        registryIssuerSelectors[3] = valuableActionRegistry.closePositionToken.selector;
        registryIssuerSelectors[4] = valuableActionRegistry.issueRoleFromPosition.selector;
        accessManager.setTargetFunctionRole(
            address(valuableActionRegistry),
            registryIssuerSelectors,
            Roles.VALUABLE_ACTION_REGISTRY_ISSUER_ROLE
        );

        bytes4[] memory cohortAdminSelectors = new bytes4[](2);
        cohortAdminSelectors[0] = cohortRegistry.createCohort.selector;
        cohortAdminSelectors[1] = cohortRegistry.setCohortActive.selector;
        accessManager.setTargetFunctionRole(address(cohortRegistry), cohortAdminSelectors, accessManager.ADMIN_ROLE());

        bytes4[] memory cohortRecorderSelectors = new bytes4[](1);
        cohortRecorderSelectors[0] = cohortRegistry.addInvestment.selector;
        accessManager.setTargetFunctionRole(address(cohortRegistry), cohortRecorderSelectors, Roles.COHORT_INVESTMENT_RECORDER_ROLE);

        bytes4[] memory cohortRouterSelectors = new bytes4[](1);
        cohortRouterSelectors[0] = cohortRegistry.markRecovered.selector;
        accessManager.setTargetFunctionRole(address(cohortRegistry), cohortRouterSelectors, Roles.COHORT_REVENUE_ROUTER_ROLE);

        // Allow governance to manage position and investment managers
        bytes4[] memory positionSelectors = new bytes4[](4);
        positionSelectors[0] = positionManager.setRevenueRouter.selector;
        positionSelectors[1] = positionManager.definePositionType.selector;
        positionSelectors[2] = positionManager.approveApplication.selector;
        positionSelectors[3] = positionManager.closePosition.selector;
        accessManager.setTargetFunctionRole(address(positionManager), positionSelectors, accessManager.ADMIN_ROLE());

        bytes4[] memory investmentSelectors = new bytes4[](3);
        investmentSelectors[0] = investmentManager.createCohort.selector;
        investmentSelectors[1] = investmentManager.setCohortActive.selector;
        investmentSelectors[2] = investmentManager.issueInvestment.selector;
        accessManager.setTargetFunctionRole(address(investmentManager), investmentSelectors, accessManager.ADMIN_ROLE());

        accessManager.grantRole(accessManager.ADMIN_ROLE(), address(investmentManager), 0);

        accessManager.grantRole(Roles.COHORT_INVESTMENT_RECORDER_ROLE, address(investmentManager), 0);
        accessManager.grantRole(Roles.COHORT_REVENUE_ROUTER_ROLE, address(router), 0);

        bytes4[] memory credentialSelectors = new bytes4[](3);
        credentialSelectors[0] = credentialManager.defineCourse.selector;
        credentialSelectors[1] = credentialManager.setCourseActive.selector;
        credentialSelectors[2] = credentialManager.revokeCredential.selector;
        accessManager.setTargetFunctionRole(address(credentialManager), credentialSelectors, accessManager.ADMIN_ROLE());
        bytes4[] memory credentialApproverSelectors = new bytes4[](1);
        credentialApproverSelectors[0] = credentialManager.approveApplication.selector;
        accessManager.setTargetFunctionRole(
            address(credentialManager),
            credentialApproverSelectors,
            Roles.CREDENTIAL_MANAGER_APPROVER_ROLE
        );
        accessManager.grantRole(Roles.CREDENTIAL_MANAGER_APPROVER_ROLE, governance, 0);

        // Router roles
        bytes4[] memory routerAdminSelectors = new bytes4[](4);
        routerAdminSelectors[0] = router.setCommunityTreasury.selector;
        routerAdminSelectors[1] = router.setSupportedToken.selector;
        routerAdminSelectors[2] = router.setParamController.selector;
        routerAdminSelectors[3] = router.setCohortRegistry.selector;
        accessManager.setTargetFunctionRole(address(router), routerAdminSelectors, accessManager.ADMIN_ROLE());

        bytes4[] memory routerDistributorSelectors = new bytes4[](1);
        routerDistributorSelectors[0] = router.routeRevenue.selector;
        accessManager.setTargetFunctionRole(address(router), routerDistributorSelectors, Roles.REVENUE_ROUTER_DISTRIBUTOR_ROLE);

        bytes4[] memory routerPositionSelectors = new bytes4[](2);
        routerPositionSelectors[0] = router.registerPosition.selector;
        routerPositionSelectors[1] = router.unregisterPosition.selector;
        accessManager.setTargetFunctionRole(address(router), routerPositionSelectors, Roles.REVENUE_ROUTER_POSITION_MANAGER_ROLE);

        // Configure SBT selectors and grant manager roles to modules
        bytes4[] memory sbtSelectors = new bytes4[](7);
        sbtSelectors[0] = sbt.mintEngagement.selector;
        sbtSelectors[1] = sbt.mintPosition.selector;
        sbtSelectors[2] = sbt.mintInvestment.selector;
        sbtSelectors[3] = sbt.setEndedAt.selector;
        sbtSelectors[4] = sbt.closePositionToken.selector;
        sbtSelectors[5] = sbt.mintRoleFromPosition.selector;
        sbtSelectors[6] = sbt.updateTokenURI.selector;
        accessManager.setTargetFunctionRole(address(sbt), sbtSelectors, Roles.VALUABLE_ACTION_SBT_MANAGER_ROLE);

        valuableActionRegistry.setValuableActionSBT(address(sbt));
        accessManager.grantRole(Roles.VALUABLE_ACTION_SBT_MANAGER_ROLE, address(valuableActionRegistry), 0);
        accessManager.grantRole(Roles.VALUABLE_ACTION_SBT_MANAGER_ROLE, address(credentialManager), 0);
        accessManager.grantRole(Roles.VALUABLE_ACTION_REGISTRY_ISSUER_ROLE, address(positionManager), 0);
        accessManager.grantRole(Roles.VALUABLE_ACTION_REGISTRY_ISSUER_ROLE, address(investmentManager), 0);
        accessManager.grantRole(Roles.VALUABLE_ACTION_REGISTRY_ISSUER_ROLE, address(requestHub), 0);
        accessManager.grantRole(Roles.VALUABLE_ACTION_REGISTRY_ISSUER_ROLE, address(credentialManager), 0);
        accessManager.grantRole(Roles.VALUABLE_ACTION_REGISTRY_MODERATOR_ROLE, governance, 0);
        accessManager.grantRole(Roles.REVENUE_ROUTER_POSITION_MANAGER_ROLE, address(positionManager), 0);
        accessManager.grantRole(Roles.REVENUE_ROUTER_DISTRIBUTOR_ROLE, distributor, 0);
        valuableActionRegistry.setIssuanceModule(address(positionManager), true);
        valuableActionRegistry.setIssuanceModule(address(investmentManager), true);
        valuableActionRegistry.setIssuanceModule(address(requestHub), true);
        valuableActionRegistry.setIssuanceModule(address(credentialManager), true);
        valuableActionRegistry.setModerator(governance, true);
        vm.stopPrank();

        // Revenue policy + router wiring
        paramController.setRevenuePolicy(communityId, 1000, 0, 0, 0); // 10% treasury, spillover to positions
        router.setCommunityTreasury(treasury);
        router.setSupportedToken(address(token), true);
        positionManager.setRevenueRouter(address(router));

        // Position type setup
        vm.prank(governance);
        positionManager.definePositionType(ROLE_TYPE, 10, true);

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

        vm.startPrank(governance, governance);
        valuableActionId = valuableActionRegistry.proposeValuableAction(action, PROPOSAL_REF);
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
        vm.startPrank(distributor, distributor);
        token.approve(address(router), type(uint256).max);
        router.routeRevenue(address(token), 1_000e18);
        vm.stopPrank();

        uint256 claimablePosition = router.getClaimablePosition(positionTokenId, address(token));
        assertGt(claimablePosition, 0);

        vm.prank(positionHolder);
        router.claimPosition(positionTokenId, address(token), positionHolder);
        assertEq(token.balanceOf(positionHolder), claimablePosition);

        vm.prank(governance);
        positionManager.closePosition(positionTokenId, PositionManager.CloseOutcome.SUCCESS, bytes("role"));

        uint256 treasuryBeforeSecondRoute = router.treasuryAccrual(address(token));

        token.mint(distributor, 1_000e18);
        vm.prank(distributor);
        router.routeRevenue(address(token), 1_000e18);

        assertEq(router.getClaimablePosition(positionTokenId, address(token)), 0);
        assertGt(router.treasuryAccrual(address(token)), treasuryBeforeSecondRoute);
        assertFalse(router.positionRegistered(positionTokenId));

        // ---- Investment flow ----
        vm.prank(governance);
        uint256 cohortId = investmentManager.createCohort(
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
        vm.startPrank(distributor, distributor);
        token.approve(address(router), type(uint256).max);
        router.routeRevenue(address(token), 1_000e18);
        vm.stopPrank();

        uint256 claimableInvestment = router.getClaimableInvestment(investmentTokenId, address(token));
        assertGt(claimableInvestment, 0);

        vm.prank(investor);
        router.claimInvestment(investmentTokenId, address(token), investor);
        assertEq(token.balanceOf(investor), claimableInvestment);

        // ---- RequestHub one-shot ----
        token.mint(governance, 100e18);
        vm.prank(treasury);
        token.approve(address(requestHub), type(uint256).max);

        vm.startPrank(governance, governance);
        uint256 requestId = requestHub.createRequest(communityId, "title", "cid", new string[](0));
        requestHub.linkValuableAction(requestId, valuableActionId);
        token.approve(address(requestHub), type(uint256).max);
        requestHub.addBounty(requestId, address(token), 100e18);

        requestHub.setApprovedWinner(requestId, requestWinner);
        vm.stopPrank();

        vm.prank(requestWinner);
        requestHub.completeEngagement(requestId, bytes("meta"));
        assertEq(token.balanceOf(requestWinner), 100e18);
        assertEq(token.balanceOf(treasury), 0);
        assertEq(token.balanceOf(address(requestHub)), 0);

        uint256 treasuryAfterRequest = router.treasuryAccrual(address(token));

        // ---- Credential flow ----
        vm.prank(governance);
        credentialManager.defineCourse(COURSE_ID, governance, true);

        vm.prank(credentialApplicant);
        uint256 credAppId = credentialManager.applyForCredential(COURSE_ID, bytes("evidence"));

        vm.prank(governance);
        uint256 credentialTokenId = credentialManager.approveApplication(credAppId);
        assertGt(credentialTokenId, 0);

        // Revoke credential and ensure router state untouched
        vm.prank(governance);
        credentialManager.revokeCredential(credentialTokenId, COURSE_ID, bytes("reason"));

        assertEq(router.treasuryAccrual(address(token)), treasuryAfterRequest);
        assertEq(router.getClaimableInvestment(investmentTokenId, address(token)), 0);
    }

    function testGovernorUsesLocalAccessManager() public view {
        assertEq(address(governorContract.accessManager()), address(accessManager));
        assertEq(governorContract.baseDelaySeconds(), 1 days);
    }

    function testPostHandoffRestrictedWritesFailForDeployerAndManager() public {
        uint64 adminRole = accessManager.ADMIN_ROLE();
        address timelockAdmin = address(0xABCD);
        bytes32 postHandoffRole = keccak256("role:post-handoff");

        accessManager.grantRole(adminRole, timelockAdmin, 0);
        accessManager.revokeRole(adminRole, governance);

        (bool timelockHasAdmin,) = accessManager.hasRole(adminRole, timelockAdmin);
        (bool governanceHasAdmin,) = accessManager.hasRole(adminRole, governance);
        assertTrue(timelockHasAdmin);
        assertFalse(governanceHasAdmin);

        vm.prank(governance);
        vm.expectRevert();
        positionManager.definePositionType(postHandoffRole, 5, true);

        vm.prank(distributor);
        vm.expectRevert();
        positionManager.definePositionType(postHandoffRole, 5, true);

        vm.prank(timelockAdmin);
        positionManager.definePositionType(postHandoffRole, 5, true);
    }

    function testScopedPrivilegedMutationUpdatesLocalState() public {
        router.setSupportedToken(address(token), false);
        assertFalse(router.supportedTokens(address(token)));

        address nextTreasury = address(0xBEEF);
        router.setCommunityTreasury(nextTreasury);
        assertEq(router.communityTreasuries(), nextTreasury);
    }
}
