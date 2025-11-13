// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IGovernorLike} from "../core/interfaces/IGovernorLike.sol";

contract DraftsManager {
    enum DraftStatus { DRAFTING, ESCALATED, WON, LOST }
    struct ActionBundle { address[] targets; uint256[] values; bytes[] calldatas; bytes32 actionsHash; }
    struct Draft { uint256 requestId; address proposer; ActionBundle actions; string cid; DraftStatus status; uint256 proposalId; }
    address public governor; Draft[] public drafts;
    event DraftCreated(uint256 indexed draftId, uint256 indexed requestId, address indexed proposer, bytes32 actionsHash, string cid);
    event ProposalEscalated(uint256 indexed draftId, uint256 indexed proposalId);

    constructor(address _governor) { governor = _governor; }

    function createDraft(uint256 requestId, ActionBundle calldata a, string calldata cid) external returns (uint256 id) {
        id = drafts.length; drafts.push(Draft(requestId, msg.sender, a, cid, DraftStatus.DRAFTING, 0));
        emit DraftCreated(id, requestId, msg.sender, a.actionsHash, cid);
    }
    function escalateToProposal(uint256 draftId, bool multiChoice, uint8 numOptions, string calldata description) external returns (uint256 pid) {
        Draft storage d = drafts[draftId];
        if (multiChoice) pid = IGovernorLike(governor).proposeMultiChoice(d.actions.targets, d.actions.values, d.actions.calldatas, description, numOptions);
        else pid = IGovernorLike(governor).propose(d.actions.targets, d.actions.values, d.actions.calldatas, description);
        d.status = DraftStatus.ESCALATED; d.proposalId = pid; emit ProposalEscalated(draftId, pid);
    }
}
