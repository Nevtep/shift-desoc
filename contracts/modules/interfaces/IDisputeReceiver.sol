// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IDisputeReceiver
 * @notice Interface for contracts that handle dispute resolution callbacks
 * @dev Implemented by Marketplace to handle economic outcomes of disputes
 */
interface IDisputeReceiver {
    /**
     * @notice Called by CommerceDisputes when a dispute is resolved
     * @dev Receiver should execute economic consequences (refund or settlement)
     * @param disputeId The dispute identifier from CommerceDisputes
     * @param outcome The dispute outcome (1 = REFUND_BUYER, 2 = PAY_SELLER)
     */
    function onDisputeResolved(uint256 disputeId, uint8 outcome) external;
}
