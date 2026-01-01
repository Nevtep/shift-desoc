// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CredentialManager} from "contracts/modules/CredentialManager.sol";
import {ValuableActionRegistry} from "contracts/modules/ValuableActionRegistry.sol";
import {ValuableActionSBT} from "contracts/modules/ValuableActionSBT.sol";
import {Errors} from "contracts/libs/Errors.sol";

contract CommunityRegistryMock {
    struct ModuleAddresses {
        address governor;
        address timelock;
        address requestHub;
        address draftsManager;
        address engagementsManager;
        address valuableActionRegistry;
        address verifierPowerToken;
        address verifierElection;
        address verifierManager;
        address valuableActionSBT;
        address treasuryAdapter;
        address communityToken;
        address paramController;
    }

    mapping(uint256 => ModuleAddresses) internal modulesByCommunity;

    function setModuleAddresses(uint256 communityId, ModuleAddresses calldata modules) external {
        modulesByCommunity[communityId] = modules;
    }

    function getCommunityModules(uint256 communityId) external view returns (ModuleAddresses memory) {
        return modulesByCommunity[communityId];
    }
}

contract CredentialManagerTest is Test {
    ValuableActionRegistry registry;
    ValuableActionSBT sbt;
    CredentialManager manager;
    CommunityRegistryMock communityRegistry;

    address governance = makeAddr("governance");
    address moderator = makeAddr("moderator");
    address verifier = makeAddr("verifier");
    address user = makeAddr("user");

    uint256 constant COMMUNITY_ID = 1;
    bytes32 constant COURSE_ID = bytes32("course:web3");

    function setUp() public {
        communityRegistry = new CommunityRegistryMock();
        registry = new ValuableActionRegistry(governance, address(communityRegistry));
        sbt = new ValuableActionSBT(governance, governance, governance);
        manager = new CredentialManager(governance, address(registry), address(sbt));

        communityRegistry.setModuleAddresses(
            COMMUNITY_ID,
            CommunityRegistryMock.ModuleAddresses({
                governor: address(0xBEEF),
                timelock: governance,
                requestHub: address(0),
                draftsManager: address(0),
                engagementsManager: address(0),
                valuableActionRegistry: address(registry),
                verifierPowerToken: address(0),
                verifierElection: address(0),
                verifierManager: address(0),
                valuableActionSBT: address(0),
                treasuryAdapter: address(0),
                communityToken: address(0),
                paramController: address(0)
            })
        );

        vm.startPrank(governance);
        registry.setValuableActionSBT(address(sbt));
        sbt.grantRole(sbt.MANAGER_ROLE(), address(registry));
        sbt.grantRole(sbt.MANAGER_ROLE(), address(manager));
        registry.setIssuanceModule(address(manager), true);
        manager.setModerator(moderator, true);
        manager.defineCourse(COURSE_ID, COMMUNITY_ID, verifier, true);
        vm.stopPrank();
    }

    function testApplyAndApproveFlow() public {
        vm.prank(user);
        uint256 appId = manager.applyForCredential(COURSE_ID, bytes("evidence"));

        vm.prank(verifier);
        uint256 tokenId = manager.approveApplication(appId);

        ValuableActionSBT.TokenData memory data = sbt.getTokenData(tokenId);
        assertEq(uint256(data.kind), uint256(ValuableActionSBT.TokenKind.CREDENTIAL));
        assertEq(data.communityId, COMMUNITY_ID);
        assertEq(data.actionTypeId, COURSE_ID);
        assertEq(data.endedAt, 0);
        assertTrue(manager.hasCredential(COURSE_ID, user));

        (bytes32 courseRef, uint256 storedApp) = abi.decode(manager.issuanceMetadata(tokenId), (bytes32, uint256));
        assertEq(courseRef, COURSE_ID);
        assertEq(storedApp, appId);
    }

    function testOnlyVerifierOrGovernanceCanApprove() public {
        vm.prank(user);
        uint256 appId = manager.applyForCredential(COURSE_ID, "");

        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, user));
        vm.prank(user);
        manager.approveApplication(appId);

        vm.prank(governance);
        manager.approveApplication(appId);
    }

    function testOneCredentialPerCoursePerUser() public {
        vm.prank(user);
        uint256 appId = manager.applyForCredential(COURSE_ID, "");

        vm.prank(verifier);
        manager.approveApplication(appId);

        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Credential already issued"));
        vm.prank(user);
        manager.applyForCredential(COURSE_ID, "");
    }

    function testCannotApplyWhenInactive() public {
        vm.prank(governance);
        manager.setCourseActive(COURSE_ID, false);

        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Course inactive"));
        vm.prank(user);
        manager.applyForCredential(COURSE_ID, "");
    }

    function testPendingApplicationEnforced() public {
        vm.prank(user);
        manager.applyForCredential(COURSE_ID, "");

        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Application already pending"));
        vm.prank(user);
        manager.applyForCredential(COURSE_ID, "");
    }

    function testGovernanceRevoke() public {
        vm.prank(user);
        uint256 appId = manager.applyForCredential(COURSE_ID, "");
        vm.prank(verifier);
        uint256 tokenId = manager.approveApplication(appId);

        vm.warp(1_000);
        bytes memory reason = bytes("plagiarism");

        vm.prank(governance);
        manager.revokeCredential(tokenId, COURSE_ID, reason);

        ValuableActionSBT.TokenData memory data = sbt.getTokenData(tokenId);
        assertEq(data.endedAt, block.timestamp);

        (bytes32 courseRef, bytes memory storedReason) = abi.decode(manager.revocationMetadata(tokenId), (bytes32, bytes));
        assertEq(courseRef, COURSE_ID);
        assertEq(keccak256(storedReason), keccak256(reason));

        CredentialManager.CredentialApplication memory application = manager.getApplication(appId);
        assertEq(application.status, 3); // STATUS_REVOKED
    }

    function testCannotRevokeTwice() public {
        vm.prank(user);
        uint256 appId = manager.applyForCredential(COURSE_ID, "");
        vm.prank(verifier);
        uint256 tokenId = manager.approveApplication(appId);

        vm.prank(governance);
        manager.revokeCredential(tokenId, COURSE_ID, "bad");

        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Credential already closed"));
        vm.prank(governance);
        manager.revokeCredential(tokenId, COURSE_ID, "bad");
    }

    function testRevokeCourseMismatchReverts() public {
        vm.prank(user);
        uint256 appId = manager.applyForCredential(COURSE_ID, "");
        vm.prank(verifier);
        uint256 tokenId = manager.approveApplication(appId);

        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Course mismatch"));
        vm.prank(governance);
        manager.revokeCredential(tokenId, bytes32("other"), "bad");
    }

    function testGovernanceUpdatePropagatesModerator() public {
        address newGov = makeAddr("newGov");

        vm.prank(governance);
        manager.updateGovernance(newGov);

        assertTrue(manager.isModerator(newGov));
        vm.prank(newGov);
        manager.setModerator(address(0x1234), true);
    }
}
