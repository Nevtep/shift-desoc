// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Types} from "contracts/libs/Types.sol";
import {Errors} from "contracts/libs/Errors.sol";
import {IVerifierManager} from "contracts/core/interfaces/IVerifierManager.sol";
import {IWorkerSBT} from "contracts/core/interfaces/IWorkerSBT.sol";
import {MembershipTokenERC20Votes} from "../tokens/MembershipTokenERC20Votes.sol";
import {ValuableActionRegistry} from "./ValuableActionRegistry.sol";

/// @title Claims
/// @notice Handles work claim submissions and M-of-N verification with juror panels
/// @dev Integrates with ValuableActionRegistry for verification parameters and VerifierPool for juror selection
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

    /// @notice Core contracts
    ValuableActionRegistry public immutable actionRegistry;
    address public verifierManager;
    address public workerSBT;
    address public governance;
    address public membershipToken;
    uint256 public immutable communityId;

    /// @notice State variables
    uint256 public lastClaimId;
    uint256 public lastAppealId;

    /// @notice Mappings
    mapping(uint256 => Claim) public claims;
    mapping(uint256 => Appeal) public appeals;
    mapping(address => mapping(uint256 => uint64)) public workerCooldowns; // worker => typeId => nextAllowedTime
    mapping(uint256 => uint256[]) public claimsByWorker; // worker address hash => claim IDs
    mapping(uint256 => uint256[]) public pendingClaims; // typeId => pending claim IDs

    /// @notice Events for claim lifecycle
    event ClaimSubmitted(uint256 indexed claimId, uint256 indexed typeId, address indexed worker, string evidenceCID);
    event JurorsAssigned(uint256 indexed claimId, address[] jurors);
    event ClaimVerified(uint256 indexed claimId, address indexed verifier, bool approve);
    event ClaimResolved(
        uint256 indexed claimId, 
        Types.ClaimStatus status, 
        uint32 finalApprovals, 
        uint32 finalRejections
    );
    event ClaimRevoked(uint256 indexed claimId, address indexed revoker);
    event AppealSubmitted(uint256 indexed appealId, uint256 indexed claimId, address indexed appellant, string reason);
    event AppealResolved(uint256 indexed appealId, Types.ClaimStatus status);
    event CooldownUpdated(address indexed worker, uint256 indexed typeId, uint64 nextAllowed);

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
    /// @param _actionRegistry ValuableActionRegistry contract address  
    /// @param _verifierManager VerifierManager contract address
    /// @param _workerSBT WorkerSBT contract address
    /// @param _membershipToken MembershipToken contract address for minting rewards
    /// @param _communityId Community identifier for this claims contract instance
    constructor(
        address _governance,
        address _actionRegistry, 
        address _verifierManager,
        address _workerSBT,
        address _membershipToken,
        uint256 _communityId
    ) {
        if (_governance == address(0)) revert Errors.ZeroAddress();
        if (_actionRegistry == address(0)) revert Errors.ZeroAddress();
        if (_verifierManager == address(0)) revert Errors.ZeroAddress();
        if (_workerSBT == address(0)) revert Errors.ZeroAddress();
        if (_membershipToken == address(0)) revert Errors.ZeroAddress();

        governance = _governance;
        actionRegistry = ValuableActionRegistry(_actionRegistry);
        verifierManager = _verifierManager;
        workerSBT = _workerSBT;
        membershipToken = _membershipToken;
        communityId = _communityId;
    }

    /// @notice Submit a work claim for verification
    /// @param typeId Action type ID from registry
    /// @param evidenceCID IPFS hash of work evidence
    /// @return claimId The created claim ID
    function submit(uint256 typeId, string calldata evidenceCID) external returns (uint256 claimId) {
        if (bytes(evidenceCID).length == 0) revert Errors.InvalidInput("Evidence CID cannot be empty");
        
        // Check action type exists and is active
        Types.ValuableAction memory action = actionRegistry.getValuableAction(typeId);
        if (!actionRegistry.isValuableActionActive(typeId)) {
            revert Errors.InvalidInput("Action type is not active");
        }
        
        // Check cooldown period
        uint64 nextAllowed = workerCooldowns[msg.sender][typeId];
        if (block.timestamp < nextAllowed) {
            revert Errors.InvalidInput("Worker is in cooldown period");
        }

        // Check max concurrent claims for this action type
        uint256 currentConcurrent = _countActiveClaims(msg.sender, typeId);
        if (currentConcurrent >= action.maxConcurrent) {
            revert Errors.InvalidInput("Too many concurrent claims for this action type");
        }

        // Create claim
        claimId = ++lastClaimId;
        Claim storage claim = claims[claimId];
        claim.typeId = typeId;
        claim.worker = msg.sender;
        claim.evidenceCID = evidenceCID;
        claim.status = Types.ClaimStatus.Pending;
        claim.createdAt = uint64(block.timestamp);
        
        // Set verification deadline from ValuableActionRegistry
        claim.verifyDeadline = uint64(block.timestamp + action.verifyWindow);

        // Assign juror panel via VerifierManager using registry parameters
        if (verifierManager != address(0) && verifierManager.code.length > 0) {
            try IVerifierManager(verifierManager).selectJurors(
                claimId,
                communityId,
                action.panelSize,
                uint256(keccak256(abi.encode(block.timestamp, block.prevrandao, claimId))),
                false // Use community configuration for weighting
            ) returns (address[] memory selectedJurors) {
                claim.jurors = selectedJurors;
                emit JurorsAssigned(claimId, selectedJurors);
            // solhint-disable-next-line no-empty-blocks
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

    /// @notice Assign jurors to a claim (called by VerifierManager)
    /// @param claimId Claim to assign jurors to
    /// @param jurors Array of selected juror addresses
    function assignJurors(uint256 claimId, address[] calldata jurors) external {
        if (msg.sender != verifierManager) revert Errors.NotAuthorized(msg.sender);
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
        // This would get jurorsMin from ValuableActionRegistry
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
        // This would check ValuableActionRegistry.getValuableAction(typeId).revocable

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
            // This would check ValuableActionRegistry.getValuableAction(claim.typeId).revocable
            
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

        // Report verification results to VerifierManager (replaces old reputation system)
        if (verifierManager != address(0) && verifierManager.code.length > 0 && claim.jurors.length > 0) {
            _reportVerificationResults(claimId, status);
        }

        if (status == Types.ClaimStatus.Approved) {
            // Get ValuableAction data for rewards and cooldown
            Types.ValuableAction memory valuableAction = actionRegistry.getValuableAction(claim.typeId);
            
            // Set cooldown for worker based on action configuration
            if (valuableAction.cooldownPeriod > 0) {
                workerCooldowns[claim.worker][claim.typeId] = uint64(block.timestamp + valuableAction.cooldownPeriod);
            }
            
            // Mint MembershipTokens for governance participation
            if (membershipToken != address(0) && valuableAction.membershipTokenReward > 0) {
                string memory reason = string(abi.encodePacked(
                    "ValuableAction #", 
                    _uint2str(claim.typeId), 
                    " completion - Claim #", 
                    _uint2str(claimId)
                ));
                
                MembershipTokenERC20Votes(membershipToken).mint(
                    claim.worker, 
                    valuableAction.membershipTokenReward,
                    reason
                );
            }
            
            // Mint SBT and award WorkerPoints
            if (workerSBT != address(0)) {
                uint256 workerPoints = valuableAction.membershipTokenReward > 0 
                    ? valuableAction.membershipTokenReward 
                    : 10; // Default 10 points
                
                // Generate basic metadata URI for the claim
                string memory metadataURI = string(abi.encodePacked(
                    "{\"type\":\"claim\",\"id\":", 
                    _uint2str(claimId),
                    ",\"valuableAction\":", 
                    _uint2str(claim.typeId),
                    ",\"points\":", 
                    _uint2str(workerPoints),
                    ",\"timestamp\":", 
                    _uint2str(block.timestamp),
                    "}"
                ));
                
                IWorkerSBT(workerSBT).mintAndAwardPoints(claim.worker, workerPoints, metadataURI);
            }
            
            emit CooldownUpdated(claim.worker, claim.typeId, workerCooldowns[claim.worker][claim.typeId]);
        }

        // Remove from pending claims
        _removePendingClaim(claim.typeId, claimId);

        emit ClaimResolved(claimId, status, claim.approvalsCount, claim.rejectionsCount);
    }

    /// @notice Report verification results and potential fraud to VerifierManager
    /// @param claimId Claim ID that was resolved
    /// @param finalStatus Final claim status (Approved or Rejected)
    function _reportVerificationResults(uint256 claimId, Types.ClaimStatus finalStatus) internal {
        Claim storage claim = claims[claimId];
        
        if (claim.jurors.length == 0) return;
        
        // Identify jurors who voted incorrectly (potential fraud cases)
        address[] memory incorrectVoters = new address[](claim.jurors.length);
        uint256 incorrectCount = 0;
        
        for (uint256 i = 0; i < claim.jurors.length; i++) {
            address juror = claim.jurors[i];
            
            // Only consider jurors who actually voted
            if (!claim.hasVoted[juror]) {
                continue; // Non-participation is handled separately from incorrect voting
            }
            
            // Get how the juror voted (true = approved, false = rejected)
            bool jurorApproved = claim.votes[juror];
            
            // Check if juror voted against the final outcome
            bool votedIncorrectly = (finalStatus == Types.ClaimStatus.Approved) ? !jurorApproved : jurorApproved;
            
            if (votedIncorrectly) {
                incorrectVoters[incorrectCount] = juror;
                incorrectCount++;
            }
        }
        
        // If there are incorrect voters, report potential fraud
        // Note: In the VPT system, this triggers governance review rather than automatic punishment
        if (incorrectCount > 0) {
            // Trim the array to actual size
            address[] memory offenders = new address[](incorrectCount);
            for (uint256 i = 0; i < incorrectCount; i++) {
                offenders[i] = incorrectVoters[i];
            }
            
            // Generate evidence CID for the fraud report
            string memory evidenceCID = string(abi.encodePacked(
                "claim-", _uint2str(claimId), 
                "-incorrect-votes-", _uint2str(uint256(finalStatus))
            ));
            
            // Report to VerifierManager for governance review
            try IVerifierManager(verifierManager).reportFraud(
                claimId, communityId, offenders, evidenceCID
            ) {
                // Fraud report successful - governance will handle from here
            // solhint-disable-next-line no-empty-blocks  
            } catch {
                // If fraud report fails, continue - this is not critical for claim resolution
                // The fraud can still be reported manually through governance
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
    // solhint-disable-next-line ordering
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

    /// @notice Update contract addresses (governance only)
    /// @dev actionRegistry and communityId are immutable and cannot be updated
    /// @param _verifierManager New VerifierManager address
    /// @param _workerSBT New WorkerSBT address
    function updateContracts(
        address _verifierManager, 
        address _workerSBT
    ) external onlyGovernance {
        if (_verifierManager != address(0)) verifierManager = _verifierManager;
        if (_workerSBT != address(0)) workerSBT = _workerSBT;
    }

    /// @notice Update governance address
    /// @param _governance New governance address
    function updateGovernance(address _governance) external onlyGovernance {
        if (_governance == address(0)) revert Errors.ZeroAddress();
        governance = _governance;
    }

    /// @notice Get the community ID for this claims contract
    /// @return The immutable community identifier
    function getCommunityId() external view returns (uint256) {
        return communityId;
    }

    /// @dev Count active claims for a worker for a specific action type
    /// @param worker Worker address
    /// @param typeId Action type ID
    /// @return count Number of active claims
    function _countActiveClaims(address worker, uint256 typeId) internal view returns (uint256 count) {
        uint256[] storage workerClaims = claimsByWorker[uint256(uint160(worker))];
        for (uint256 i = 0; i < workerClaims.length; i++) {
            Claim storage claim = claims[workerClaims[i]];
            if (claim.typeId == typeId && claim.status == Types.ClaimStatus.Pending) {
                count++;
            }
        }
    }

    /// @notice Get basic claim info (excludes mappings)
    /// @param claimId Claim ID to get info for
    /// @return typeId Action type ID
    /// @return worker Worker address
    /// @return evidenceCID Evidence IPFS hash
    /// @return status Claim status
    /// @return createdAt Creation timestamp
    /// @return verifyDeadline Verification deadline
    /// @return approvalsCount Number of approvals
    /// @return rejectionsCount Number of rejections
    function getClaimInfo(uint256 claimId) external view returns (
        uint256 typeId,
        address worker,
        string memory evidenceCID,
        Types.ClaimStatus status,
        uint64 createdAt,
        uint64 verifyDeadline,
        uint32 approvalsCount,
        uint32 rejectionsCount
    ) {
        Claim storage claim = claims[claimId];
        return (
            claim.typeId,
            claim.worker,
            claim.evidenceCID,
            claim.status,
            claim.createdAt,
            claim.verifyDeadline,
            claim.approvalsCount,
            claim.rejectionsCount
        );
    }

    /// @notice Get jurors assigned to a claim
    /// @param claimId Claim ID
    /// @return jurors Array of juror addresses
    function getClaimJurors(uint256 claimId) external view returns (address[] memory jurors) {
        return claims[claimId].jurors;
    }

    /// @dev Convert uint to string for metadata generation
    function _uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
}
