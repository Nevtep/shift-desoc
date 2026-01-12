// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IGovernorLike} from "contracts/core/interfaces/IGovernorLike.sol";
import {Errors} from "contracts/libs/Errors.sol";
import {ICommunityRegistry} from "./interfaces/ICommunityRegistry.sol";
import {IRequestHub} from "./interfaces/IRequestHub.sol";

/**
 * @title DraftsManager
 * @notice Collaborative proposal development with versioning, review cycles, and escalation workflows
 * @dev Multi-contributor system enabling community collaboration on governance proposals
 */
contract DraftsManager {

    /* ======== ENUMS ======== */
    
    enum DraftStatus { 
        DRAFTING,      // Active collaborative development
        REVIEW,        // Community review phase  
        FINALIZED,     // Ready for escalation
        ESCALATED,     // Submitted to governance
        WON,          // Proposal succeeded
        LOST          // Proposal failed
    }

    enum ReviewType {
        SUPPORT,       // Positive review
        OPPOSE,        // Negative review
        NEUTRAL,       // Neutral feedback
        REQUEST_CHANGES // Needs modification
    }

    /* ======== STRUCTS ======== */

    struct ActionBundle {
        address[] targets;
        uint256[] values;
        bytes[] calldatas;
        bytes32 actionsHash;
    }

    struct Review {
        address reviewer;
        ReviewType reviewType;
        string reasonCID;      // IPFS content with detailed feedback
        uint64 timestamp;
        bool isActive;         // Can be retracted
    }

    struct ReviewState {
        uint256 supportCount;
        uint256 opposeCount;
        uint256 neutralCount;
        uint256 requestChangesCount;
        uint256 totalReviews;
        mapping(address => Review) reviews;  // reviewer => Review
    }

    struct Draft {
        uint256 communityId;           // Source community
        uint256 requestId;             // Source request (optional)
        address author;                // Original creator
        address[] contributors;        // All contributors
        ActionBundle actions;          // Governance actions
        string[] versionCIDs;         // Version history (IPFS)
        DraftStatus status;
        uint64 createdAt;
        uint64 reviewStartedAt;       // When review phase began
        uint64 finalizedAt;           // When finalized for escalation
        uint256 proposalId;           // Link to governance proposal
        ReviewState reviews;          // Community feedback
        mapping(address => bool) isContributor;  // Quick lookup
    }

    /* ======== STATE VARIABLES ======== */

    address public immutable communityRegistry;
    address public immutable timelock;
    address public governor;
    
    // Draft storage
    Draft[] internal _drafts;
    
    // Configuration parameters (can be updated via governance)
    uint256 public reviewPeriod = 3 days;        // Minimum review time
    uint256 public minReviewsForEscalation = 3;  // Minimum reviews needed
    uint256 public supportThresholdBps = 6000;   // 60% support needed (basis points)
    
    // Mappings for efficient queries
    mapping(uint256 => uint256[]) public communityDrafts;    // communityId => draftIds
    mapping(uint256 => uint256[]) public requestDrafts;      // requestId => draftIds
    mapping(address => uint256[]) public authorDrafts;       // author => draftIds
    mapping(address => uint256[]) public contributorDrafts;  // contributor => draftIds

    /* ======== EVENTS ======== */

    event DraftCreated(
        uint256 indexed draftId,
        uint256 indexed communityId,
        uint256 indexed requestId,
        address author,
        bytes32 actionsHash,
        string versionCID
    );
    
    event ContributorAdded(
        uint256 indexed draftId,
        address indexed contributor,
        address indexed addedBy
    );
    
    event ContributorRemoved(
        uint256 indexed draftId,
        address indexed contributor,
        address indexed removedBy
    );
    
    event VersionSnapshot(
        uint256 indexed draftId,
        uint256 versionNumber,
        string versionCID,
        address indexed contributor
    );
    
    event ReviewSubmitted(
        uint256 indexed draftId,
        address indexed reviewer,
        ReviewType reviewType,
        string reasonCID
    );
    
    event ReviewRetracted(
        uint256 indexed draftId,
        address indexed reviewer
    );
    
    event DraftStatusChanged(
        uint256 indexed draftId,
        DraftStatus oldStatus,
        DraftStatus newStatus,
        address indexed changedBy
    );
    
    event ProposalEscalated(
        uint256 indexed draftId,
        uint256 indexed proposalId,
        bool isMultiChoice,
        uint8 numOptions
    );

    event ProposalOutcomeUpdated(
        uint256 indexed draftId,
        uint256 indexed proposalId,
        DraftStatus outcome
    );

    event GovernorUpdated(address indexed oldGovernor, address indexed newGovernor);

    event ConfigurationUpdated(uint256 reviewPeriod, uint256 minReviewsForEscalation, uint256 supportThresholdBps);

    /* ======== ERRORS ======== */

    error DraftNotFound(uint256 draftId);
    error NotAuthorized(address user);
    error InvalidStatus(DraftStatus current, DraftStatus required);
    error ContributorAlreadyExists(address contributor);
    error ContributorNotFound(address contributor);
    error ReviewPeriodNotMet(uint256 timeRemaining);
    error InsufficientReviews(uint256 current, uint256 required);
    error InsufficientSupport(uint256 supportBps, uint256 requiredBps);
    error AlreadyReviewed(address reviewer);

    /* ======== MODIFIERS ======== */

    modifier draftExists(uint256 draftId) {
        if (draftId >= _drafts.length) revert DraftNotFound(draftId);
        _;
    }

    modifier onlyAuthorOrContributor(uint256 draftId) {
        Draft storage draft = _drafts[draftId];
        if (msg.sender != draft.author && !draft.isContributor[msg.sender]) {
            revert NotAuthorized(msg.sender);
        }
        _;
    }

    modifier onlyOutcomeUpdater(uint256 draftId) {
        Draft storage draft = _drafts[draftId];
        if (msg.sender == draft.author || draft.isContributor[msg.sender]) {
            _;
            return;
        }

        address communityTimelock = ICommunityRegistry(communityRegistry)
            .getCommunityModules(draft.communityId)
            .timelock;
        if (communityTimelock == address(0)) {
            revert Errors.InvalidInput("Timelock not set");
        }
        if (msg.sender != communityTimelock) {
            revert NotAuthorized(msg.sender);
        }
        _;
    }

    modifier onlyTimelock() {
        if (msg.sender != timelock) {
            revert NotAuthorized(msg.sender);
        }
        _;
    }

    modifier onlyInStatus(uint256 draftId, DraftStatus requiredStatus) {
        DraftStatus currentStatus = _drafts[draftId].status;
        if (currentStatus != requiredStatus) {
            revert InvalidStatus(currentStatus, requiredStatus);
        }
        _;
    }

    function _validateAndHashActions(ActionBundle calldata actions) internal pure returns (bytes32) {
        if (
            actions.targets.length != actions.values.length ||
            actions.targets.length != actions.calldatas.length
        ) {
            revert Errors.InvalidInput("Actions length mismatch");
        }

        return keccak256(abi.encode(actions.targets, actions.values, actions.calldatas));
    }

    function _getRequestHub(uint256 communityId) internal view returns (address requestHub) {
        ICommunityRegistry.ModuleAddresses memory modules = ICommunityRegistry(communityRegistry)
            .getCommunityModules(communityId);
        requestHub = modules.requestHub;
        if (requestHub == address(0)) {
            revert Errors.InvalidInput("RequestHub not set");
        }
    }

    /* ======== CONSTRUCTOR ======== */

    constructor(address _communityRegistry, address _governor, address _timelock) {
        if (_communityRegistry == address(0) || _governor == address(0) || _timelock == address(0)) {
            revert Errors.ZeroAddress();
        }
        communityRegistry = _communityRegistry;
        governor = _governor;
        timelock = _timelock;
    }

    /* ======== CORE FUNCTIONS ======== */

    /**
     * @notice Create a new collaborative draft
     * @param communityId The community this draft belongs to
     * @param requestId Optional source request (0 if none)
     * @param actions The governance actions bundle
     * @param versionCID Initial IPFS content
     * @return draftId The created draft ID
     */
    function createDraft(
        uint256 communityId,
        uint256 requestId,
        ActionBundle calldata actions,
        string calldata versionCID
    ) external returns (uint256 draftId) {
        if (bytes(versionCID).length == 0) {
            revert Errors.InvalidInput("Version CID cannot be empty");
        }

        address requestHub = _getRequestHub(communityId);

        if (requestId > 0) {
            IRequestHub(requestHub).getRequest(requestId);
        }

        bytes32 actionsHash = _validateAndHashActions(actions);

        draftId = _drafts.length;
        
        // Initialize draft
        Draft storage draft = _drafts.push();
        draft.communityId = communityId;
        draft.requestId = requestId;
        draft.author = msg.sender;
        draft.actions = actions;
        draft.actions.actionsHash = actionsHash;
        draft.status = DraftStatus.DRAFTING;
        draft.createdAt = uint64(block.timestamp);
        
        // Add initial version
        draft.versionCIDs.push(versionCID);
        
        // Update mappings
        communityDrafts[communityId].push(draftId);
        if (requestId > 0) {
            requestDrafts[requestId].push(draftId);
        }
        authorDrafts[msg.sender].push(draftId);

        emit DraftCreated(draftId, communityId, requestId, msg.sender, actionsHash, versionCID);
    }

    /**
     * @notice Add a contributor to the draft
     * @param draftId The draft to modify
     * @param contributor Address to add as contributor
     */
    function addContributor(
        uint256 draftId,
        address contributor
    ) external draftExists(draftId) onlyAuthorOrContributor(draftId) onlyInStatus(draftId, DraftStatus.DRAFTING) {
        if (contributor == address(0)) {
            revert Errors.ZeroAddress();
        }

        Draft storage draft = _drafts[draftId];
        
        if (contributor == draft.author || draft.isContributor[contributor]) {
            revert ContributorAlreadyExists(contributor);
        }

        draft.contributors.push(contributor);
        draft.isContributor[contributor] = true;
        contributorDrafts[contributor].push(draftId);

        emit ContributorAdded(draftId, contributor, msg.sender);
    }

    /**
     * @notice Remove a contributor from the draft
     * @param draftId The draft to modify
     * @param contributor Address to remove
     */
    function removeContributor(
        uint256 draftId,
        address contributor
    ) external draftExists(draftId) onlyAuthorOrContributor(draftId) onlyInStatus(draftId, DraftStatus.DRAFTING) {
        Draft storage draft = _drafts[draftId];
        
        if (!draft.isContributor[contributor]) {
            revert ContributorNotFound(contributor);
        }

        // Remove from contributors array
        address[] storage contributors = draft.contributors;
        for (uint256 i = 0; i < contributors.length; i++) {
            if (contributors[i] == contributor) {
                contributors[i] = contributors[contributors.length - 1];
                contributors.pop();
                break;
            }
        }
        
        draft.isContributor[contributor] = false;

        emit ContributorRemoved(draftId, contributor, msg.sender);
    }

    /**
     * @notice Create a new version snapshot
     * @param draftId The draft to snapshot
     * @param newVersionCID IPFS content for the new version
     */
    function snapshotVersion(
        uint256 draftId,
        string calldata newVersionCID
    ) external draftExists(draftId) onlyAuthorOrContributor(draftId) onlyInStatus(draftId, DraftStatus.DRAFTING) {
        if (bytes(newVersionCID).length == 0) {
            revert Errors.InvalidInput("Version CID cannot be empty");
        }

        Draft storage draft = _drafts[draftId];
        draft.versionCIDs.push(newVersionCID);

        emit VersionSnapshot(draftId, draft.versionCIDs.length - 1, newVersionCID, msg.sender);
    }

    /**
     * @notice Submit draft for community review
     * @param draftId The draft to submit for review
     */
    function submitForReview(
        uint256 draftId
    ) external draftExists(draftId) onlyAuthorOrContributor(draftId) onlyInStatus(draftId, DraftStatus.DRAFTING) {
        Draft storage draft = _drafts[draftId];
        
        if (draft.versionCIDs.length == 0) {
            revert Errors.InvalidInput("Draft must have at least one version");
        }

        draft.status = DraftStatus.REVIEW;
        draft.reviewStartedAt = uint64(block.timestamp);

        emit DraftStatusChanged(draftId, DraftStatus.DRAFTING, DraftStatus.REVIEW, msg.sender);
    }

    /**
     * @notice Submit a review for a draft
     * @param draftId The draft to review
     * @param reviewType Type of review
     * @param reasonCID IPFS content with detailed feedback
     */
    function submitReview(
        uint256 draftId,
        ReviewType reviewType,
        string calldata reasonCID
    ) external draftExists(draftId) onlyInStatus(draftId, DraftStatus.REVIEW) {
        Draft storage draft = _drafts[draftId];
        
        // Cannot review your own draft
        if (msg.sender == draft.author || draft.isContributor[msg.sender]) {
            revert Errors.InvalidInput("Contributors cannot review their own draft");
        }

        ReviewState storage reviewState = draft.reviews;
        
        // Check if already reviewed
        if (reviewState.reviews[msg.sender].reviewer != address(0)) {
            revert AlreadyReviewed(msg.sender);
        }

        // Add review
        reviewState.reviews[msg.sender] = Review({
            reviewer: msg.sender,
            reviewType: reviewType,
            reasonCID: reasonCID,
            timestamp: uint64(block.timestamp),
            isActive: true
        });

        // Update counters
        if (reviewType == ReviewType.SUPPORT) {
            reviewState.supportCount++;
        } else if (reviewType == ReviewType.OPPOSE) {
            reviewState.opposeCount++;
        } else if (reviewType == ReviewType.NEUTRAL) {
            reviewState.neutralCount++;
        } else if (reviewType == ReviewType.REQUEST_CHANGES) {
            reviewState.requestChangesCount++;
        }
        
        reviewState.totalReviews++;

        emit ReviewSubmitted(draftId, msg.sender, reviewType, reasonCID);
    }

    /**
     * @notice Retract a previously submitted review
     * @param draftId The draft to retract review from
     */
    function retractReview(
        uint256 draftId
    ) external draftExists(draftId) onlyInStatus(draftId, DraftStatus.REVIEW) {
        Draft storage draft = _drafts[draftId];
        ReviewState storage reviewState = draft.reviews;
        Review storage review = reviewState.reviews[msg.sender];
        
        if (review.reviewer == address(0) || !review.isActive) {
            revert Errors.InvalidInput("No active review to retract");
        }

        // Update counters
        if (review.reviewType == ReviewType.SUPPORT) {
            reviewState.supportCount--;
        } else if (review.reviewType == ReviewType.OPPOSE) {
            reviewState.opposeCount--;
        } else if (review.reviewType == ReviewType.NEUTRAL) {
            reviewState.neutralCount--;
        } else if (review.reviewType == ReviewType.REQUEST_CHANGES) {
            reviewState.requestChangesCount--;
        }
        
        reviewState.totalReviews--;
        review.isActive = false;

        emit ReviewRetracted(draftId, msg.sender);
    }

    /**
     * @notice Finalize draft for escalation to governance
     * @param draftId The draft to finalize
     */
    function finalizeForProposal(
        uint256 draftId
    ) external draftExists(draftId) onlyAuthorOrContributor(draftId) onlyInStatus(draftId, DraftStatus.REVIEW) {
        Draft storage draft = _drafts[draftId];
        
        // Check minimum review period
        uint256 timeElapsed = block.timestamp - draft.reviewStartedAt;
        if (timeElapsed < reviewPeriod) {
            revert ReviewPeriodNotMet(reviewPeriod - timeElapsed);
        }

        ReviewState storage reviewState = draft.reviews;
        
        // Check minimum reviews
        if (reviewState.totalReviews < minReviewsForEscalation) {
            revert InsufficientReviews(reviewState.totalReviews, minReviewsForEscalation);
        }

        // Check support threshold
        uint256 supportBps = (reviewState.supportCount * 10000) / reviewState.totalReviews;
        if (supportBps < supportThresholdBps) {
            revert InsufficientSupport(supportBps, supportThresholdBps);
        }

        draft.status = DraftStatus.FINALIZED;
        draft.finalizedAt = uint64(block.timestamp);

        emit DraftStatusChanged(draftId, DraftStatus.REVIEW, DraftStatus.FINALIZED, msg.sender);
    }

    /**
     * @notice Escalate finalized draft to governance proposal
     * @param draftId The draft to escalate
     * @param multiChoice Whether to create multi-choice proposal
     * @param numOptions Number of options (for multi-choice)
     * @param description Proposal description
     * @return proposalId The created proposal ID
     */
    function escalateToProposal(
        uint256 draftId,
        bool multiChoice,
        uint8 numOptions,
        string calldata description
    ) 
        external 
        draftExists(draftId) 
        onlyAuthorOrContributor(draftId) 
        onlyInStatus(draftId, DraftStatus.FINALIZED) 
        returns (uint256 proposalId) 
    {
        Draft storage draft = _drafts[draftId];

        // Create proposal through governor
        if (multiChoice) {
            if (numOptions < 2) {
                revert Errors.InvalidInput("Multi-choice requires at least 2 options");
            }
            proposalId = IGovernorLike(governor).proposeMultiChoice(
                draft.actions.targets,
                draft.actions.values,
                draft.actions.calldatas,
                description,
                numOptions
            );
        } else {
            proposalId = IGovernorLike(governor).propose(
                draft.actions.targets,
                draft.actions.values,
                draft.actions.calldatas,
                description
            );
        }

        draft.status = DraftStatus.ESCALATED;
        draft.proposalId = proposalId;

        emit ProposalEscalated(draftId, proposalId, multiChoice, numOptions);
    }

    /**
     * @notice Update proposal outcome (called by governance or authorized updater)
     * @param draftId The draft to update
     * @param outcome The final outcome (WON/LOST)
     */
    function updateProposalOutcome(
        uint256 draftId,
        DraftStatus outcome
    ) external draftExists(draftId) onlyInStatus(draftId, DraftStatus.ESCALATED) onlyOutcomeUpdater(draftId) {
        if (outcome != DraftStatus.WON && outcome != DraftStatus.LOST) {
            revert Errors.InvalidInput("Outcome must be WON or LOST");
        }

        Draft storage draft = _drafts[draftId];
        draft.status = outcome;

        emit ProposalOutcomeUpdated(draftId, draft.proposalId, outcome);
    }

    /* ======== VIEW FUNCTIONS ======== */

    /**
     * @notice Get draft details
     * @param draftId The draft ID
     */
    function getDraft(uint256 draftId) external view draftExists(draftId) returns (
        uint256 communityId,
        uint256 requestId,
        address author,
        address[] memory contributors,
        ActionBundle memory actions,
        string[] memory versionCIDs,
        DraftStatus status,
        uint64 createdAt,
        uint64 reviewStartedAt,
        uint64 finalizedAt,
        uint256 proposalId
    ) {
        Draft storage draft = _drafts[draftId];
        return (
            draft.communityId,
            draft.requestId,
            draft.author,
            draft.contributors,
            draft.actions,
            draft.versionCIDs,
            draft.status,
            draft.createdAt,
            draft.reviewStartedAt,
            draft.finalizedAt,
            draft.proposalId
        );
    }

    /**
     * @notice Get review summary for a draft
     * @param draftId The draft ID
     */
    function getReviewSummary(uint256 draftId) external view draftExists(draftId) returns (
        uint256 supportCount,
        uint256 opposeCount,
        uint256 neutralCount,
        uint256 requestChangesCount,
        uint256 totalReviews
    ) {
        ReviewState storage reviewState = _drafts[draftId].reviews;
        return (
            reviewState.supportCount,
            reviewState.opposeCount,
            reviewState.neutralCount,
            reviewState.requestChangesCount,
            reviewState.totalReviews
        );
    }

    /**
     * @notice Get specific review details
     * @param draftId The draft ID
     * @param reviewer The reviewer address
     */
    function getReview(uint256 draftId, address reviewer) external view draftExists(draftId) returns (
        ReviewType reviewType,
        string memory reasonCID,
        uint64 timestamp,
        bool isActive
    ) {
        Review storage review = _drafts[draftId].reviews.reviews[reviewer];
        return (
            review.reviewType,
            review.reasonCID,
            review.timestamp,
            review.isActive
        );
    }

    /**
     * @notice Check if address is a contributor
     * @param draftId The draft ID
     * @param contributor Address to check
     * @return True if contributor
     */
    function isContributor(uint256 draftId, address contributor) external view draftExists(draftId) returns (bool) {
        Draft storage draft = _drafts[draftId];
        return draft.author == contributor || draft.isContributor[contributor];
    }

    /**
     * @notice Get total number of drafts
     * @return Total drafts count
     */
    function getDraftsCount() external view returns (uint256) {
        return _drafts.length;
    }

    /**
     * @notice Get drafts by community
     * @param communityId The community ID
     * @return Array of draft IDs
     */
    function getDraftsByCommunity(uint256 communityId) external view returns (uint256[] memory) {
        return communityDrafts[communityId];
    }

    /**
     * @notice Get drafts by request
     * @param requestId The request ID
     * @return Array of draft IDs
     */
    function getDraftsByRequest(uint256 requestId) external view returns (uint256[] memory) {
        return requestDrafts[requestId];
    }

    /**
     * @notice Get drafts by author
     * @param author The author address
     * @return Array of draft IDs
     */
    function getDraftsByAuthor(address author) external view returns (uint256[] memory) {
        return authorDrafts[author];
    }

    /**
     * @notice Get drafts by contributor
     * @param contributor The contributor address
     * @return Array of draft IDs
     */
    function getDraftsByContributor(address contributor) external view returns (uint256[] memory) {
        return contributorDrafts[contributor];
    }

    /* ======== ADMIN FUNCTIONS ======== */

    /**
     * @notice Update governor address (governance only)
     * @param newGovernor New governor address
     */
    function updateGovernor(address newGovernor) external onlyTimelock {
        if (newGovernor == address(0)) {
            revert Errors.ZeroAddress();
        }
        address oldGovernor = governor;
        governor = newGovernor;
        emit GovernorUpdated(oldGovernor, newGovernor);
    }

    /**
     * @notice Update configuration parameters (governance only)
     * @param newReviewPeriod New minimum review period
     * @param newMinReviews New minimum reviews required
     * @param newSupportThreshold New support threshold (basis points)
     */
    function updateConfiguration(
        uint256 newReviewPeriod,
        uint256 newMinReviews,
        uint256 newSupportThreshold
    ) external onlyTimelock {
        if (newSupportThreshold > 10000) {
            revert Errors.InvalidInput("Support threshold cannot exceed 100%");
        }
        
        reviewPeriod = newReviewPeriod;
        minReviewsForEscalation = newMinReviews;
        supportThresholdBps = newSupportThreshold;
        
        emit ConfigurationUpdated(newReviewPeriod, newMinReviews, newSupportThreshold);
    }
}
