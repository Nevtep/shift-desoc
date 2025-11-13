// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {Governor} from "@openzeppelin/contracts/governance/Governor.sol";
import {GovernorSettings} from "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import {GovernorCountingSimple} from "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import {GovernorVotes} from "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import {GovernorVotesQuorumFraction} from "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import {GovernorTimelockControl} from "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import {ICountingMultiChoice} from "./interfaces/ICountingMultiChoice.sol";

contract ShiftGovernor is
    Governor, GovernorSettings, GovernorCountingSimple,
    GovernorVotes, GovernorVotesQuorumFraction, GovernorTimelockControl
{
    mapping(uint256 => uint8) private _numOptions;
    address public multiCounter;

    constructor(address token, address timelock)
        Governor("ShiftGovernor")
        GovernorSettings(1 days, 5 days, 0)
        GovernorVotes(IVotes(token))
        GovernorVotesQuorumFraction(4)
        GovernorTimelockControl(TimelockController(payable(timelock))) {}

    function setCountingMulti(address counter) external onlyGovernance { multiCounter = counter; }

    function proposeMultiChoice(
        address[] memory t, uint256[] memory v, bytes[] memory c, string memory d, uint8 numOptions
    ) public returns (uint256 pid) {
        pid = propose(t, v, c, d);
        _numOptions[pid] = numOptions;
        if (multiCounter != address(0)) ICountingMultiChoice(multiCounter).enableMulti(pid, numOptions);
    }

    function numOptionsOf(uint256 proposalId) external view returns (uint8) { return _numOptions[proposalId]; }

    // Required overrides
    function quorum(uint256 blockNumber) public view override(Governor, GovernorVotesQuorumFraction) returns (uint256) {
        return super.quorum(blockNumber);
    }
    function state(uint256 proposalId) public view override(Governor, GovernorTimelockControl) returns (ProposalState) {
        return super.state(proposalId);
    }
    function _execute(uint256 id, address[] memory t, uint256[] memory v, bytes[] memory c, bytes32 d)
        internal override(Governor, GovernorTimelockControl) { super._execute(id, t, v, c, d); }
    function _cancel(address[] memory t, uint256[] memory v, bytes[] memory c, bytes32 d)
        internal override(Governor, GovernorTimelockControl) returns (uint256) { return super._cancel(t, v, c, d); }
    function _executor() internal view override(Governor, GovernorTimelockControl) returns (address) { return super._executor(); }
    function supportsInterface(bytes4 iid) public view override(Governor, GovernorTimelockControl) returns (bool) { return super.supportsInterface(iid); }
}
