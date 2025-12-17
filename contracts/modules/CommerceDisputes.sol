// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IDisputeReceiver} from "./interfaces/IDisputeReceiver.sol";
import {Errors} from "../libs/Errors.sol";

/**
 * @title CommerceDisputes
 * @notice Handles disputes for commerce transactions (Marketplace orders, housing reservations)
 * @dev Separate from WorkClaims which is dedicated to ValuableAction verification
 *
 * MVP Implementation Notes:
 * - Supports two outcomes: REFUND_BUYER, PAY_SELLER
 * - Governance overrides NOT supported in v1
 * - Finalization is admin-only (TODO: integrate with verifier/juror system)
 * - Single receiver model (Marketplace only for now)
 */
contract CommerceDisputes {
    // ============ Types ============

    enum DisputeType {
        MARKETPLACE_ORDER,
        HOUSING_RESERVATION
        // FUTURE: Add more commerce dispute types as needed
    }

    enum DisputeOutcome {
        NONE, // Not yet decided
        REFUND_BUYER, // Full refund to buyer
        PAY_SELLER // Full payment to seller via RevenueRouter
        // FUTURE: SPLIT, CUSTOM for partial outcomes
    }

    enum DisputeStatus {
        OPEN, // Dispute created, awaiting resolution
        RESOLVED, // Verifiers decided outcome
        CANCELLED // Dispute cancelled (rare)
    }

    struct Dispute {
        uint256 disputeId;
        uint256 communityId;
        DisputeType disputeType;
        uint256 relatedId; // orderId for MARKETPLACE_ORDER, reservationId for HOUSING
        address buyer;
        address seller;
        uint256 amount; // Escrowed amount in dispute
        string evidenceURI; // IPFS or similar reference
        DisputeOutcome outcome;
        DisputeStatus status;
        uint64 createdAt;
        uint64 resolvedAt;
        // TODO: Add juror selection, voting rounds, timestamps when verifier integration complete
    }

    // ============ State ============

    mapping(uint256 => Dispute) public disputes;
    uint256 public nextDisputeId = 1;

    // Access control
    address public owner;
    mapping(address => bool) public authorizedCallers; // Modules that can open disputes
    address public disputeReceiver; // Marketplace or other receiver

    // Prevent duplicate disputes for same resource
    mapping(DisputeType => mapping(uint256 => uint256)) public activeDisputeFor; // [type][relatedId] => disputeId

    // ============ Events ============

    event DisputeOpened(
        uint256 indexed disputeId,
        DisputeType indexed disputeType,
        uint256 indexed relatedId,
        uint256 communityId,
        address buyer,
        address seller,
        uint256 amount
    );

    event DisputeResolved(
        uint256 indexed disputeId, DisputeType disputeType, uint256 relatedId, DisputeOutcome outcome
    );

    event DisputeCancelled(uint256 indexed disputeId);

    event AuthorizedCallerUpdated(address indexed caller, bool authorized);
    event DisputeReceiverUpdated(address indexed oldReceiver, address indexed newReceiver);

    // ============ Errors ============

    error UnauthorizedCaller();
    error DisputeAlreadyExists(uint256 existingDisputeId);
    error DisputeNotFound(uint256 disputeId);
    error DisputeNotOpen(uint256 disputeId);
    error InvalidOutcome();
    error NoReceiver();

    // ============ Modifiers ============

    modifier onlyOwner() {
        if (msg.sender != owner) revert Errors.UnauthorizedCaller(msg.sender);
        _;
    }

    modifier onlyAuthorized() {
        if (!authorizedCallers[msg.sender]) revert UnauthorizedCaller();
        _;
    }

    // ============ Constructor ============

    constructor(address _owner) {
        owner = _owner;
    }

    // ============ Admin Functions ============

    /**
     * @notice Set whether an address can open disputes
     * @dev Typically Marketplace and other commerce modules
     */
    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        authorizedCallers[caller] = authorized;
        emit AuthorizedCallerUpdated(caller, authorized);
    }

    /**
     * @notice Set the dispute receiver contract (e.g. Marketplace)
     * @dev Receiver must implement IDisputeReceiver
     */
    function setDisputeReceiver(address receiver) external onlyOwner {
        address oldReceiver = disputeReceiver;
        disputeReceiver = receiver;
        emit DisputeReceiverUpdated(oldReceiver, receiver);
    }

    // ============ Core Dispute Functions ============

    /**
     * @notice Open a new dispute for a commerce transaction
     * @dev Only callable by authorized modules (e.g. Marketplace)
     * @param communityId Community where transaction occurred
     * @param disputeType Type of dispute (order, reservation, etc)
     * @param relatedId ID of the disputed resource (orderId, reservationId)
     * @param buyer Buyer/guest address
     * @param seller Seller/host address
     * @param amount Escrowed amount in dispute
     * @param evidenceURI IPFS or other reference to dispute evidence
     * @return disputeId The created dispute ID
     */
    function openDispute(
        uint256 communityId,
        DisputeType disputeType,
        uint256 relatedId,
        address buyer,
        address seller,
        uint256 amount,
        string calldata evidenceURI
    ) external onlyAuthorized returns (uint256 disputeId) {
        // Prevent duplicate disputes for same resource
        uint256 existing = activeDisputeFor[disputeType][relatedId];
        if (existing != 0 && disputes[existing].status == DisputeStatus.OPEN) {
            revert DisputeAlreadyExists(existing);
        }

        disputeId = nextDisputeId++;

        disputes[disputeId] = Dispute({
            disputeId: disputeId,
            communityId: communityId,
            disputeType: disputeType,
            relatedId: relatedId,
            buyer: buyer,
            seller: seller,
            amount: amount,
            evidenceURI: evidenceURI,
            outcome: DisputeOutcome.NONE,
            status: DisputeStatus.OPEN,
            createdAt: uint64(block.timestamp),
            resolvedAt: 0
        });

        activeDisputeFor[disputeType][relatedId] = disputeId;

        emit DisputeOpened(disputeId, disputeType, relatedId, communityId, buyer, seller, amount);
    }

    /**
     * @notice Finalize a dispute with an outcome
     * @dev MVP: Admin-only. TODO: Integrate with verifier/juror voting system
     * @param disputeId The dispute to finalize
     * @param outcome The resolution (REFUND_BUYER or PAY_SELLER)
     */
    function finalizeDispute(uint256 disputeId, DisputeOutcome outcome) external onlyOwner {
        Dispute storage dispute = disputes[disputeId];

        if (dispute.disputeId == 0) revert DisputeNotFound(disputeId);
        if (dispute.status != DisputeStatus.OPEN) revert DisputeNotOpen(disputeId);
        if (outcome == DisputeOutcome.NONE) revert InvalidOutcome();

        dispute.outcome = outcome;
        dispute.status = DisputeStatus.RESOLVED;
        dispute.resolvedAt = uint64(block.timestamp);

        // Clear active dispute mapping
        delete activeDisputeFor[dispute.disputeType][dispute.relatedId];

        emit DisputeResolved(disputeId, dispute.disputeType, dispute.relatedId, outcome);

        // Callback to receiver (Marketplace) to execute economic outcome
        if (disputeReceiver == address(0)) revert NoReceiver();

        // Convert outcome enum to uint8 for interface
        uint8 outcomeValue = outcome == DisputeOutcome.REFUND_BUYER ? 1 : 2;

        IDisputeReceiver(disputeReceiver).onDisputeResolved(disputeId, outcomeValue);
    }

    /**
     * @notice Cancel an open dispute (governance decision)
     * @dev Rare case, requires owner intervention
     */
    function cancelDispute(uint256 disputeId) external onlyOwner {
        Dispute storage dispute = disputes[disputeId];

        if (dispute.disputeId == 0) revert DisputeNotFound(disputeId);
        if (dispute.status != DisputeStatus.OPEN) revert DisputeNotOpen(disputeId);

        dispute.status = DisputeStatus.CANCELLED;
        dispute.resolvedAt = uint64(block.timestamp);

        // Clear active dispute mapping
        delete activeDisputeFor[dispute.disputeType][dispute.relatedId];

        emit DisputeCancelled(disputeId);
    }

    // ============ View Functions ============

    /**
     * @notice Get full dispute details
     */
    function getDispute(uint256 disputeId) external view returns (Dispute memory) {
        return disputes[disputeId];
    }

    /**
     * @notice Check if a resource has an active dispute
     */
    function hasActiveDispute(DisputeType disputeType, uint256 relatedId) external view returns (bool) {
        uint256 disputeId = activeDisputeFor[disputeType][relatedId];
        return disputeId != 0 && disputes[disputeId].status == DisputeStatus.OPEN;
    }
}
