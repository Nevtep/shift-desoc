// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Types} from "../libs/Types.sol";
import {Errors} from "../libs/Errors.sol";
import {CommunityRegistry} from "./CommunityRegistry.sol";
import {IValuableActionSBT} from "../core/interfaces/IValuableActionSBT.sol";

/// @title ValuableActionRegistry
/// @notice Registry for configurable valuable actions with verification parameters
/// @dev Manages work verification rules for the Engagements system with enhanced governance integration
contract ValuableActionRegistry {
    /// @notice Emitted when a new valuable action is created
    event ValuableActionCreated(uint256 indexed id, Types.ValuableAction valuableAction, address indexed creator);
    
    /// @notice Emitted when a valuable action is updated
    event ValuableActionUpdated(uint256 indexed id, Types.ValuableAction valuableAction, address indexed updater);
    
    /// @notice Emitted when a valuable action is activated after governance approval
    event ValuableActionActivated(uint256 indexed id, uint256 indexed proposalId);
    
    /// @notice Emitted when a valuable action is deactivated
    event ValuableActionDeactivated(uint256 indexed id, address indexed deactivator);
    
    /// @notice Emitted when moderator status is changed
    event ModeratorUpdated(address indexed account, bool isModerator, address indexed updater);

    /// @notice Emitted when an engagement SBT is issued
    event EngagementIssued(address indexed to, uint256 indexed tokenId, Types.EngagementSubtype subtype, bytes32 indexed actionTypeId);

    /// @notice Emitted when a position SBT is issued
    event PositionIssued(address indexed to, uint256 indexed tokenId, bytes32 indexed positionTypeId, uint32 points);

    /// @notice Emitted when an investment SBT is issued
    event InvestmentIssued(address indexed to, uint256 indexed tokenId, bytes32 indexed cohortId, uint32 weight);

    /// @notice Emitted when a role record is issued from a closed position
    event RoleIssued(address indexed to, uint256 indexed tokenId, bytes32 indexed roleTypeId, uint32 points, uint64 issuedAt, uint64 endedAt, uint8 closeOutcome);

    /// @notice Counter for valuable action IDs
    uint256 public lastId;
    
    /// @notice Mapping from valuable action ID to configuration
    mapping(uint256 => Types.ValuableAction) public valuableActionsById;

    /// @notice Mapping from valuable action ID to communityId
    mapping(uint256 => uint256) public communityByActionId;
    
    /// @notice Mapping from address to moderator status
    mapping(address => bool) public isModerator;
    
    /// @notice Mapping to track active/inactive valuable actions
    mapping(uint256 => bool) public isActive;
    
    /// @notice Mapping to track pending valuable actions awaiting governance activation (by proposal ref)
    mapping(uint256 => bytes32) public pendingValuableActions; // valuableActionId => proposalRef

    /// @notice Track proposal refs already used to prevent reuse
    mapping(bytes32 => bool) public proposalRefUsed;

    /// @notice Global allowlist for modules that can call issuance functions
    mapping(address => bool) public isIssuanceModule;

    /// @notice Optional per-community allowlist narrowing (communityId => module => allowed)
    mapping(uint256 => mapping(address => bool)) public isCommunityIssuanceModule;

    /// @notice Toggle to enforce community-level narrowing
    mapping(uint256 => bool) public communityNarrowingEnabled;

    /// @notice Pause switch for issuance
    bool public issuancePaused;

    /// @notice ValuableActionSBT contract used for minting typed SBTs
    address public valuableActionSBT;
    
    /// @notice Address that can manage moderators (typically governance)
    address public governance;

    /// @notice CommunityRegistry for resolving per-community module addresses
    CommunityRegistry public immutable communityRegistry;
    
    /// @notice System for founder verification (bootstrap security)
    mapping(address => mapping(uint256 => bool)) public founderWhitelist;  // founder => communityId => verified
    mapping(uint256 => address[]) public communityFounders;               // communityId => founders list

    /// @notice Only moderators can call this function
    modifier onlyModerator() { 
        if (!isModerator[msg.sender]) revert Errors.NotAuthorized(msg.sender); 
        _; 
    }
    
    /// @notice Only governance can call this function
    modifier onlyGovernance() {
        if (msg.sender != governance) revert Errors.NotAuthorized(msg.sender);
        _;
    }

    /// @notice Only modules allowed to issue SBTs
    modifier onlyIssuanceModule(uint256 communityId) {
        if (!isIssuanceModule[msg.sender]) revert Errors.NotAuthorized(msg.sender);
        if (communityNarrowingEnabled[communityId] && !isCommunityIssuanceModule[communityId][msg.sender]) {
            revert Errors.NotAuthorized(msg.sender);
        }
        _;
    }

    /// @notice Ensure issuance is not paused and SBT set
    modifier issuanceEnabled() {
        if (issuancePaused) revert Errors.InvalidInput("Issuance paused");
        if (valuableActionSBT == address(0)) revert Errors.ZeroAddress();
        _;
    }

    /// @notice Initialize the registry
    /// @param _governance Address that can manage moderators
    /// @param _communityRegistry CommunityRegistry contract address
    constructor(address _governance, address _communityRegistry) {
        if (_governance == address(0)) revert Errors.ZeroAddress();
        if (_communityRegistry == address(0)) revert Errors.ZeroAddress();
        governance = _governance;
        communityRegistry = CommunityRegistry(_communityRegistry);
        
        // Make governance the initial moderator
        isModerator[_governance] = true;
        emit ModeratorUpdated(_governance, true, msg.sender);
    }

    /// @notice Set the ValuableActionSBT contract address
    /// @param sbt Address of the SBT contract
    function setValuableActionSBT(address sbt) external onlyGovernance {
        if (sbt == address(0)) revert Errors.ZeroAddress();
        valuableActionSBT = sbt;
    }

    /// @notice Set issuance pause state
    /// @param paused Whether issuance should be paused
    function setIssuancePaused(bool paused) external onlyGovernance {
        issuancePaused = paused;
    }

    /// @notice Allow or disallow a module globally for issuance
    /// @param module Module address
    /// @param allowed Whether the module is allowed
    function setIssuanceModule(address module, bool allowed) external onlyGovernance {
        if (module == address(0)) revert Errors.ZeroAddress();
        isIssuanceModule[module] = allowed;
    }

    /// @notice Toggle community-level narrowing for issuance modules
    /// @param communityId Community identifier
    /// @param enabled Whether narrowing is enabled
    function setCommunityNarrowing(uint256 communityId, bool enabled) external onlyGovernance {
        communityNarrowingEnabled[communityId] = enabled;
    }

    /// @notice Allow or disallow a module for a specific community (only applies if narrowing is enabled)
    /// @param communityId Community identifier
    /// @param module Module address
    /// @param allowed Whether the module is allowed
    function setCommunityIssuanceModule(uint256 communityId, address module, bool allowed) external onlyGovernance {
        if (module == address(0)) revert Errors.ZeroAddress();
        isCommunityIssuanceModule[communityId][module] = allowed;
    }

    /// @notice Set moderator status for an address
    /// @param who Address to set moderator status for
    /// @param status Whether the address should be a moderator
    function setModerator(address who, bool status) external onlyGovernance {
        if (who == address(0)) revert Errors.ZeroAddress();
        
        isModerator[who] = status;
        emit ModeratorUpdated(who, status, msg.sender);
    }

    /// @notice Add founder to whitelist for community bootstrap
    /// @param founder Address to add as founder
    /// @param communityId Community ID to grant founder privileges for
    function addFounder(address founder, uint256 communityId) external onlyGovernance {
        if (founder == address(0)) revert Errors.ZeroAddress();
        
        if (!founderWhitelist[founder][communityId]) {
            founderWhitelist[founder][communityId] = true;
            communityFounders[communityId].push(founder);
        }
    }

    /// @notice Propose a new valuable action (must be executed via governance/Timelock)
    /// @param communityId Community ID this action belongs to
    /// @param params Valuable action configuration
    /// @param proposalRef Arbitrary governance reference that ties creation and activation
    /// @return valuableActionId The ID of the created valuable action
    function proposeValuableAction(
        uint256 communityId,
        Types.ValuableAction calldata params,
        bytes32 proposalRef
    ) external payable returns (uint256 valuableActionId) {
        CommunityRegistry.ModuleAddresses memory modules = communityRegistry.getCommunityModules(communityId);
        if (modules.timelock == address(0) || modules.governor == address(0)) {
            revert Errors.InvalidInput("Community not configured");
        }
        if (modules.valuableActionRegistry != address(this)) {
            revert Errors.InvalidInput("Registry mismatch");
        }
        if (msg.sender != modules.timelock) revert Errors.NotAuthorized(msg.sender);

        if (proposalRef == bytes32(0)) revert Errors.InvalidInput("Missing proposal ref");
        if (proposalRefUsed[proposalRef]) revert Errors.InvalidInput("Proposal ref already used");

        _validateValuableAction(params);
        
        valuableActionId = ++lastId;
        valuableActionsById[valuableActionId] = params;
        communityByActionId[valuableActionId] = communityId;

        pendingValuableActions[valuableActionId] = proposalRef;
        proposalRefUsed[proposalRef] = true;
        
        emit ValuableActionCreated(valuableActionId, params, msg.sender);
    }

    /// @notice Activate valuable action after governance approval
    /// @param valuableActionId ID of the valuable action
    /// @param proposalRef Reference used when the action was proposed
    function activateFromGovernance(uint256 valuableActionId, bytes32 proposalRef) external {
        if (!_exists(valuableActionId)) revert Errors.InvalidValuableAction(valuableActionId);
        if (proposalRef == bytes32(0)) revert Errors.InvalidInput("Missing proposal ref");
        if (pendingValuableActions[valuableActionId] != proposalRef) {
            revert Errors.InvalidInput("Proposal ref mismatch");
        }
        uint256 communityId = communityByActionId[valuableActionId];
        CommunityRegistry.ModuleAddresses memory modules = communityRegistry.getCommunityModules(communityId);
        if (msg.sender != modules.timelock) revert Errors.NotAuthorized(msg.sender);
        
        isActive[valuableActionId] = true;
        
        // Clear pending status
        delete pendingValuableActions[valuableActionId];
        
        emit ValuableActionActivated(valuableActionId, uint256(bytes32(proposalRef)));
    }

    /// @notice Update an existing valuable action
    /// @param id ID of the valuable action to update
    /// @param params New configuration for the valuable action
    function update(uint256 id, Types.ValuableAction calldata params) external onlyModerator {
        if (!_exists(id)) revert Errors.InvalidValuableAction(id);
        if (!isActive[id]) revert Errors.InvalidValuableAction(id);
        
        _validateValuableAction(params);
        
        valuableActionsById[id] = params;
        emit ValuableActionUpdated(id, params, msg.sender);
    }

    /// @notice Deactivate a valuable action (cannot be used for new claims)
    /// @param id ID of the valuable action to deactivate
    function deactivate(uint256 id) external onlyModerator {
        if (!_exists(id)) revert Errors.InvalidValuableAction(id);
        if (!isActive[id]) revert Errors.InvalidValuableAction(id);
        
        isActive[id] = false;
        emit ValuableActionDeactivated(id, msg.sender);
    }

    /// @notice Issue an engagement SBT (WORK/ROLE/CREDENTIAL)
    /// @param to Recipient address
    /// @param subtype Engagement subtype
    /// @param actionTypeId Identifier for the engagement action definition
    /// @param metadata Arbitrary metadata payload (schema defined by metadataSchemaId)
    function issueEngagement(
        uint256 communityId,
        address to,
        Types.EngagementSubtype subtype,
        bytes32 actionTypeId,
        bytes calldata metadata
    ) external issuanceEnabled onlyIssuanceModule(communityId) returns (uint256 tokenId) {
        if (communityId == 0) revert Errors.InvalidInput("Invalid communityId");
        if (to == address(0)) revert Errors.ZeroAddress();
        if (actionTypeId == bytes32(0)) revert Errors.InvalidInput("Missing actionTypeId");

        tokenId = IValuableActionSBT(valuableActionSBT).mintEngagement(to, communityId, subtype, actionTypeId, metadata);
        emit EngagementIssued(to, tokenId, subtype, actionTypeId);
    }

    /// @notice Issue a position SBT
    /// @param to Recipient address
    /// @param positionTypeId Role/position type identifier
    /// @param points Points weight for revenue routing
    /// @param metadata Arbitrary metadata payload (schema defined by manager)
    function issuePosition(
        uint256 communityId,
        address to,
        bytes32 positionTypeId,
        uint32 points,
        bytes calldata metadata
    ) external issuanceEnabled onlyIssuanceModule(communityId) returns (uint256 tokenId) {
        if (communityId == 0) revert Errors.InvalidInput("Invalid communityId");
        if (to == address(0)) revert Errors.ZeroAddress();
        if (positionTypeId == bytes32(0)) revert Errors.InvalidInput("Missing positionTypeId");
        if (points == 0) revert Errors.InvalidInput("Points cannot be zero");

        tokenId = IValuableActionSBT(valuableActionSBT).mintPosition(to, communityId, positionTypeId, points, metadata);
        emit PositionIssued(to, tokenId, positionTypeId, points);
    }

    /// @notice Issue an investment SBT
    /// @param to Recipient address
    /// @param cohortId Cohort identifier
    /// @param weight Weight used for revenue share in cohort
    /// @param metadata Arbitrary metadata payload (schema defined by manager)
    function issueInvestment(
        uint256 communityId,
        address to,
        bytes32 cohortId,
        uint32 weight,
        bytes calldata metadata
    ) external issuanceEnabled onlyIssuanceModule(communityId) returns (uint256 tokenId) {
        if (communityId == 0) revert Errors.InvalidInput("Invalid communityId");
        if (to == address(0)) revert Errors.ZeroAddress();
        if (cohortId == bytes32(0)) revert Errors.InvalidInput("Missing cohortId");
        if (weight == 0) revert Errors.InvalidInput("Weight cannot be zero");

        tokenId = IValuableActionSBT(valuableActionSBT).mintInvestment(to, communityId, cohortId, weight, metadata);
        emit InvestmentIssued(to, tokenId, cohortId, weight);
    }

    /// @notice Close a position token and stamp outcome
    function closePositionToken(
        uint256 communityId,
        uint256 positionTokenId,
        uint8 outcome
    ) external issuanceEnabled onlyIssuanceModule(communityId) {
        IValuableActionSBT.TokenData memory data = IValuableActionSBT(valuableActionSBT).getTokenData(positionTokenId);
        if (data.kind != IValuableActionSBT.TokenKind.POSITION) revert Errors.InvalidInput("Not a position token");
        if (data.communityId != communityId) revert Errors.InvalidInput("Community mismatch");
        if (data.endedAt != 0) revert Errors.InvalidInput("Position already closed");

        IValuableActionSBT(valuableActionSBT).closePositionToken(positionTokenId, outcome);
    }

    /// @notice Issue a role record derived from a closed position
    function issueRoleFromPosition(
        uint256 communityId,
        address to,
        bytes32 roleTypeId,
        uint32 points,
        uint64 issuedAt,
        uint64 endedAt,
        uint8 closeOutcome,
        bytes calldata metadata
    ) external issuanceEnabled onlyIssuanceModule(communityId) returns (uint256 tokenId) {
        if (communityId == 0) revert Errors.InvalidInput("Invalid communityId");
        if (to == address(0)) revert Errors.ZeroAddress();
        if (roleTypeId == bytes32(0)) revert Errors.InvalidInput("Missing roleTypeId");
        if (issuedAt == 0) revert Errors.InvalidInput("Missing issuedAt");
        if (endedAt < issuedAt) revert Errors.InvalidInput("endedAt before issuedAt");

        tokenId = IValuableActionSBT(valuableActionSBT).mintRoleFromPosition(
            to,
            communityId,
            roleTypeId,
            points,
            issuedAt,
            endedAt,
            closeOutcome,
            metadata
        );

        emit RoleIssued(to, tokenId, roleTypeId, points, issuedAt, endedAt, closeOutcome);
    }

    /// @notice Get valuable action configuration
    /// @param id Valuable action ID
    /// @return action The valuable action configuration
    function getValuableAction(uint256 id) external view returns (Types.ValuableAction memory action) {
        if (!_exists(id)) revert Errors.InvalidValuableAction(id);
        return valuableActionsById[id];
    }

    /// @notice Check if a valuable action exists and is active
    /// @param id Valuable action ID
    /// @return Whether the valuable action is active
    function isValuableActionActive(uint256 id) external view returns (bool) {
        return _exists(id) && isActive[id];
    }

    /// @notice Get all active valuable action IDs
    /// @return ids Array of active valuable action IDs
    function getActiveValuableActions() external view returns (uint256[] memory ids) {
        uint256 activeCount = 0;
        
        // Count active actions
        for (uint256 i = 1; i <= lastId; i++) {
            if (isActive[i]) activeCount++;
        }
        
        // Build array of active IDs
        ids = new uint256[](activeCount);
        uint256 index = 0;
        for (uint256 i = 1; i <= lastId; i++) {
            if (isActive[i]) {
                ids[index++] = i;
            }
        }
    }

    /// @notice Get founders for a community
    /// @param communityId Community ID
    /// @return founders Array of founder addresses
    function getCommunityFounders(uint256 communityId) external view returns (address[] memory founders) {
        return communityFounders[communityId];
    }

    /// @notice Update governance address
    /// @param newGovernance New governance address
    function updateGovernance(address newGovernance) external onlyGovernance {
        if (newGovernance == address(0)) revert Errors.ZeroAddress();
        governance = newGovernance;
    }

    /// @dev Validate valuable action configuration
    /// @param params Valuable action to validate
    function _validateValuableAction(Types.ValuableAction calldata params) internal pure {
        // Validate basic parameters
        if (params.membershipTokenReward == 0) revert Errors.InvalidInput("MembershipToken reward cannot be zero");
        if (params.jurorsMin == 0) revert Errors.InvalidInput("Minimum jurors cannot be zero");
        if (params.panelSize == 0) revert Errors.InvalidInput("Panel size cannot be zero");
        if (params.jurorsMin > params.panelSize) {
            revert Errors.InvalidInput("Minimum jurors cannot exceed panel size");
        }
        if (params.verifyWindow == 0) revert Errors.InvalidInput("Verify window cannot be zero");
        if (params.slashVerifierBps > 10000) {
            revert Errors.InvalidInput("Slash rate cannot exceed 100%");
        }
        if (bytes(params.evidenceSpecCID).length == 0) {
            revert Errors.InvalidInput("Evidence spec CID cannot be empty");
        }
        if (params.cooldownPeriod == 0) revert Errors.InvalidInput("Cooldown period cannot be zero");
    }

    /// @dev Check if a valuable action exists
    /// @param id Valuable action ID
    /// @return Whether the valuable action exists
    function _exists(uint256 id) internal view returns (bool) {
        return id > 0 && id <= lastId;
    }
}