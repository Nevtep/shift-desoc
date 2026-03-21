// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Errors
/// @notice Centralized error definitions for all contracts
library Errors {
    // General errors
    error NotOwner(address caller, address owner);
    error NotAuthorized(address caller);
    error UnauthorizedCaller(address caller);
    error ZeroAddress();
    error InvalidInput(string reason);
    
    // Governance errors  
    error InvalidProposalId(uint256 proposalId);
    error InsufficientVotingPower(address voter, uint256 required, uint256 actual);
    error VotingPeriodEnded(uint256 proposalId, uint256 deadline);
    error ProposalNotActive(uint256 proposalId, uint8 state);
    
    // Multi-choice voting errors
    error InvalidOptionsCount(uint8 options);
    error MultiChoiceAlreadyEnabled(uint256 proposalId);
    error MultiChoiceNotEnabled(uint256 proposalId);
    error InvalidWeightsLength(uint256 provided, uint8 expected);
    error ExcessiveWeightAllocation(uint256 total);
    
    // Engagement verification errors
    error InvalidValuableAction(uint256 valuableActionId);
    error InvalidActionType(uint256 actionTypeId); // Legacy support
    error EngagementNotFound(uint256 engagementId);
    error EngagementAlreadyVerified(uint256 engagementId);
    error InsufficientVerifiers(uint256 available, uint256 required);
    error VerificationWindowExpired(uint256 engagementId, uint256 deadline);
    
    // Token errors
    error InsufficientBalance(address account, uint256 required, uint256 actual);
    error TransferFailed(address from, address to, uint256 amount);
    error InvalidTokenAmount(uint256 amount);
    
    // WorkerSBT errors
    error Soulbound();
    error TokenNotExists(uint256 tokenId);
    error WorkerAlreadyHasToken(address worker);
    error InsufficientWorkerPoints(address worker, uint256 required, uint256 actual);
    error InvalidWorkerPointsAmount(uint256 amount);
    error WorkerPointsDecayTooHigh(uint256 decay, uint256 maxDecay);
}
