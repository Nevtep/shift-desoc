// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {ParamController} from "contracts/modules/ParamController.sol";
import {CommunityRegistry} from "contracts/modules/CommunityRegistry.sol";
import {MembershipTokenERC20Votes} from "contracts/tokens/MembershipTokenERC20Votes.sol";
import {ShiftGovernor} from "contracts/core/ShiftGovernor.sol";
import {ShiftTimelockController} from "contracts/core/ShiftTimelockController.sol";
import {Errors} from "contracts/libs/Errors.sol";

/// @notice Shared fixture: community Governor executing through its own TimelockController.
abstract contract GovernorTimelockFixture is Test {
    uint256 internal constant MIN_DELAY = 2 days;

    AccessManager internal accessManager;
    MembershipTokenERC20Votes internal membershipToken;
    ShiftTimelockController internal timelock;
    ShiftGovernor internal governor;
    ParamController internal paramController;
    CommunityRegistry internal communityRegistry;
    uint256 internal communityId;

    address internal deployer = address(this);
    address internal voter = address(0xA11CE);

    function _deployFixture() internal {
        accessManager = new AccessManager(deployer);
        membershipToken = new MembershipTokenERC20Votes("Membership", "MEM", 1, address(accessManager));

        // Bootstrap: deployer is the temporary timelock admin (factories never grant roles).
        timelock = new ShiftTimelockController(MIN_DELAY, new address[](0), new address[](0), deployer);
        governor = new ShiftGovernor(address(membershipToken), timelock);

        paramController = new ParamController(deployer);
        communityRegistry = new CommunityRegistry(address(paramController));
        paramController.setCommunityRegistry(address(communityRegistry));
        communityId = communityRegistry.registerCommunity("Comm", "Desc", "ipfs://meta", 0);
    }
}

contract ShiftGovernorTimelockWiringTest is GovernorTimelockFixture {
    function setUp() public {
        _deployFixture();
    }

    function testGovernorExposesCommunityTimelock() public view {
        assertEq(governor.timelock(), address(timelock));
    }

    function testGovernorKeepsVotingSettings() public view {
        assertEq(governor.votingDelay(), 1 days);
        assertEq(governor.votingPeriod(), 5 days);
        assertEq(governor.proposalThreshold(), 0);
        assertEq(governor.quorumNumerator(), 4);
        assertEq(address(governor.token()), address(membershipToken));
    }

    function testConstructorRejectsZeroToken() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        new ShiftGovernor(address(0), timelock);
    }

    function testConstructorRejectsZeroTimelock() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        new ShiftGovernor(address(membershipToken), TimelockController(payable(address(0))));
    }
}
