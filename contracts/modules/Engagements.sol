// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Types} from "contracts/libs/Types.sol";
import {Errors} from "contracts/libs/Errors.sol";
import {IVerifierManager} from "contracts/core/interfaces/IVerifierManager.sol";
import {IValuableActionSBT} from "contracts/core/interfaces/IValuableActionSBT.sol";
import {MembershipTokenERC20Votes} from "../tokens/MembershipTokenERC20Votes.sol";
import {ValuableActionRegistry} from "./ValuableActionRegistry.sol";

/// @title Engagements
/// @notice Handles one-shot engagement submissions and M-of-N verification with juror panels
/// @dev Integrates with ValuableActionRegistry for verification parameters and VerifierManager for juror selection
contract Engagements {
    /// @notice Extended engagement structure with verification tracking
    struct Engagement {
        uint256 typeId;              // Action type ID
        address participant;         // Engagement submitter
        string evidenceCID;          // IPFS evidence hash
        Types.EngagementStatus status;    // Current engagement status
        uint64 createdAt;            // Submission timestamp
        uint64 verifyDeadline;       // Verification window deadline
        address[] jurors;           // Assigned juror panel
        mapping(address => bool) hasVoted; // Whether juror has voted
        mapping(address => bool) votes;    // Juror vote decisions (true = approve, false = reject)
        uint32 approvalsCount;      // Number of approvals received
        uint32 rejectionsCount;     // Number of rejections received
        bool resolved;              // Whether engagement has been resolved
    }

    /// @notice Appeal tracking for rejected engagements
    struct Appeal {
        uint256 engagementId;       // Original engagement ID
        address appellant;          // Who submitted appeal
        string appealReason;        // Reason for appeal
        uint64 createdAt;           // Appeal timestamp
        Types.EngagementStatus status;   // Appeal status
        address[] jurors;          // Appeal juror panel
        mapping(address => bool) votes; // Appeal juror votes
        uint32 approvalsCount;     // Appeal approvals
        uint32 rejectionsCount;    // Appeal rejections
        bool resolved;             // Appeal resolved
    }

    /// @notice Core contracts
    ValuableActionRegistry public immutable actionRegistry;
    address public verifierManager;
    address public valuableActionSBT;
    address public governance;
    address public membershipToken;
    uint256 public immutable communityId;

    /// @notice State variables
    uint256 public lastEngagementId;
    uint256 public lastAppealId;

    /// @notice Mappings
    mapping(uint256 => Engagement) public engagements;
    mapping(uint256 => Appeal) public appeals;
    mapping(address => mapping(uint256 => uint64)) public participantCooldowns; // participant => typeId => nextAllowedTime
    mapping(uint256 => uint256[]) public engagementsByParticipant; // participant address hash => engagement IDs
    mapping(uint256 => uint256[]) public pendingEngagements; // typeId => pending engagement IDs

    /// @notice Events for engagement lifecycle
    event EngagementSubmitted(uint256 indexed engagementId, uint256 indexed typeId, address indexed participant, string evidenceCID);
    event JurorsAssigned(uint256 indexed engagementId, address[] jurors);
    event EngagementVerified(uint256 indexed engagementId, address indexed verifier, bool approve);
    event EngagementResolved(
        uint256 indexed engagementId,
        Types.EngagementStatus status,
        uint32 finalApprovals,
        uint32 finalRejections
    );
    event EngagementRevoked(uint256 indexed engagementId, address indexed revoker);
    event AppealSubmitted(uint256 indexed appealId, uint256 indexed engagementId, address indexed appellant, string reason);
    event AppealResolved(uint256 indexed appealId, Types.EngagementStatus status);
    event CooldownUpdated(address indexed participant, uint256 indexed typeId, uint64 nextAllowed);

    /// @notice Access control modifiers
    modifier onlyGovernance() {
        if (msg.sender != governance) revert Errors.NotAuthorized(msg.sender);
        _;
    }

    modifier onlyAssignedJuror(uint256 engagementId) {
        bool isAssigned = false;
        for (uint i = 0; i < engagements[engagementId].jurors.length; i++) {
            if (engagements[engagementId].jurors[i] == msg.sender) {
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
    /// @param _valuableActionSBT ValuableActionSBT contract address
    /// @param _membershipToken MembershipToken contract address for minting rewards
    /// @param _communityId Community identifier for this engagements contract instance
    constructor(
        address _governance,
        address _actionRegistry, 
        address _verifierManager,
        address _valuableActionSBT,
        address _membershipToken,
        uint256 _communityId
    ) {
        if (_governance == address(0)) revert Errors.ZeroAddress();
        if (_actionRegistry == address(0)) revert Errors.ZeroAddress();
        if (_verifierManager == address(0)) revert Errors.ZeroAddress();
        if (_valuableActionSBT == address(0)) revert Errors.ZeroAddress();
        if (_membershipToken == address(0)) revert Errors.ZeroAddress();

        governance = _governance;
        actionRegistry = ValuableActionRegistry(_actionRegistry);
        verifierManager = _verifierManager;
        valuableActionSBT = _valuableActionSBT;
        membershipToken = _membershipToken;
        communityId = _communityId;
    }

    /// @notice Submit a one-shot engagement for verification
    /// @param typeId Action type ID from registry
    /// @param evidenceCID IPFS hash of work evidence
    /// @return engagementId The created engagement ID
    function submit(uint256 typeId, string calldata evidenceCID) external returns (uint256 engagementId) {
        if (bytes(evidenceCID).length == 0) revert Errors.InvalidInput("Evidence CID cannot be empty");
        
        // Check action type exists and is active
        Types.ValuableAction memory action = actionRegistry.getValuableAction(typeId);
        if (!actionRegistry.isValuableActionActive(typeId)) {
            revert Errors.InvalidInput("Action type is not active");
        }
        
        // Check cooldown period
        uint64 nextAllowed = participantCooldowns[msg.sender][typeId];
        if (block.timestamp < nextAllowed) {
            revert Errors.InvalidInput("Participant is in cooldown period");
        }

        // Check max concurrent engagements for this action type
        uint256 currentConcurrent = _countActiveEngagements(msg.sender, typeId);
        if (currentConcurrent >= action.maxConcurrent) {
            revert Errors.InvalidInput("Too many concurrent engagements for this action type");
        }

        // Create engagement
        engagementId = ++lastEngagementId;
        Engagement storage engagement = engagements[engagementId];
        engagement.typeId = typeId;
        engagement.participant = msg.sender;
        engagement.evidenceCID = evidenceCID;
        engagement.status = Types.EngagementStatus.Pending;
        engagement.createdAt = uint64(block.timestamp);
        
        // Set verification deadline from ValuableActionRegistry
        engagement.verifyDeadline = uint64(block.timestamp + action.verifyWindow);

        // Assign juror panel via VerifierManager using registry parameters
        if (verifierManager != address(0) && verifierManager.code.length > 0) {
            try IVerifierManager(verifierManager).selectJurors(
                engagementId,
                communityId,
                action.panelSize,
                uint256(keccak256(abi.encode(block.timestamp, block.prevrandao, engagementId))),
                false // Use community configuration for weighting
            ) returns (address[] memory selectedJurors) {
                engagement.jurors = selectedJurors;
                emit JurorsAssigned(engagementId, selectedJurors);
            // solhint-disable-next-line no-empty-blocks
            } catch {
                // If verifier selection fails, leave jurors empty for manual assignment
                // This allows the system to still function with fallback mechanisms
            }
        }
        
        // Track pending engagements
        pendingEngagements[typeId].push(engagementId);
        engagementsByParticipant[uint256(uint160(msg.sender))].push(engagementId);

        emit EngagementSubmitted(engagementId, typeId, msg.sender, evidenceCID);
    }

    /// @notice Assign jurors to an engagement (called by VerifierManager)
    /// @param engagementId Engagement to assign jurors to
    /// @param jurors Array of selected juror addresses
    function assignJurors(uint256 engagementId, address[] calldata jurors) external {
        if (msg.sender != verifierManager) revert Errors.NotAuthorized(msg.sender);
        if (engagementId == 0 || engagementId > lastEngagementId) revert Errors.InvalidInput("Invalid engagement ID");
        
        Engagement storage engagement = engagements[engagementId];
        if (engagement.status != Types.EngagementStatus.Pending) revert Errors.InvalidInput("Engagement not pending");
        if (jurors.length == 0) revert Errors.InvalidInput("No jurors provided");

        engagement.jurors = jurors;
        emit JurorsAssigned(engagementId, jurors);
    }

    /// @notice Submit verification vote as assigned juror
    /// @param engagementId Engagement ID to vote on
    /// @param approve True to approve, false to reject
    function verify(uint256 engagementId, bool approve) external onlyAssignedJuror(engagementId) {
        Engagement storage engagement = engagements[engagementId];
        
        if (engagement.resolved) revert Errors.InvalidInput("Engagement already resolved");
        if (block.timestamp > engagement.verifyDeadline) revert Errors.InvalidInput("Verification deadline passed");
        if (engagement.hasVoted[msg.sender]) revert Errors.InvalidInput("Juror already voted");

        // Record vote
        engagement.hasVoted[msg.sender] = true;
        engagement.votes[msg.sender] = approve;
        
        if (approve) {
            engagement.approvalsCount++;
        } else {
            engagement.rejectionsCount++;
        }

        emit EngagementVerified(engagementId, msg.sender, approve);

        // Check if we have enough votes to resolve
        // This would get jurorsMin from ValuableActionRegistry
        // For now using simple majority
        uint32 requiredApprovals = uint32(engagement.jurors.length / 2 + 1);
        uint32 requiredRejections = uint32(engagement.jurors.length / 2 + 1);

        if (engagement.approvalsCount >= requiredApprovals) {
            _resolveEngagement(engagementId, Types.EngagementStatus.Approved);
        } else if (engagement.rejectionsCount >= requiredRejections) {
            _resolveEngagement(engagementId, Types.EngagementStatus.Rejected);
        }
    }

    /// @notice Submit appeal for rejected engagement
    /// @param engagementId Original engagement ID
    /// @param reason Reason for appeal
    /// @return appealId Created appeal ID
    function submitAppeal(uint256 engagementId, string calldata reason) external returns (uint256 appealId) {
        if (engagementId == 0 || engagementId > lastEngagementId) revert Errors.InvalidInput("Invalid engagement ID");
        
        Engagement storage engagement = engagements[engagementId];
        if (engagement.participant != msg.sender) revert Errors.NotAuthorized(msg.sender);
        if (engagement.status != Types.EngagementStatus.Rejected) revert Errors.InvalidInput("Can only appeal rejected engagements");
        if (bytes(reason).length == 0) revert Errors.InvalidInput("Appeal reason cannot be empty");

        // Check if action type allows appeals (revocable field)
        // This would check ValuableActionRegistry.getValuableAction(typeId).revocable

        appealId = ++lastAppealId;
        Appeal storage appeal = appeals[appealId];
        appeal.engagementId = engagementId;
        appeal.appellant = msg.sender;
        appeal.appealReason = reason;
        appeal.createdAt = uint64(block.timestamp);
        appeal.status = Types.EngagementStatus.Pending;

        emit AppealSubmitted(appealId, engagementId, msg.sender, reason);
    }

    /// @notice Revoke engagement (governance only, for revocable action types)
    /// @param engagementId Engagement to revoke
    function revoke(uint256 engagementId) external onlyGovernance {
        if (engagementId == 0 || engagementId > lastEngagementId) revert Errors.InvalidInput("Invalid engagement ID");
        
        Engagement storage engagement = engagements[engagementId];
        if (engagement.resolved && engagement.status == Types.EngagementStatus.Approved) {
            // Check if action type allows revocation
            // This would check ValuableActionRegistry.getValuableAction(engagement.typeId).revocable
            
            engagement.status = Types.EngagementStatus.Revoked;
            
            // TODO: Handle SBT burning or ParticipantPoints deduction
            
            emit EngagementRevoked(engagementId, msg.sender);
        }
    }

    /// @notice Internal function to resolve engagement
    /// @param engagementId Engagement to resolve
    /// @param status Final status
    function _resolveEngagement(uint256 engagementId, Types.EngagementStatus status) internal {
        Engagement storage engagement = engagements[engagementId];
        engagement.status = status;
        engagement.resolved = true;

        // Report verification results to VerifierManager (replaces old reputation system)
        if (verifierManager != address(0) && verifierManager.code.length > 0 && engagement.jurors.length > 0) {
            _reportVerificationResults(engagementId, status);
        }

        if (status == Types.EngagementStatus.Approved) {
            // Get ValuableAction data for rewards and cooldown
            Types.ValuableAction memory valuableAction = actionRegistry.getValuableAction(engagement.typeId);
            
            // Set cooldown for participant based on action configuration
            if (valuableAction.cooldownPeriod > 0) {
                participantCooldowns[engagement.participant][engagement.typeId] = uint64(block.timestamp + valuableAction.cooldownPeriod);
            }
            
            // Mint MembershipTokens for governance participation
            if (membershipToken != address(0) && valuableAction.membershipTokenReward > 0) {
                string memory reason = string(abi.encodePacked(
                    "ValuableAction #", 
                    _uint2str(engagement.typeId), 
                    " completion - Engagement #", 
                    _uint2str(engagementId)
                ));
                
                MembershipTokenERC20Votes(membershipToken).mint(
                    engagement.participant, 
                    valuableAction.membershipTokenReward,
                    reason
                );
            }
            
            // Mint typed engagement SBT
            if (valuableActionSBT != address(0)) {
                uint256 participantPoints = valuableAction.membershipTokenReward > 0 
                    ? valuableAction.membershipTokenReward 
                    : 10; // Default 10 points

                bytes memory metadata = abi.encodePacked(
                    "{\"type\":\"engagement\",\"id\":", 
                    _uint2str(engagementId),
                    ",\"valuableAction\":", 
                    _uint2str(engagement.typeId),
                    ",\"points\":", 
                    _uint2str(participantPoints),
                    ",\"timestamp\":", 
                    _uint2str(block.timestamp),
                    "}"
                );

                IValuableActionSBT(valuableActionSBT).mintEngagement(
                    engagement.participant,
                    communityId,
                    _mapCategoryToSubtype(valuableAction.category),
                    bytes32(engagement.typeId),
                    metadata
                );
            }
            
            emit CooldownUpdated(engagement.participant, engagement.typeId, participantCooldowns[engagement.participant][engagement.typeId]);
        }

        // Remove from pending engagements
        _removePendingEngagement(engagement.typeId, engagementId);

        emit EngagementResolved(engagementId, status, engagement.approvalsCount, engagement.rejectionsCount);
    }

    /// @notice Report verification results and potential fraud to VerifierManager
    /// @param engagementId Engagement ID that was resolved
    /// @param finalStatus Final engagement status (Approved or Rejected)
    function _reportVerificationResults(uint256 engagementId, Types.EngagementStatus finalStatus) internal {
        Engagement storage engagement = engagements[engagementId];
        
        if (engagement.jurors.length == 0) return;
        
        // Identify jurors who voted incorrectly (potential fraud cases)
        address[] memory incorrectVoters = new address[](engagement.jurors.length);
        uint256 incorrectCount = 0;
        
        for (uint256 i = 0; i < engagement.jurors.length; i++) {
            address juror = engagement.jurors[i];
            
            // Only consider jurors who actually voted
            if (!engagement.hasVoted[juror]) {
                continue; // Non-participation is handled separately from incorrect voting
            }
            
            // Get how the juror voted (true = approved, false = rejected)
            bool jurorApproved = engagement.votes[juror];
            
            // Check if juror voted against the final outcome
            bool votedIncorrectly = (finalStatus == Types.EngagementStatus.Approved) ? !jurorApproved : jurorApproved;
            
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
                "engagement-", _uint2str(engagementId), 
                "-incorrect-votes-", _uint2str(uint256(finalStatus))
            ));
            
            // Report to VerifierManager for governance review
            try IVerifierManager(verifierManager).reportFraud(
                engagementId, communityId, offenders, evidenceCID
            ) {
                // Fraud report successful - governance will handle from here
            // solhint-disable-next-line no-empty-blocks  
            } catch {
                // If fraud report fails, continue - this is not critical for engagement resolution
                // The fraud can still be reported manually through governance
            }
        }
    }

    /// @notice Remove engagement from pending list
    /// @param typeId Action type ID
    /// @param engagementId Engagement ID to remove
    function _removePendingEngagement(uint256 typeId, uint256 engagementId) internal {
        uint256[] storage pending = pendingEngagements[typeId];
        for (uint256 i = 0; i < pending.length; i++) {
            if (pending[i] == engagementId) {
                pending[i] = pending[pending.length - 1];
                pending.pop();
                break;
            }
        }
    }

    /// @notice Get engagement details
    /// @param engagementId Engagement ID
    /// @return typeId Action type ID
    /// @return participant Participant address
    /// @return evidenceCID Evidence IPFS hash
    /// @return status Engagement status
    /// @return createdAt Creation timestamp
    /// @return verifyDeadline Verification deadline
    /// @return jurors Assigned jurors
    /// @return approvalsCount Number of approvals
    /// @return rejectionsCount Number of rejections
    /// @return resolved Whether resolved
    // solhint-disable-next-line ordering
    function getEngagement(uint256 engagementId) external view returns (
        uint256 typeId,
        address participant,
        string memory evidenceCID,
        Types.EngagementStatus status,
        uint64 createdAt,
        uint64 verifyDeadline,
        address[] memory jurors,
        uint32 approvalsCount,
        uint32 rejectionsCount,
        bool resolved
    ) {
        if (engagementId == 0 || engagementId > lastEngagementId) revert Errors.InvalidInput("Invalid engagement ID");
        
        Engagement storage engagement = engagements[engagementId];
        return (
            engagement.typeId,
            engagement.participant,
            engagement.evidenceCID,
            engagement.status,
            engagement.createdAt,
            engagement.verifyDeadline,
            engagement.jurors,
            engagement.approvalsCount,
            engagement.rejectionsCount,
            engagement.resolved
        );
    }

    /// @notice Get pending engagements for action type
    /// @param typeId Action type ID
    /// @return Array of pending engagement IDs
    function getPendingEngagements(uint256 typeId) external view returns (uint256[] memory) {
        return pendingEngagements[typeId];
    }

    /// @notice Get engagements by participant
    /// @param participant Participant address
    /// @return Array of engagement IDs for participant
    function getEngagementsByParticipant(address participant) external view returns (uint256[] memory) {
        return engagementsByParticipant[uint256(uint160(participant))];
    }

    /// @notice Check if juror has voted on engagement
    /// @param engagementId Engagement ID
    /// @param juror Juror address
    /// @return Whether juror has voted
    function hasJurorVoted(uint256 engagementId, address juror) external view returns (bool) {
        return engagements[engagementId].votes[juror];
    }

    /// @notice Get participant cooldown info
    /// @param participant Participant address
    /// @param typeId Action type ID
    /// @return nextAllowed Next allowed submission time
    function getParticipantCooldown(address participant, uint256 typeId) external view returns (uint64 nextAllowed) {
        return participantCooldowns[participant][typeId];
    }

    /// @notice Update contract addresses (governance only)
    /// @dev actionRegistry and communityId are immutable and cannot be updated
    /// @param _verifierManager New VerifierManager address
    /// @param _valuableActionSBT New ValuableActionSBT address
    function updateContracts(
        address _verifierManager, 
        address _valuableActionSBT
    ) external onlyGovernance {
        if (_verifierManager != address(0)) verifierManager = _verifierManager;
        if (_valuableActionSBT != address(0)) valuableActionSBT = _valuableActionSBT;
    }

    /// @notice Update governance address
    /// @param _governance New governance address
    function updateGovernance(address _governance) external onlyGovernance {
        if (_governance == address(0)) revert Errors.ZeroAddress();
        governance = _governance;
    }

    /// @notice Get the community ID for this engagements contract
    /// @return The immutable community identifier
    function getCommunityId() external view returns (uint256) {
        return communityId;
    }

    /// @dev Count active engagements for a participant for a specific action type
    /// @param participant Participant address
    /// @param typeId Action type ID
    /// @return count Number of active engagements
    function _countActiveEngagements(address participant, uint256 typeId) internal view returns (uint256 count) {
        uint256[] storage participantEngagements = engagementsByParticipant[uint256(uint160(participant))];
        for (uint256 i = 0; i < participantEngagements.length; i++) {
            Engagement storage engagement = engagements[participantEngagements[i]];
            if (engagement.typeId == typeId && engagement.status == Types.EngagementStatus.Pending) {
                count++;
            }
        }
    }

    /// @notice Get basic engagement info (excludes mappings)
    /// @param engagementId Engagement ID to get info for
    /// @return typeId Action type ID
    /// @return participant Participant address
    /// @return evidenceCID Evidence IPFS hash
    /// @return status Engagement status
    /// @return createdAt Creation timestamp
    /// @return verifyDeadline Verification deadline
    /// @return approvalsCount Number of approvals
    /// @return rejectionsCount Number of rejections
    function getEngagementInfo(uint256 engagementId) external view returns (
        uint256 typeId,
        address participant,
        string memory evidenceCID,
        Types.EngagementStatus status,
        uint64 createdAt,
        uint64 verifyDeadline,
        uint32 approvalsCount,
        uint32 rejectionsCount
    ) {
        Engagement storage engagement = engagements[engagementId];
        return (
            engagement.typeId,
            engagement.participant,
            engagement.evidenceCID,
            engagement.status,
            engagement.createdAt,
            engagement.verifyDeadline,
            engagement.approvalsCount,
            engagement.rejectionsCount
        );
    }

    /// @notice Get jurors assigned to an engagement
    /// @param engagementId Engagement ID
    /// @return jurors Array of juror addresses
    function getEngagementJurors(uint256 engagementId) external view returns (address[] memory jurors) {
        return engagements[engagementId].jurors;
    }

    /// @dev Map action category to engagement subtype for SBT issuance
    function _mapCategoryToSubtype(Types.ActionCategory category) internal pure returns (Types.EngagementSubtype) {
        if (category == Types.ActionCategory.CREDENTIAL) return Types.EngagementSubtype.CREDENTIAL;
        return Types.EngagementSubtype.WORK;
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
