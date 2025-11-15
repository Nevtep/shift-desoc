// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Types} from "contracts/libs/Types.sol";
import {Errors} from "contracts/libs/Errors.sol";
import {IVerifierPool} from "contracts/core/interfaces/IVerifierPool.sol";

/// @title Claims
/// @notice Handles work claim submissions and M-of-N verification with juror panels
/// @dev Integrates with ActionTypeRegistry for verification parameters and VerifierPool for juror selection
contract Claims {
    /// @notice Extended claim structure with verification tracking
    struct Claim {
        uint256 typeId;              // Action type ID
        address worker;              // Claim submitter
        string evidenceCID;          // IPFS evidence hash
        Types.ClaimStatus status;    // Current claim status
        uint64 createdAt;           // Submission timestamp
        uint64 verifyDeadline;      // Verification window deadline
        address[] jurors;           // Assigned juror panel
        mapping(address => bool) hasVoted; // Whether juror has voted
        mapping(address => bool) votes;    // Juror vote decisions (true = approve, false = reject)
        uint32 approvalsCount;      // Number of approvals received
        uint32 rejectionsCount;     // Number of rejections received
        bool resolved;              // Whether claim has been resolved
    }

    /// @notice Appeal tracking for rejected claims
    struct Appeal {
        uint256 claimId;            // Original claim ID
        address appellant;          // Who submitted appeal
        string appealReason;        // Reason for appeal
        uint64 createdAt;          // Appeal timestamp
        Types.ClaimStatus status;   // Appeal status
        address[] jurors;          // Appeal juror panel
        mapping(address => bool) votes; // Appeal juror votes
        uint32 approvalsCount;     // Appeal approvals
        uint32 rejectionsCount;    // Appeal rejections
        bool resolved;             // Appeal resolved
    }

    /// @notice Events for claim lifecycle
    event ClaimSubmitted(uint256 indexed claimId, uint256 indexed typeId, address indexed worker, string evidenceCID);
    event JurorsAssigned(uint256 indexed claimId, address[] jurors);
    event ClaimVerified(uint256 indexed claimId, address indexed verifier, bool approve);
    event ClaimResolved(uint256 indexed claimId, Types.ClaimStatus status, uint32 finalApprovals, uint32 finalRejections);
    event ClaimRevoked(uint256 indexed claimId, address indexed revoker);
    event AppealSubmitted(uint256 indexed appealId, uint256 indexed claimId, address indexed appellant, string reason);
    event AppealResolved(uint256 indexed appealId, Types.ClaimStatus status);
    event CooldownUpdated(address indexed worker, uint256 indexed typeId, uint64 nextAllowed);

    /// @notice State variables
    uint256 public lastClaimId;
    uint256 public lastAppealId;
    
    /// @notice Core contracts
    address public actionRegistry;
    address public verifierPool;
    address public workerSBT;
    address public governance;

    /// @notice Mappings
    mapping(uint256 => Claim) public claims;
    mapping(uint256 => Appeal) public appeals;
    mapping(address => mapping(uint256 => uint64)) public workerCooldowns; // worker => typeId => nextAllowedTime
    mapping(uint256 => uint256[]) public claimsByWorker; // worker address hash => claim IDs
    mapping(uint256 => uint256[]) public pendingClaims; // typeId => pending claim IDs

    /// @notice Access control modifiers
    modifier onlyGovernance() {
        if (msg.sender != governance) revert Errors.NotAuthorized(msg.sender);
        _;
    }

    modifier onlyAssignedJuror(uint256 claimId) {
        bool isAssigned = false;
        for (uint i = 0; i < claims[claimId].jurors.length; i++) {
            if (claims[claimId].jurors[i] == msg.sender) {
                isAssigned = true;
                break;
            }
        }
        if (!isAssigned) revert Errors.NotAuthorized(msg.sender);
        _;
    }

    /// @notice Constructor
    /// @param _governance Governance contract address
    /// @param _actionRegistry ActionTypeRegistry contract address  
    /// @param _verifierPool VerifierPool contract address
    /// @param _workerSBT WorkerSBT contract address
    constructor(
        address _governance,
        address _actionRegistry, 
        address _verifierPool,
        address _workerSBT
    ) {
        if (_governance == address(0)) revert Errors.ZeroAddress();
        if (_actionRegistry == address(0)) revert Errors.ZeroAddress();
        if (_verifierPool == address(0)) revert Errors.ZeroAddress();
        if (_workerSBT == address(0)) revert Errors.ZeroAddress();

        governance = _governance;
        actionRegistry = _actionRegistry;
        verifierPool = _verifierPool;
        workerSBT = _workerSBT;
    }

    /// @notice Submit a work claim for verification
    /// @param typeId Action type ID from registry
    /// @param evidenceCID IPFS hash of work evidence
    /// @return claimId The created claim ID
    function submit(uint256 typeId, string calldata evidenceCID) external returns (uint256 claimId) {
        if (bytes(evidenceCID).length == 0) revert Errors.InvalidInput("Evidence CID cannot be empty");
        
        // Check action type exists and is active
        // Note: This would call ActionTypeRegistry.getActionType() and ActionTypeRegistry.isActionTypeActive()
        // For now we'll assume the interfaces exist
        
        // Check cooldown period
        uint64 nextAllowed = workerCooldowns[msg.sender][typeId];
        if (block.timestamp < nextAllowed) {
            revert Errors.InvalidInput("Worker is in cooldown period");
        }

        // Create claim
        claimId = ++lastClaimId;
        Claim storage claim = claims[claimId];
        claim.typeId = typeId;
        claim.worker = msg.sender;
        claim.evidenceCID = evidenceCID;
        claim.status = Types.ClaimStatus.Pending;
        claim.createdAt = uint64(block.timestamp);
        
        // Set verification deadline (would get verifyWindow from ActionTypeRegistry)
        // For now using 24 hours as default
        claim.verifyDeadline = uint64(block.timestamp + 24 hours);

        // Assign juror panel via VerifierPool (if available and has code)
        if (verifierPool != address(0) && verifierPool.code.length > 0) {
            try IVerifierPool(verifierPool).selectJurors(
                claimId,
                3, // Default panel size - would come from ActionTypeRegistry
                uint256(keccak256(abi.encode(block.timestamp, block.prevrandao, claimId)))
            ) returns (address[] memory selectedJurors) {
                claim.jurors = selectedJurors;
                emit JurorsAssigned(claimId, selectedJurors);
            } catch {
                // If verifier selection fails, leave jurors empty for manual assignment
                // This allows the system to still function with fallback mechanisms
            }
        }
        
        // Track pending claims
        pendingClaims[typeId].push(claimId);
        claimsByWorker[uint256(uint160(msg.sender))].push(claimId);

        emit ClaimSubmitted(claimId, typeId, msg.sender, evidenceCID);
    }

    /// @notice Assign jurors to a claim (called by VerifierPool)
    /// @param claimId Claim to assign jurors to
    /// @param jurors Array of selected juror addresses
    function assignJurors(uint256 claimId, address[] calldata jurors) external {
        if (msg.sender != verifierPool) revert Errors.NotAuthorized(msg.sender);
        if (claimId == 0 || claimId > lastClaimId) revert Errors.InvalidInput("Invalid claim ID");
        
        Claim storage claim = claims[claimId];
        if (claim.status != Types.ClaimStatus.Pending) revert Errors.InvalidInput("Claim not pending");
        if (jurors.length == 0) revert Errors.InvalidInput("No jurors provided");

        claim.jurors = jurors;
        emit JurorsAssigned(claimId, jurors);
    }

    /// @notice Submit verification vote as assigned juror
    /// @param claimId Claim ID to vote on
    /// @param approve True to approve, false to reject
    function verify(uint256 claimId, bool approve) external onlyAssignedJuror(claimId) {
        Claim storage claim = claims[claimId];
        
        if (claim.resolved) revert Errors.InvalidInput("Claim already resolved");
        if (block.timestamp > claim.verifyDeadline) revert Errors.InvalidInput("Verification deadline passed");
        if (claim.hasVoted[msg.sender]) revert Errors.InvalidInput("Juror already voted");

        // Record vote
        claim.hasVoted[msg.sender] = true;
        claim.votes[msg.sender] = approve;
        
        if (approve) {
            claim.approvalsCount++;
        } else {
            claim.rejectionsCount++;
        }

        emit ClaimVerified(claimId, msg.sender, approve);

        // Check if we have enough votes to resolve
        // This would get jurorsMin from ActionTypeRegistry
        // For now using simple majority
        uint32 requiredApprovals = uint32(claim.jurors.length / 2 + 1);
        uint32 requiredRejections = uint32(claim.jurors.length / 2 + 1);

        if (claim.approvalsCount >= requiredApprovals) {
            _resolveClaim(claimId, Types.ClaimStatus.Approved);
        } else if (claim.rejectionsCount >= requiredRejections) {
            _resolveClaim(claimId, Types.ClaimStatus.Rejected);
        }
    }

    /// @notice Submit appeal for rejected claim
    /// @param claimId Original claim ID
    /// @param reason Reason for appeal
    /// @return appealId Created appeal ID
    function submitAppeal(uint256 claimId, string calldata reason) external returns (uint256 appealId) {
        if (claimId == 0 || claimId > lastClaimId) revert Errors.InvalidInput("Invalid claim ID");
        
        Claim storage claim = claims[claimId];
        if (claim.worker != msg.sender) revert Errors.NotAuthorized(msg.sender);
        if (claim.status != Types.ClaimStatus.Rejected) revert Errors.InvalidInput("Can only appeal rejected claims");
        if (bytes(reason).length == 0) revert Errors.InvalidInput("Appeal reason cannot be empty");

        // Check if action type allows appeals (revocable field)
        // This would check ActionTypeRegistry.getActionType(typeId).revocable

        appealId = ++lastAppealId;
        Appeal storage appeal = appeals[appealId];
        appeal.claimId = claimId;
        appeal.appellant = msg.sender;
        appeal.appealReason = reason;
        appeal.createdAt = uint64(block.timestamp);
        appeal.status = Types.ClaimStatus.Pending;

        emit AppealSubmitted(appealId, claimId, msg.sender, reason);
    }

    /// @notice Revoke claim (governance only, for revocable action types)
    /// @param claimId Claim to revoke
    function revoke(uint256 claimId) external onlyGovernance {
        if (claimId == 0 || claimId > lastClaimId) revert Errors.InvalidInput("Invalid claim ID");
        
        Claim storage claim = claims[claimId];
        if (claim.resolved && claim.status == Types.ClaimStatus.Approved) {
            // Check if action type allows revocation
            // This would check ActionTypeRegistry.getActionType(claim.typeId).revocable
            
            claim.status = Types.ClaimStatus.Revoked;
            
            // TODO: Handle SBT burning or WorkerPoints deduction
            
            emit ClaimRevoked(claimId, msg.sender);
        }
    }

    /// @notice Internal function to resolve claim
    /// @param claimId Claim to resolve
    /// @param status Final status
    function _resolveClaim(uint256 claimId, Types.ClaimStatus status) internal {
        Claim storage claim = claims[claimId];
        claim.status = status;
        claim.resolved = true;

        // Update verifier reputations based on their votes
        if (verifierPool != address(0) && verifierPool.code.length > 0 && claim.jurors.length > 0) {
            _updateVerifierReputations(claimId, status);
        }

        if (status == Types.ClaimStatus.Approved) {
            // Set cooldown for worker
            // This would get cooldown period from ActionTypeRegistry
            uint64 cooldownPeriod = 1 hours; // Default
            workerCooldowns[claim.worker][claim.typeId] = uint64(block.timestamp + cooldownPeriod);
            
            // TODO: Mint SBT and award WorkerPoints
            // This would call WorkerSBT.mint() and update WorkerPoints
            
            emit CooldownUpdated(claim.worker, claim.typeId, workerCooldowns[claim.worker][claim.typeId]);
        }

        // Remove from pending claims
        _removePendingClaim(claim.typeId, claimId);

        emit ClaimResolved(claimId, status, claim.approvalsCount, claim.rejectionsCount);
    }

    /// @notice Update verifier reputations based on claim resolution
    /// @param claimId Claim ID that was resolved
    /// @param finalStatus Final claim status (Approved or Rejected)
    function _updateVerifierReputations(uint256 claimId, Types.ClaimStatus finalStatus) internal {
        Claim storage claim = claims[claimId];
        
        if (claim.jurors.length == 0) return;
        
        bool[] memory successful = new bool[](claim.jurors.length);
        
        // TODO: FIX REPUTATION SYSTEM FLAW
        // Current issue: Claims resolve immediately when M votes are reached, 
        // causing N-M jurors who haven't voted yet to be unfairly penalized.
        // This incentivizes rushed voting over thorough evidence review.
        //
        // Potential solutions:
        // 1. Only update reputation for jurors who actually voted before resolution
        // 2. Allow full voting window and resolve based on deadline expiry
        // 3. Implement separate reputation logic for non-participation vs wrong decisions
        // 4. Consider time-weighted voting where early accurate votes get bonus points
        
        // Determine which jurors voted with the majority (successfully)
        for (uint256 i = 0; i < claim.jurors.length; i++) {
            address juror = claim.jurors[i];
            
            // Only consider jurors who actually voted
            if (!claim.hasVoted[juror]) {
                successful[i] = false; // Didn't vote = unsuccessful
                continue;
            }
            
            // Get how the juror voted (true = approved, false = rejected)
            bool jurorApproved = claim.votes[juror];
            
            // Juror was successful if they voted with the final outcome
            successful[i] = (finalStatus == Types.ClaimStatus.Approved) ? jurorApproved : !jurorApproved;
        }
        
        // Call VerifierPool to update reputations
        if (verifierPool.code.length > 0) {
            try IVerifierPool(verifierPool).updateReputations(claimId, claim.jurors, successful) {
                // Reputation update successful
            } catch {
                // If reputation update fails, continue - this is not critical for claim resolution
            }
        }
    }

    /// @notice Remove claim from pending list
    /// @param typeId Action type ID
    /// @param claimId Claim ID to remove
    function _removePendingClaim(uint256 typeId, uint256 claimId) internal {
        uint256[] storage pending = pendingClaims[typeId];
        for (uint256 i = 0; i < pending.length; i++) {
            if (pending[i] == claimId) {
                pending[i] = pending[pending.length - 1];
                pending.pop();
                break;
            }
        }
    }

    /// @notice Get claim details
    /// @param claimId Claim ID
    /// @return typeId Action type ID
    /// @return worker Worker address
    /// @return evidenceCID Evidence IPFS hash
    /// @return status Claim status
    /// @return createdAt Creation timestamp
    /// @return verifyDeadline Verification deadline
    /// @return jurors Assigned jurors
    /// @return approvalsCount Number of approvals
    /// @return rejectionsCount Number of rejections
    /// @return resolved Whether resolved
    function getClaim(uint256 claimId) external view returns (
        uint256 typeId,
        address worker,
        string memory evidenceCID,
        Types.ClaimStatus status,
        uint64 createdAt,
        uint64 verifyDeadline,
        address[] memory jurors,
        uint32 approvalsCount,
        uint32 rejectionsCount,
        bool resolved
    ) {
        if (claimId == 0 || claimId > lastClaimId) revert Errors.InvalidInput("Invalid claim ID");
        
        Claim storage claim = claims[claimId];
        return (
            claim.typeId,
            claim.worker,
            claim.evidenceCID,
            claim.status,
            claim.createdAt,
            claim.verifyDeadline,
            claim.jurors,
            claim.approvalsCount,
            claim.rejectionsCount,
            claim.resolved
        );
    }

    /// @notice Get pending claims for action type
    /// @param typeId Action type ID
    /// @return Array of pending claim IDs
    function getPendingClaims(uint256 typeId) external view returns (uint256[] memory) {
        return pendingClaims[typeId];
    }

    /// @notice Get claims by worker
    /// @param worker Worker address
    /// @return Array of claim IDs for worker
    function getClaimsByWorker(address worker) external view returns (uint256[] memory) {
        return claimsByWorker[uint256(uint160(worker))];
    }

    /// @notice Check if juror has voted on claim
    /// @param claimId Claim ID
    /// @param juror Juror address
    /// @return Whether juror has voted
    function hasJurorVoted(uint256 claimId, address juror) external view returns (bool) {
        return claims[claimId].votes[juror];
    }

    /// @notice Get worker cooldown info
    /// @param worker Worker address
    /// @param typeId Action type ID
    /// @return nextAllowed Next allowed submission time
    function getWorkerCooldown(address worker, uint256 typeId) external view returns (uint64 nextAllowed) {
        return workerCooldowns[worker][typeId];
    }

    /// @notice Update core contract addresses (governance only)
    /// @param _actionRegistry New ActionTypeRegistry address
    /// @param _verifierPool New VerifierPool address
    /// @param _workerSBT New WorkerSBT address
    function updateContracts(
        address _actionRegistry,
        address _verifierPool, 
        address _workerSBT
    ) external onlyGovernance {
        if (_actionRegistry != address(0)) actionRegistry = _actionRegistry;
        if (_verifierPool != address(0)) verifierPool = _verifierPool;
        if (_workerSBT != address(0)) workerSBT = _workerSBT;
    }

    /// @notice Update governance address
    /// @param _governance New governance address
    function updateGovernance(address _governance) external onlyGovernance {
        if (_governance == address(0)) revert Errors.ZeroAddress();
        governance = _governance;
    }
}
