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
import {RevenueRouter} from "contracts/modules/RevenueRouter.sol";
import {Errors} from "contracts/libs/Errors.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {IAccessManaged} from "@openzeppelin/contracts/access/manager/IAccessManaged.sol";
import {Errors as OZErrors} from "@openzeppelin/contracts/utils/Errors.sol";

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

/// @notice End-to-end: a binary proposal passes, queues in the timelock and executes with the
///         timelock as `msg.sender`, against both `onlyAuthorized` and `AccessManaged restricted` targets.
contract ShiftGovernorTimelockLifecycleTest is GovernorTimelockFixture {
    uint64 internal constant CUSTOM_ROLE = 4242;

    RevenueRouter internal router;
    RevenueRouter internal lockedRouter;
    address internal outsider = address(0xBAD);
    address internal token = address(0x7041);

    function setUp() public {
        _deployFixture();

        // Voting power: deployer holds AccessManager ADMIN_ROLE during bootstrap, so it can mint.
        membershipToken.mint(voter, 100 ether, "bootstrap");
        vm.prank(voter);
        membershipToken.delegate(voter);
        vm.roll(block.number + 1);

        router = new RevenueRouter(address(accessManager), address(paramController), address(0xC0), address(0x5B7), communityId);
        lockedRouter = new RevenueRouter(address(accessManager), address(paramController), address(0xC0), address(0x5B7), communityId);
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = RevenueRouter.setSupportedToken.selector;
        accessManager.setTargetFunctionRole(address(lockedRouter), selectors, CUSTOM_ROLE);

        // Wizard-equivalent wiring (factories never grant roles).
        timelock.grantRole(timelock.PROPOSER_ROLE(), address(governor));
        timelock.grantRole(timelock.EXECUTOR_ROLE(), address(governor));
        timelock.grantRole(timelock.CANCELLER_ROLE(), address(governor));
        accessManager.grantRole(accessManager.ADMIN_ROLE(), address(timelock), 0);
        communityRegistry.setModuleAddress(communityId, keccak256("timelock"), address(timelock));

        // Finalize: revoke every bootstrap privilege held by the deployer.
        timelock.revokeRole(timelock.DEFAULT_ADMIN_ROLE(), deployer);
        accessManager.revokeRole(accessManager.ADMIN_ROLE(), deployer);
    }

    // ----------------------------------------------------------------- helpers

    struct Call {
        address[] targets;
        uint256[] values;
        bytes[] calldatas;
        bytes32 descriptionHash;
    }

    function _call(address target, bytes memory data, string memory description) internal pure returns (Call memory c) {
        c.targets = new address[](1);
        c.values = new uint256[](1);
        c.calldatas = new bytes[](1);
        c.targets[0] = target;
        c.calldatas[0] = data;
        c.descriptionHash = keccak256(bytes(description));
    }

    function _propose(Call memory c, string memory description) internal returns (uint256) {
        vm.prank(voter);
        return governor.propose(c.targets, c.values, c.calldatas, description);
    }

    function _vote(uint256 id) internal {
        vm.roll(governor.proposalSnapshot(id) + 1);
        vm.prank(voter);
        governor.castVote(id, 1);
        vm.roll(governor.proposalDeadline(id) + 1);
    }

    function _queue(uint256 id, Call memory c) internal {
        governor.queue(c.targets, c.values, c.calldatas, c.descriptionHash);
        assertEq(uint8(governor.state(id)), uint8(IGovernor.ProposalState.Queued));
    }

    function _operationId(Call memory c) internal view returns (bytes32) {
        return timelock.hashOperationBatch(
            c.targets, c.values, c.calldatas, 0, bytes20(address(governor)) ^ c.descriptionHash
        );
    }

    function _revenuePolicyCall(string memory description) internal view returns (Call memory) {
        return _call(
            address(paramController),
            abi.encodeCall(ParamController.setRevenuePolicy, (communityId, 3000, 2000, 1, 500)),
            description
        );
    }

    // ------------------------------------------------------------- S4 lifecycle

    function testBinaryProposalExecutesParamControllerWriteThroughTimelock() public {
        string memory description = "Set revenue policy";
        Call memory c = _revenuePolicyCall(description);
        uint256 id = _propose(c, description);
        assertEq(uint8(governor.state(id)), uint8(IGovernor.ProposalState.Pending));

        vm.roll(governor.proposalSnapshot(id) + 1);
        assertEq(uint8(governor.state(id)), uint8(IGovernor.ProposalState.Active));

        _vote(id);
        assertEq(uint8(governor.state(id)), uint8(IGovernor.ProposalState.Succeeded));

        _queue(id, c);

        // Premature execution stays blocked until getMinDelay() elapsed.
        vm.warp(block.timestamp + MIN_DELAY - 1);
        vm.expectRevert(
            abi.encodeWithSelector(
                TimelockController.TimelockUnexpectedOperationState.selector, _operationId(c), bytes32(uint256(1 << uint8(TimelockController.OperationState.Ready)))
            )
        );
        governor.execute(c.targets, c.values, c.calldatas, c.descriptionHash);

        vm.warp(block.timestamp + 1);
        governor.execute(c.targets, c.values, c.calldatas, c.descriptionHash);
        assertEq(uint8(governor.state(id)), uint8(IGovernor.ProposalState.Executed));

        (uint16 minTreasuryBps, uint16 minPositionsBps, uint8 spilloverTarget, uint16 spilloverSplit) =
            paramController.getRevenuePolicy(communityId);
        assertEq(minTreasuryBps, 3000);
        assertEq(minPositionsBps, 2000);
        assertEq(spilloverTarget, 1);
        assertEq(spilloverSplit, 500);
    }

    function testParamControllerRejectsGovernorAndDeployerCallingDirectly() public {
        vm.prank(address(governor));
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, address(governor)));
        paramController.setRevenuePolicy(communityId, 3000, 2000, 1, 500);

        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, deployer));
        paramController.setRevenuePolicy(communityId, 3000, 2000, 1, 500);
    }

    // ------------------------------------------------- S5 AccessManaged restricted

    function testRestrictedSelectorExecutesThroughTimelockOnly() public {
        // Neither the Governor nor the (revoked) deployer can call it directly.
        vm.prank(address(governor));
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, address(governor)));
        router.setSupportedToken(token, true);
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, deployer));
        router.setSupportedToken(token, true);

        string memory description = "Support token";
        Call memory c = _call(address(router), abi.encodeCall(RevenueRouter.setSupportedToken, (token, true)), description);
        uint256 id = _propose(c, description);
        _vote(id);
        _queue(id, c);

        // An unauthorized wallet cannot execute the timelock operation directly.
        vm.warp(block.timestamp + MIN_DELAY);
        bytes32 executorRole = timelock.EXECUTOR_ROLE();
        vm.prank(outsider);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, outsider, executorRole)
        );
        timelock.executeBatch(c.targets, c.values, c.calldatas, 0, bytes20(address(governor)) ^ c.descriptionHash);
        assertFalse(router.supportedTokens(token));

        governor.execute(c.targets, c.values, c.calldatas, c.descriptionHash);
        assertTrue(router.supportedTokens(token));
    }

    function testTargetThatDoesNotAuthorizeTheTimelockRejectsExecution() public {
        string memory description = "Locked router";
        Call memory c = _call(address(lockedRouter), abi.encodeCall(RevenueRouter.setSupportedToken, (token, true)), description);
        uint256 id = _propose(c, description);
        _vote(id);
        _queue(id, c);

        vm.warp(block.timestamp + MIN_DELAY);
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, address(timelock)));
        governor.execute(c.targets, c.values, c.calldatas, c.descriptionHash);
        assertFalse(lockedRouter.supportedTokens(token));
        assertEq(uint8(governor.state(id)), uint8(IGovernor.ProposalState.Queued));
    }

    // ------------------------------------------------------------- S6 role hygiene

    function testOnlyGovernorCanScheduleOnTimelock() public {
        Call memory c = _revenuePolicyCall("direct schedule");
        address[] memory wallets = new address[](3);
        wallets[0] = outsider;
        wallets[1] = deployer;
        wallets[2] = voter;

        for (uint256 i; i < wallets.length; ++i) {
            vm.startPrank(wallets[i]);
            vm.expectRevert(
                abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, wallets[i], timelock.PROPOSER_ROLE())
            );
            timelock.schedule(c.targets[0], 0, c.calldatas[0], 0, bytes32(0), MIN_DELAY);
            vm.expectRevert(
                abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, wallets[i], timelock.PROPOSER_ROLE())
            );
            timelock.scheduleBatch(c.targets, c.values, c.calldatas, 0, bytes32(0), MIN_DELAY);
            vm.stopPrank();
        }
    }

    function testRolesAfterFinalization() public view {
        bytes32[3] memory roles = [timelock.PROPOSER_ROLE(), timelock.EXECUTOR_ROLE(), timelock.DEFAULT_ADMIN_ROLE()];
        for (uint256 i; i < roles.length; ++i) {
            assertFalse(timelock.hasRole(roles[i], deployer), "deployer keeps timelock role");
        }
        assertFalse(timelock.hasRole(timelock.DEFAULT_ADMIN_ROLE(), address(governor)), "governor admin");
        assertTrue(timelock.hasRole(timelock.PROPOSER_ROLE(), address(governor)));
        assertTrue(timelock.hasRole(timelock.EXECUTOR_ROLE(), address(governor)));
        assertTrue(timelock.hasRole(timelock.CANCELLER_ROLE(), address(governor)));

        (bool timelockIsAdmin,) = accessManager.hasRole(accessManager.ADMIN_ROLE(), address(timelock));
        (bool deployerIsAdmin,) = accessManager.hasRole(accessManager.ADMIN_ROLE(), deployer);
        (bool governorIsAdmin,) = accessManager.hasRole(accessManager.ADMIN_ROLE(), address(governor));
        (bool timelockHasCustom,) = accessManager.hasRole(CUSTOM_ROLE, address(timelock));
        assertTrue(timelockIsAdmin, "timelock admin");
        assertFalse(deployerIsAdmin, "deployer admin");
        assertFalse(governorIsAdmin, "governor admin");
        assertFalse(timelockHasCustom, "timelock custom role");
    }

    // ------------------------------------------------------------- S7 fail closed

    function testCancelBeforeQueueByProposer() public {
        Call memory c = _revenuePolicyCall("cancel pending");
        uint256 id = _propose(c, "cancel pending");

        vm.prank(voter);
        governor.cancel(c.targets, c.values, c.calldatas, c.descriptionHash);
        assertEq(uint8(governor.state(id)), uint8(IGovernor.ProposalState.Canceled));
    }

    function testCancelAfterQueueGoesThroughTheCancellerRole() public {
        Call memory c = _revenuePolicyCall("cancel queued");
        uint256 id = _propose(c, "cancel queued");
        _vote(id);
        _queue(id, c);
        bytes32 operationId = _operationId(c);
        assertTrue(timelock.isOperationPending(operationId));

        // The Governor only lets the proposer cancel while Pending.
        vm.prank(voter);
        vm.expectRevert(abi.encodeWithSelector(IGovernor.GovernorUnableToCancel.selector, id, voter));
        governor.cancel(c.targets, c.values, c.calldatas, c.descriptionHash);

        // A queued operation is cancelled by a CANCELLER_ROLE holder on the timelock.
        vm.prank(address(governor));
        timelock.cancel(operationId);
        assertFalse(timelock.isOperationPending(operationId));
        assertEq(uint8(governor.state(id)), uint8(IGovernor.ProposalState.Canceled));

        vm.warp(block.timestamp + MIN_DELAY);
        bytes32 allowed = bytes32((1 << uint8(IGovernor.ProposalState.Succeeded)) | (1 << uint8(IGovernor.ProposalState.Queued)));
        vm.expectRevert(
            abi.encodeWithSelector(
                IGovernor.GovernorUnexpectedProposalState.selector, id, IGovernor.ProposalState.Canceled, allowed
            )
        );
        governor.execute(c.targets, c.values, c.calldatas, c.descriptionHash);
        (uint16 minTreasuryBps,,,) = paramController.getRevenuePolicy(communityId);
        assertEq(minTreasuryBps, 0);
    }

    function testNonCancellerCannotCancelTimelockOperation() public {
        Call memory c = _revenuePolicyCall("cancel direct");
        uint256 id = _propose(c, "cancel direct");
        _vote(id);
        _queue(id, c);

        bytes32 operationId = _operationId(c);
        bytes32 cancellerRole = timelock.CANCELLER_ROLE();
        vm.prank(outsider);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, outsider, cancellerRole)
        );
        timelock.cancel(operationId);
        assertTrue(timelock.isOperationPending(operationId));
    }

    function testExecutedProposalCannotBeExecutedAgain() public {
        Call memory c = _revenuePolicyCall("execute once");
        uint256 id = _propose(c, "execute once");
        _vote(id);
        _queue(id, c);
        vm.warp(block.timestamp + MIN_DELAY);
        governor.execute(c.targets, c.values, c.calldatas, c.descriptionHash);

        bytes32 allowed = bytes32((1 << uint8(IGovernor.ProposalState.Succeeded)) | (1 << uint8(IGovernor.ProposalState.Queued)));
        vm.expectRevert(
            abi.encodeWithSelector(
                IGovernor.GovernorUnexpectedProposalState.selector, id, IGovernor.ProposalState.Executed, allowed
            )
        );
        governor.execute(c.targets, c.values, c.calldatas, c.descriptionHash);
    }

    function testExecuteWithoutQueueIsRejectedByTimelock() public {
        Call memory c = _revenuePolicyCall("skip queue");
        uint256 id = _propose(c, "skip queue");
        _vote(id);
        assertEq(uint8(governor.state(id)), uint8(IGovernor.ProposalState.Succeeded));

        vm.warp(block.timestamp + MIN_DELAY);
        vm.expectRevert(
            abi.encodeWithSelector(
                TimelockController.TimelockUnexpectedOperationState.selector, _operationId(c), bytes32(uint256(1 << uint8(TimelockController.OperationState.Ready)))
            )
        );
        governor.execute(c.targets, c.values, c.calldatas, c.descriptionHash);
    }

    function testWrongCalldataOrDescriptionHashFailsToQueueAndExecute() public {
        Call memory c = _revenuePolicyCall("exact proposal");
        uint256 id = _propose(c, "exact proposal");
        _vote(id);

        bytes[] memory tampered = new bytes[](1);
        tampered[0] = abi.encodeCall(ParamController.setRevenuePolicy, (communityId, 9000, 1000, 1, 500));
        uint256 tamperedId = governor.hashProposal(c.targets, c.values, tampered, c.descriptionHash);
        vm.expectRevert(abi.encodeWithSelector(IGovernor.GovernorNonexistentProposal.selector, tamperedId));
        governor.queue(c.targets, c.values, tampered, c.descriptionHash);

        bytes32 otherHash = keccak256("another description");
        uint256 otherId = governor.hashProposal(c.targets, c.values, c.calldatas, otherHash);
        vm.expectRevert(abi.encodeWithSelector(IGovernor.GovernorNonexistentProposal.selector, otherId));
        governor.queue(c.targets, c.values, c.calldatas, otherHash);

        _queue(id, c);
        vm.warp(block.timestamp + MIN_DELAY);
        vm.expectRevert(abi.encodeWithSelector(IGovernor.GovernorNonexistentProposal.selector, tamperedId));
        governor.execute(c.targets, c.values, tampered, c.descriptionHash);
        vm.expectRevert(abi.encodeWithSelector(IGovernor.GovernorNonexistentProposal.selector, otherId));
        governor.execute(c.targets, c.values, c.calldatas, otherHash);
    }

    function testGovernorWiredToAnotherCommunitysTimelockCannotReachTarget() public {
        // A second community's timelock/governor pair. The first community's registry and
        // ParamController only recognize `timelock`.
        ShiftTimelockController otherTimelock =
            new ShiftTimelockController(MIN_DELAY, new address[](0), new address[](0), address(this));
        ShiftGovernor otherGovernor = new ShiftGovernor(address(membershipToken), otherTimelock);
        otherTimelock.grantRole(otherTimelock.PROPOSER_ROLE(), address(otherGovernor));
        otherTimelock.grantRole(otherTimelock.EXECUTOR_ROLE(), address(otherGovernor));

        Call memory c = _revenuePolicyCall("wrong community");
        vm.prank(voter);
        uint256 id = otherGovernor.propose(c.targets, c.values, c.calldatas, "wrong community");
        vm.roll(otherGovernor.proposalSnapshot(id) + 1);
        vm.prank(voter);
        otherGovernor.castVote(id, 1);
        vm.roll(otherGovernor.proposalDeadline(id) + 1);
        otherGovernor.queue(c.targets, c.values, c.calldatas, c.descriptionHash);
        vm.warp(block.timestamp + MIN_DELAY);

        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, address(otherTimelock)));
        otherGovernor.execute(c.targets, c.values, c.calldatas, c.descriptionHash);
        (uint16 minTreasuryBps,,,) = paramController.getRevenuePolicy(communityId);
        assertEq(minTreasuryBps, 0);
    }

    function testUnknownTargetSelectorFailsExecution() public {
        Call memory c = _call(address(paramController), abi.encodeWithSelector(bytes4(0xdeadbeef)), "unknown selector");
        uint256 id = _propose(c, "unknown selector");
        _vote(id);
        _queue(id, c);

        vm.warp(block.timestamp + MIN_DELAY);
        vm.expectRevert(OZErrors.FailedCall.selector);
        governor.execute(c.targets, c.values, c.calldatas, c.descriptionHash);
        assertEq(uint8(governor.state(id)), uint8(IGovernor.ProposalState.Queued));
    }

    function testNoPathwayBypassesTheTimelock() public {
        // Governor-only functions cannot be reached by an EOA or by the Governor calling itself.
        vm.expectRevert(abi.encodeWithSelector(IGovernor.GovernorOnlyExecutor.selector, deployer));
        governor.setCountingMulti(address(0x1234));

        vm.prank(address(governor));
        vm.expectRevert(abi.encodeWithSelector(IGovernor.GovernorOnlyExecutor.selector, address(governor)));
        governor.setCountingMulti(address(0x1234));

        // The Governor's executor is the timelock, so ETH/targets are only ever called by it.
        assertEq(governor.timelock(), address(timelock));
    }
}
