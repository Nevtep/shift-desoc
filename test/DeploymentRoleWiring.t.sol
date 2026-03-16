// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {ParamController} from "contracts/modules/ParamController.sol";
import {CommunityRegistry} from "contracts/modules/CommunityRegistry.sol";
import {ValuableActionRegistry} from "contracts/modules/ValuableActionRegistry.sol";
import {ValuableActionSBT} from "contracts/modules/ValuableActionSBT.sol";
import {RevenueRouter} from "contracts/modules/RevenueRouter.sol";
import {CohortRegistry} from "contracts/modules/CohortRegistry.sol";
import {PositionManager} from "contracts/modules/PositionManager.sol";
import {CredentialManager} from "contracts/modules/CredentialManager.sol";
import {CommerceDisputes} from "contracts/modules/CommerceDisputes.sol";
import {Marketplace} from "contracts/modules/Marketplace.sol";
import {HousingManager} from "contracts/modules/HousingManager.sol";
import {Roles} from "contracts/libs/Roles.sol";
import {Errors} from "contracts/libs/Errors.sol";

contract ERC20MockRole {
    string public name = "Mock";
    string public symbol = "MOCK";
    uint8 public decimals = 18;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract DeploymentRoleWiringTest is Test {
    AccessManager accessManager;
    ParamController paramController;
    CommunityRegistry communityRegistry;
    ValuableActionRegistry valuableActionRegistry;
    ValuableActionSBT sbt;
    CohortRegistry cohortRegistry;
    RevenueRouter revenueRouter;
    PositionManager positionManager;
    CredentialManager credentialManager;
    CommerceDisputes commerceDisputes;
    Marketplace marketplace;
    HousingManager housingManager;
    ERC20MockRole stable;

    uint256 communityId;

    address governance = address(this);
    address distributor = address(0xD1);
    address seller = address(0xA1);
    address buyer = address(0xB1);
    address applicant = address(0xC1);
    address verifier = address(0xE1);
    address treasury = address(0xF1);

    bytes32 constant ROLE_TYPE = keccak256("role:ops");
    bytes32 constant COURSE_ID = keccak256("course:security");

    function setUp() public {
        stable = new ERC20MockRole();

        accessManager = new AccessManager(governance);
        paramController = new ParamController(governance);
        communityRegistry = new CommunityRegistry(address(paramController));
        paramController.setCommunityRegistry(address(communityRegistry));
        communityId = communityRegistry.registerCommunity("Comm", "Desc", "", 0);

        valuableActionRegistry = new ValuableActionRegistry(address(accessManager), address(communityRegistry), governance, communityId);
        sbt = new ValuableActionSBT(address(accessManager), communityId);
        cohortRegistry = new CohortRegistry(address(accessManager), communityId);
        revenueRouter = new RevenueRouter(address(accessManager), address(paramController), address(cohortRegistry), address(sbt), communityId);
        positionManager = new PositionManager(address(accessManager), address(valuableActionRegistry), address(sbt), communityId);
        credentialManager = new CredentialManager(address(accessManager), address(valuableActionRegistry), address(sbt), communityId);
        commerceDisputes = new CommerceDisputes(address(accessManager), communityId);
        marketplace = new Marketplace(address(accessManager), address(commerceDisputes), address(revenueRouter), communityId);
        housingManager = new HousingManager(address(accessManager), address(stable), communityId);

        communityRegistry.setModuleAddress(communityId, keccak256("timelock"), governance);
        communityRegistry.setModuleAddress(communityId, keccak256("governor"), governance);
        communityRegistry.setModuleAddress(communityId, keccak256("valuableActionRegistry"), address(valuableActionRegistry));
        communityRegistry.setModuleAddress(communityId, keccak256("treasuryVault"), treasury);

        bytes4[] memory registryAdmin = new bytes4[](2);
        registryAdmin[0] = valuableActionRegistry.setValuableActionSBT.selector;
        registryAdmin[1] = valuableActionRegistry.setIssuanceModule.selector;
        accessManager.setTargetFunctionRole(address(valuableActionRegistry), registryAdmin, accessManager.ADMIN_ROLE());

        bytes4[] memory registryModerator = new bytes4[](1);
        registryModerator[0] = valuableActionRegistry.setModerator.selector;
        accessManager.setTargetFunctionRole(address(valuableActionRegistry), registryModerator, Roles.VALUABLE_ACTION_REGISTRY_MODERATOR_ROLE);

        bytes4[] memory registryIssuer = new bytes4[](5);
        registryIssuer[0] = valuableActionRegistry.issueEngagement.selector;
        registryIssuer[1] = valuableActionRegistry.issuePosition.selector;
        registryIssuer[2] = valuableActionRegistry.issueInvestment.selector;
        registryIssuer[3] = valuableActionRegistry.closePositionToken.selector;
        registryIssuer[4] = valuableActionRegistry.issueRoleFromPosition.selector;
        accessManager.setTargetFunctionRole(address(valuableActionRegistry), registryIssuer, Roles.VALUABLE_ACTION_REGISTRY_ISSUER_ROLE);

        bytes4[] memory sbtMgr = new bytes4[](1);
        sbtMgr[0] = sbt.mintEngagement.selector;
        accessManager.setTargetFunctionRole(address(sbt), sbtMgr, Roles.VALUABLE_ACTION_SBT_MANAGER_ROLE);

        bytes4[] memory routerAdmin = new bytes4[](2);
        routerAdmin[0] = revenueRouter.setCommunityTreasury.selector;
        routerAdmin[1] = revenueRouter.setSupportedToken.selector;
        accessManager.setTargetFunctionRole(address(revenueRouter), routerAdmin, accessManager.ADMIN_ROLE());

        bytes4[] memory positionAdmin = new bytes4[](3);
        positionAdmin[0] = positionManager.setRevenueRouter.selector;
        positionAdmin[1] = positionManager.definePositionType.selector;
        positionAdmin[2] = positionManager.approveApplication.selector;
        accessManager.setTargetFunctionRole(address(positionManager), positionAdmin, accessManager.ADMIN_ROLE());

        bytes4[] memory courseAdmin = new bytes4[](2);
        courseAdmin[0] = credentialManager.defineCourse.selector;
        courseAdmin[1] = credentialManager.setCourseActive.selector;
        accessManager.setTargetFunctionRole(address(credentialManager), courseAdmin, accessManager.ADMIN_ROLE());
        bytes4[] memory courseApprover = new bytes4[](1);
        courseApprover[0] = credentialManager.approveApplication.selector;
        accessManager.setTargetFunctionRole(address(credentialManager), courseApprover, Roles.CREDENTIAL_MANAGER_APPROVER_ROLE);

        bytes4[] memory marketAdmin = new bytes4[](1);
        marketAdmin[0] = marketplace.setCommunityActive.selector;
        accessManager.setTargetFunctionRole(address(marketplace), marketAdmin, accessManager.ADMIN_ROLE());

        bytes4[] memory housingAdmin = new bytes4[](1);
        housingAdmin[0] = housingManager.createUnit.selector;
        accessManager.setTargetFunctionRole(address(housingManager), housingAdmin, accessManager.ADMIN_ROLE());

        bytes4[] memory disputesAdmin = new bytes4[](1);
        disputesAdmin[0] = commerceDisputes.setDisputeReceiver.selector;
        accessManager.setTargetFunctionRole(address(commerceDisputes), disputesAdmin, accessManager.ADMIN_ROLE());

        stable.mint(distributor, 10_000e18);
        stable.mint(buyer, 10_000e18);

        revenueRouter.setCommunityTreasury(communityId, treasury);
        revenueRouter.setSupportedToken(communityId, address(stable), true);
        marketplace.setCommunityActive(communityId, true);
        commerceDisputes.setDisputeReceiver(address(marketplace));

        valuableActionRegistry.setValuableActionSBT(address(sbt));
        accessManager.grantRole(Roles.VALUABLE_ACTION_REGISTRY_MODERATOR_ROLE, governance, 0);
        accessManager.grantRole(Roles.VALUABLE_ACTION_SBT_MANAGER_ROLE, address(valuableActionRegistry), 0);
    }

    function testRouteRevenueRequiresDistributorRole() public {
        vm.prank(distributor);
        stable.approve(address(revenueRouter), type(uint256).max);

        vm.prank(distributor);
        vm.expectRevert();
        revenueRouter.routeRevenue(communityId, address(stable), 100e18);

        bytes4[] memory routeSel = new bytes4[](1);
        routeSel[0] = revenueRouter.routeRevenue.selector;
        accessManager.setTargetFunctionRole(address(revenueRouter), routeSel, Roles.REVENUE_ROUTER_DISTRIBUTOR_ROLE);
        accessManager.grantRole(Roles.REVENUE_ROUTER_DISTRIBUTOR_ROLE, distributor, 0);

        vm.prank(distributor);
        revenueRouter.routeRevenue(communityId, address(stable), 100e18);
    }

    function testPositionRegisterRequiresPositionManagerRole() public {
        bytes4[] memory posSel = new bytes4[](1);
        posSel[0] = sbt.mintPosition.selector;
        accessManager.setTargetFunctionRole(address(sbt), posSel, Roles.VALUABLE_ACTION_SBT_MANAGER_ROLE);
        accessManager.grantRole(Roles.VALUABLE_ACTION_SBT_MANAGER_ROLE, address(valuableActionRegistry), 0);
        accessManager.grantRole(Roles.VALUABLE_ACTION_REGISTRY_ISSUER_ROLE, address(positionManager), 0);

        positionManager.setRevenueRouter(address(revenueRouter));
        positionManager.definePositionType(ROLE_TYPE, 10, true);

        vm.prank(applicant);
        uint256 appId = positionManager.applyForPosition(ROLE_TYPE, bytes("evidence"));

        vm.expectRevert();
        positionManager.approveApplication(appId, bytes("meta"));

        bytes4[] memory rrSel = new bytes4[](2);
        rrSel[0] = revenueRouter.registerPosition.selector;
        rrSel[1] = revenueRouter.unregisterPosition.selector;
        accessManager.setTargetFunctionRole(address(revenueRouter), rrSel, Roles.REVENUE_ROUTER_POSITION_MANAGER_ROLE);
        accessManager.grantRole(Roles.REVENUE_ROUTER_POSITION_MANAGER_ROLE, address(positionManager), 0);

        vm.prank(applicant);
        uint256 appId2 = positionManager.applyForPosition(ROLE_TYPE, bytes("evidence2"));
        positionManager.approveApplication(appId2, bytes("meta2"));
    }

    function testMarketplaceDisputeOpenRequiresCallerRole() public {
        vm.prank(seller);
        uint256 offerId = marketplace.createOffer(
            communityId,
            Marketplace.OfferKind.GENERIC,
            address(0),
            0,
            10e18,
            address(stable),
            false,
            true,
            0,
            address(stable),
            0,
            ""
        );

        vm.prank(buyer);
        stable.approve(address(marketplace), type(uint256).max);

        vm.prank(buyer);
        uint256 orderId = marketplace.purchase(offerId, address(stable), bytes(""));

        vm.prank(seller);
        marketplace.markOrderFulfilled(orderId);

        vm.prank(buyer);
        vm.expectRevert();
        marketplace.openOrderDispute(orderId, "evidence");

        bytes4[] memory openSel = new bytes4[](1);
        openSel[0] = bytes4(
            keccak256("openDispute(uint8,uint256,address,address,uint256,string)")
        );
        accessManager.setTargetFunctionRole(address(commerceDisputes), openSel, Roles.COMMERCE_DISPUTES_CALLER_ROLE);
        accessManager.grantRole(Roles.COMMERCE_DISPUTES_CALLER_ROLE, address(marketplace), 0);

        vm.prank(buyer);
        marketplace.openOrderDispute(orderId, "evidence-2");
    }

    function testCredentialIssuanceRequiresIssuerRole() public {
        bytes4[] memory mintSel = new bytes4[](1);
        mintSel[0] = sbt.mintEngagement.selector;
        accessManager.setTargetFunctionRole(address(sbt), mintSel, Roles.VALUABLE_ACTION_SBT_MANAGER_ROLE);
        accessManager.grantRole(Roles.VALUABLE_ACTION_SBT_MANAGER_ROLE, address(valuableActionRegistry), 0);

        credentialManager.defineCourse(COURSE_ID, verifier, true);
        accessManager.grantRole(Roles.CREDENTIAL_MANAGER_APPROVER_ROLE, verifier, 0);

        vm.prank(applicant);
        uint256 appId = credentialManager.applyForCredential(COURSE_ID, bytes("proof"));

        vm.prank(verifier);
        vm.expectRevert();
        credentialManager.approveApplication(appId);

        accessManager.grantRole(Roles.VALUABLE_ACTION_REGISTRY_ISSUER_ROLE, address(credentialManager), 0);
        vm.prank(verifier);
        credentialManager.approveApplication(appId);
    }

    function testHousingConsumeRequiresMarketplaceCallerRole() public {
        vm.prank(seller);
        stable.approve(address(housingManager), type(uint256).max);

        uint256 unitId = housingManager.createUnit(communityId, seller, "", 5e18, 2, 0);

        vm.prank(seller);
        uint256 offerId = marketplace.createOffer(
            communityId,
            Marketplace.OfferKind.HOUSING,
            address(housingManager),
            unitId,
            0,
            address(stable),
            false,
            true,
            0,
            address(stable),
            0,
            ""
        );

        vm.prank(buyer);
        stable.approve(address(marketplace), type(uint256).max);

        bytes memory stay = abi.encode(uint64(block.timestamp + 2 days), uint64(block.timestamp + 4 days));

        vm.prank(buyer);
        vm.expectRevert();
        marketplace.purchase(offerId, address(stable), stay);

        bytes4[] memory housingSel = new bytes4[](2);
        housingSel[0] = housingManager.consume.selector;
        housingSel[1] = housingManager.onOrderSettled.selector;
        accessManager.setTargetFunctionRole(address(housingManager), housingSel, Roles.HOUSING_MARKETPLACE_CALLER_ROLE);
        accessManager.grantRole(Roles.HOUSING_MARKETPLACE_CALLER_ROLE, address(marketplace), 0);

        vm.prank(buyer);
        marketplace.purchase(offerId, address(stable), stay);
    }

    function testParamControllerTimelockWiringIsEnforced() public {
        assertEq(communityRegistry.getTimelock(communityId), governance);

        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, seller));
        vm.prank(seller);
        paramController.setGovernanceParams(communityId, 2 days, 2 days, 2 days);

        vm.prank(governance);
        paramController.setGovernanceParams(communityId, 2 days, 2 days, 2 days);

        (uint256 debateWindow, uint256 voteWindow, uint256 executionDelay) = communityRegistry.getGovernanceParameters(communityId);
        assertEq(debateWindow, 2 days);
        assertEq(voteWindow, 2 days);
        assertEq(executionDelay, 2 days);
    }
}
