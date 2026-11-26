// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, Vm} from "forge-std/Test.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {GovernanceLayerFactory} from "contracts/modules/factories/GovernanceLayerFactory.sol";
import {MembershipTokenERC20Votes} from "contracts/tokens/MembershipTokenERC20Votes.sol";
import {ShiftTimelockController} from "contracts/core/ShiftTimelockController.sol";
import {ShiftGovernor} from "contracts/core/ShiftGovernor.sol";
import {CountingMultiChoice} from "contracts/core/CountingMultiChoice.sol";

contract GovernanceLayerFactoryTest is Test {
    uint256 internal constant EXECUTION_DELAY = 2 days;

    GovernanceLayerFactory internal factory;
    AccessManager internal accessManager;
    address internal timelockAdmin = address(0xAD11);

    function setUp() public {
        factory = new GovernanceLayerFactory();
        accessManager = new AccessManager(address(this));
    }

    function _deploy() internal returns (GovernanceLayerFactory.Deployment memory) {
        return factory.deployLayer(
            1,
            "Community",
            address(accessManager),
            EXECUTION_DELAY,
            timelockAdmin,
            type(MembershipTokenERC20Votes).creationCode,
            type(ShiftTimelockController).creationCode,
            type(ShiftGovernor).creationCode,
            type(CountingMultiChoice).creationCode
        );
    }

    function testGovernorIsWiredToTheDeployedTimelock() public {
        GovernanceLayerFactory.Deployment memory d = _deploy();

        ShiftGovernor governor = ShiftGovernor(payable(d.governor));
        assertEq(governor.timelock(), d.timelock, "governor timelock");
        assertEq(address(governor.token()), d.membershipToken, "governor token");
        assertEq(ShiftTimelockController(payable(d.timelock)).getMinDelay(), EXECUTION_DELAY, "min delay");
    }

    function testAccessManagerIsOnlyTheMembershipTokenAuthority() public {
        GovernanceLayerFactory.Deployment memory d = _deploy();

        assertEq(MembershipTokenERC20Votes(d.membershipToken).authority(), address(accessManager));
        assertTrue(ShiftGovernor(payable(d.governor)).timelock() != address(accessManager));
    }

    function testFactoryGrantsNoTimelockRoles() public {
        GovernanceLayerFactory.Deployment memory d = _deploy();
        ShiftTimelockController timelock = ShiftTimelockController(payable(d.timelock));

        assertTrue(timelock.hasRole(timelock.DEFAULT_ADMIN_ROLE(), timelockAdmin), "bootstrap admin");
        assertFalse(timelock.hasRole(timelock.DEFAULT_ADMIN_ROLE(), address(factory)), "factory admin");
        assertFalse(timelock.hasRole(timelock.PROPOSER_ROLE(), d.governor), "governor proposer");
        assertFalse(timelock.hasRole(timelock.EXECUTOR_ROLE(), d.governor), "governor executor");
        assertFalse(timelock.hasRole(timelock.CANCELLER_ROLE(), d.governor), "governor canceller");
    }

    function testDeploymentRecordAndEventAreUnchanged() public {
        vm.recordLogs();
        GovernanceLayerFactory.Deployment memory d = _deploy();

        (address token, address timelock, address governor, address counting) =
            factory.lastDeploymentByCaller(address(this));
        assertEq(token, d.membershipToken);
        assertEq(timelock, d.timelock);
        assertEq(governor, d.governor);
        assertEq(counting, d.countingMultiChoice);
        assertEq(CountingMultiChoice(d.countingMultiChoice).governor(), d.governor);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs[logs.length - 1].topics[0], keccak256("GovernanceLayerDeployed(address,uint256,address,address,address,address)"));
    }
}
