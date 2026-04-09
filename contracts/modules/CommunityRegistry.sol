// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Errors} from "../libs/Errors.sol";
import {Roles} from "../libs/Roles.sol";
import {ParamController} from "./ParamController.sol";

/// @title CommunityRegistry
/// @notice Central registry for community metadata, parameters, and module addresses
/// @dev Single source of truth for community coordination and configuration
contract CommunityRegistry {
    
    /*//////////////////////////////////////////////////////////////
                               STRUCTS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Community metadata and configuration
    struct Community {
        string name;                    // Community display name
        string description;            // Community description
        string metadataURI;           // IPFS URI for additional metadata
        bool active;                  // Whether community is active
        uint256 createdAt;            // Creation timestamp
        
        // Module Addresses
        address accessManager;       // ShiftAccessManager contract
        address membershipToken;     // MembershipTokenERC20Votes contract
        address governor;             // Governor contract
        address timelock;             // Timelock contract
        address countingMultiChoice;  // CountingMultiChoice contract
        address requestHub;           // RequestHub contract
        address draftsManager;        // DraftsManager contract
        address engagementsManager;   // Engagements contract
        address valuableActionRegistry; // ValuableActionRegistry contract
        address verifierPowerToken;   // VerifierPowerToken1155 contract (VPT system)
        address verifierElection;     // VerifierElection contract (VPT system)
        address verifierManager;      // VerifierManager contract (VPT system)
        address valuableActionSBT;    // ValuableActionSBT contract
        address positionManager;      // PositionManager contract
        address credentialManager;    // CredentialManager contract
        address cohortRegistry;       // CohortRegistry contract
        address investmentCohortManager; // InvestmentCohortManager contract
        address revenueRouter;        // RevenueRouter contract
        address treasuryVault;        // Community treasury Safe (for manual custody)
        address treasuryAdapter;      // TreasuryAdapter contract
        address communityToken;       // CommunityToken contract
        address paramController;      // ParamController contract
        address commerceDisputes;     // CommerceDisputes contract
        address marketplace;          // Marketplace contract
        address housingManager;       // HousingManager contract
        address projectFactory;       // ProjectFactory contract
        
        // Cross-Community Links
        uint256 parentCommunityId;   // Parent community (0 if root)
        uint256[] allyCommunityIds;  // Allied communities
    }
    
    /// @notice Module addresses structure for easy return
    struct ModuleAddresses {
        address accessManager;
        address membershipToken;
        address governor;
        address timelock;
        address countingMultiChoice;
        address requestHub;
        address draftsManager;
        address engagementsManager;
        address valuableActionRegistry;
        address verifierPowerToken;
        address verifierElection;
        address verifierManager;
        address valuableActionSBT;
        address positionManager;
        address credentialManager;
        address cohortRegistry;
        address investmentCohortManager;
        address revenueRouter;
        address treasuryVault;
        address treasuryAdapter;
        address communityToken;
        address paramController;
        address commerceDisputes;
        address marketplace;
        address housingManager;
        address projectFactory;
    }

    /// @notice Bootstrap parameter bundle used for one-tx community setup
    struct BootstrapParams {
        uint256 verifierPanelSize;
        uint256 verifierMin;
        uint256 maxPanelsPerEpoch;
        bool useVPTWeighting;
        uint256 maxWeightPerVerifier;
        uint256 cooldownAfterFraud;
        uint256 debateWindow;
        uint256 voteWindow;
        uint256 executionDelay;
        uint256 minSeniority;
        uint256 minSBTs;
        uint256 proposalThreshold;
        uint16 minTreasuryBps;
        uint16 minPositionsBps;
        uint8 spilloverTarget;
        uint16 spilloverSplitBpsToTreasury;
    }



    /*//////////////////////////////////////////////////////////////
                                ROLES
    //////////////////////////////////////////////////////////////*/    
    /// @notice Role for governance operations
    bytes32 public constant GOVERNANCE_ROLE = Roles.COMMUNITY_GOVERNANCE_ROLE;
    
    /// @notice Role for community moderators
    bytes32 public constant MODERATOR_ROLE = Roles.COMMUNITY_MODERATOR_ROLE;
    
    /// @notice Role for community curators
    bytes32 public constant CURATOR_ROLE = Roles.COMMUNITY_CURATOR_ROLE;
    
    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Mapping from community ID to community data
    mapping(uint256 => Community) public communities;
    
    /// @notice Mapping from community ID to moderators
    mapping(uint256 => mapping(address => bool)) public moderators;
    
    /// @notice Mapping from community ID to curators
    mapping(uint256 => mapping(address => bool)) public curators;
    
    /// @notice Community-specific roles: communityId => user => role => hasRole
    mapping(uint256 => mapping(address => mapping(bytes32 => bool))) public communityRoles;
    
    /// @notice Community admins for easier access: communityId => user => isAdmin
    mapping(uint256 => mapping(address => bool)) public communityAdmins;
    
    /// @notice Next community ID to be assigned
    uint256 public nextCommunityId = 1;
    
    /// @notice Total number of active communities
    uint256 public activeCommunityCount;
    
    /// @notice ParamController contract for parameter management
    ParamController public immutable paramController;
    
    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Emitted when a new community is registered
    event CommunityRegistered(
        uint256 indexed communityId,
        string name,
        address indexed creator,
        uint256 parentCommunityId
    );
    
    /// @notice Emitted when a module address is updated
    event ModuleAddressUpdated(
        uint256 indexed communityId,
        bytes32 indexed moduleKey,
        address oldAddress,
        address newAddress
    );
    
    /// @notice Emitted when a role is granted to a user
    event CommunityRoleGranted(
        uint256 indexed communityId,
        address indexed user,
        bytes32 indexed role
    );
    
    /// @notice Emitted when a role is revoked from a user
    event CommunityRoleRevoked(
        uint256 indexed communityId,
        address indexed user,
        bytes32 indexed role
    );
    
    /// @notice Emitted when community status changes
    event CommunityStatusChanged(
        uint256 indexed communityId,
        bool active
    );

    /// @notice Emitted when community metadata URI changes after creation
    event CommunityMetadataURIUpdated(
        uint256 indexed communityId,
        string oldMetadataURI,
        string newMetadataURI
    );

    /// @notice Emitted when community parent changes after creation
    event CommunityParentUpdated(
        uint256 indexed communityId,
        uint256 indexed oldParentCommunityId,
        uint256 indexed newParentCommunityId
    );
    
    /// @notice Emitted when communities form an alliance
    event CommunityAllianceFormed(
        uint256 indexed communityId1,
        uint256 indexed communityId2
    );
    
    /*//////////////////////////////////////////////////////////////
                               CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    
    /// @param _paramController ParamController contract address
    constructor(address _paramController) {
        if (_paramController == address(0)) revert Errors.ZeroAddress();
        paramController = ParamController(_paramController);
    }
    
    /*//////////////////////////////////////////////////////////////
                        COMMUNITY REGISTRATION
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Register a new community
    /// @param name Community name
    /// @param description Community description
    /// @param metadataURI IPFS URI for additional metadata
    /// @param parentCommunityId Parent community ID (0 for root communities)
    /// @return communityId The newly created community ID
    function registerCommunity(
        string calldata name,
        string calldata description,
        string calldata metadataURI,
        uint256 parentCommunityId
    ) external returns (uint256 communityId) {
        return _registerCommunity(name, description, metadataURI, parentCommunityId, msg.sender);
    }

    /// @notice Register and bootstrap policy + modules in a single transaction
    /// @dev Preserves deployer admin ownership while batching ParamController and module wiring
    function bootstrapCommunity(
        string calldata name,
        string calldata description,
        string calldata metadataURI,
        uint256 parentCommunityId,
        BootstrapParams calldata bootstrapParams,
        ModuleAddresses calldata modules
    ) external returns (uint256 communityId) {
        communityId = _registerCommunity(name, description, metadataURI, parentCommunityId, msg.sender);

        paramController.bootstrapConfigureFromRegistry(
            communityId,
            msg.sender,
            ParamController.BootstrapConfig({
                verifierPanelSize: bootstrapParams.verifierPanelSize,
                verifierMin: bootstrapParams.verifierMin,
                maxPanelsPerEpoch: bootstrapParams.maxPanelsPerEpoch,
                useVPTWeighting: bootstrapParams.useVPTWeighting,
                maxWeightPerVerifier: bootstrapParams.maxWeightPerVerifier,
                cooldownAfterFraud: bootstrapParams.cooldownAfterFraud,
                debateWindow: bootstrapParams.debateWindow,
                voteWindow: bootstrapParams.voteWindow,
                executionDelay: bootstrapParams.executionDelay,
                minSeniority: bootstrapParams.minSeniority,
                minSBTs: bootstrapParams.minSBTs,
                proposalThreshold: bootstrapParams.proposalThreshold,
                minTreasuryBps: bootstrapParams.minTreasuryBps,
                minPositionsBps: bootstrapParams.minPositionsBps,
                spilloverTarget: bootstrapParams.spilloverTarget,
                spilloverSplitBpsToTreasury: bootstrapParams.spilloverSplitBpsToTreasury
            })
        );

        _setModuleAddresses(communityId, modules);
    }

    function _registerCommunity(
        string calldata name,
        string calldata description,
        string calldata metadataURI,
        uint256 parentCommunityId,
        address creator
    ) internal returns (uint256 communityId) {
        if (bytes(name).length == 0) {
            revert Errors.InvalidInput("Community name cannot be empty");
        }
        
        _validateParentCommunity(0, parentCommunityId);
        
        communityId = nextCommunityId++;
        
        Community storage community = communities[communityId];
        community.name = name;
        community.description = description;
        community.metadataURI = metadataURI;
        community.active = true;
        community.createdAt = block.timestamp;
        community.parentCommunityId = parentCommunityId;
        
        // Parameters are set separately via initializeDefaultParameters() or ParamController directly
        
        // Grant creator admin role for this community
        communityAdmins[communityId][creator] = true;
        
        // Increment active community count
        activeCommunityCount++;
        
        emit CommunityRegistered(communityId, name, creator, parentCommunityId);
    }
    
    /*//////////////////////////////////////////////////////////////
                        PARAMETER MANAGEMENT
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Initialize default parameters for a community
    /// @param communityId Community ID to initialize parameters for
    /// @dev This function requires that the caller has governance permissions in ParamController
    function initializeDefaultParameters(uint256 communityId) external {
        _requireValidCommunity(communityId);
        _requireCommunityAdmin(communityId);

        paramController.initializeDefaultParameters(communityId, msg.sender);
    }

    /// @notice Update the metadata URI for an existing community
    /// @dev Restricted to the community timelock once governance is wired
    function updateCommunityMetadataURI(uint256 communityId, string calldata newMetadataURI) external {
        _requireValidCommunity(communityId);
        _requireCommunityTimelock(communityId);

        Community storage community = communities[communityId];
        string memory oldMetadataURI = community.metadataURI;
        community.metadataURI = newMetadataURI;

        emit CommunityMetadataURIUpdated(communityId, oldMetadataURI, newMetadataURI);
    }

    /// @notice Update the parent community for an existing community
    /// @dev Restricted to the community timelock once governance is wired
    function updateParentCommunity(uint256 communityId, uint256 newParentCommunityId) external {
        _requireValidCommunity(communityId);
        _requireCommunityTimelock(communityId);
        _validateParentCommunity(communityId, newParentCommunityId);

        Community storage community = communities[communityId];
        uint256 oldParentCommunityId = community.parentCommunityId;
        community.parentCommunityId = newParentCommunityId;

        emit CommunityParentUpdated(communityId, oldParentCommunityId, newParentCommunityId);
    }
    

    
    /*//////////////////////////////////////////////////////////////
                         MODULE MANAGEMENT
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Set module address for a community
    /// @param communityId Community ID
    /// @param moduleKey Module identifier
    /// @param moduleAddress New module address
    function setModuleAddress(
        uint256 communityId,
        bytes32 moduleKey,
        address moduleAddress
    ) external {
        _requireValidCommunity(communityId);
        _requireCommunityAdmin(communityId);
        
        Community storage community = communities[communityId];
        address oldAddress;
        
        if (moduleKey == keccak256("accessManager")) {
            oldAddress = community.accessManager;
            community.accessManager = moduleAddress;
        } else if (moduleKey == keccak256("membershipToken")) {
            oldAddress = community.membershipToken;
            community.membershipToken = moduleAddress;
        } else if (moduleKey == keccak256("governor")) {
            oldAddress = community.governor;
            community.governor = moduleAddress;
        } else if (moduleKey == keccak256("timelock")) {
            oldAddress = community.timelock;
            community.timelock = moduleAddress;
        } else if (moduleKey == keccak256("countingMultiChoice")) {
            oldAddress = community.countingMultiChoice;
            community.countingMultiChoice = moduleAddress;
        } else if (moduleKey == keccak256("requestHub")) {
            oldAddress = community.requestHub;
            community.requestHub = moduleAddress;
        } else if (moduleKey == keccak256("draftsManager")) {
            oldAddress = community.draftsManager;
            community.draftsManager = moduleAddress;
        } else if (moduleKey == keccak256("engagementsManager")) {
            oldAddress = community.engagementsManager;
            community.engagementsManager = moduleAddress;
        } else if (moduleKey == keccak256("valuableActionRegistry")) {
            oldAddress = community.valuableActionRegistry;
            community.valuableActionRegistry = moduleAddress;
        } else if (moduleKey == keccak256("verifierPowerToken")) {
            oldAddress = community.verifierPowerToken;
            community.verifierPowerToken = moduleAddress;
        } else if (moduleKey == keccak256("verifierElection")) {
            oldAddress = community.verifierElection;
            community.verifierElection = moduleAddress;
        } else if (moduleKey == keccak256("verifierManager")) {
            oldAddress = community.verifierManager;
            community.verifierManager = moduleAddress;
        } else if (moduleKey == keccak256("valuableActionSBT")) {
            oldAddress = community.valuableActionSBT;
            community.valuableActionSBT = moduleAddress;
        } else if (moduleKey == keccak256("positionManager")) {
            oldAddress = community.positionManager;
            community.positionManager = moduleAddress;
        } else if (moduleKey == keccak256("credentialManager")) {
            oldAddress = community.credentialManager;
            community.credentialManager = moduleAddress;
        } else if (moduleKey == keccak256("cohortRegistry")) {
            oldAddress = community.cohortRegistry;
            community.cohortRegistry = moduleAddress;
        } else if (moduleKey == keccak256("investmentCohortManager")) {
            oldAddress = community.investmentCohortManager;
            community.investmentCohortManager = moduleAddress;
        } else if (moduleKey == keccak256("revenueRouter")) {
            oldAddress = community.revenueRouter;
            community.revenueRouter = moduleAddress;
        } else if (moduleKey == keccak256("treasuryVault")) {
            oldAddress = community.treasuryVault;
            community.treasuryVault = moduleAddress;
        } else if (moduleKey == keccak256("treasuryAdapter")) {
            oldAddress = community.treasuryAdapter;
            community.treasuryAdapter = moduleAddress;
        } else if (moduleKey == keccak256("communityToken")) {
            oldAddress = community.communityToken;
            community.communityToken = moduleAddress;
        } else if (moduleKey == keccak256("paramController")) {
            oldAddress = community.paramController;
            community.paramController = moduleAddress;
        } else if (moduleKey == keccak256("commerceDisputes")) {
            oldAddress = community.commerceDisputes;
            community.commerceDisputes = moduleAddress;
        } else if (moduleKey == keccak256("marketplace")) {
            oldAddress = community.marketplace;
            community.marketplace = moduleAddress;
        } else if (moduleKey == keccak256("housingManager")) {
            oldAddress = community.housingManager;
            community.housingManager = moduleAddress;
        } else if (moduleKey == keccak256("projectFactory")) {
            oldAddress = community.projectFactory;
            community.projectFactory = moduleAddress;
        } else {
            revert Errors.InvalidInput("Unknown module key");
        }
        
        emit ModuleAddressUpdated(communityId, moduleKey, oldAddress, moduleAddress);
    }

    /// @notice Set multiple module addresses at once
    /// @param communityId Community ID
    /// @param modules ModuleAddresses struct with all module addresses
    function setModuleAddresses(
        uint256 communityId,
        ModuleAddresses calldata modules
    ) external {
        _requireValidCommunity(communityId);
        _requireCommunityAdmin(communityId);
        _setModuleAddresses(communityId, modules);
    }

    function _setModuleAddresses(uint256 communityId, ModuleAddresses calldata modules) internal {
        Community storage community = communities[communityId];

        if (modules.accessManager != address(0)) {
            emit ModuleAddressUpdated(communityId, keccak256("accessManager"), community.accessManager, modules.accessManager);
            community.accessManager = modules.accessManager;
        }
        if (modules.membershipToken != address(0)) {
            emit ModuleAddressUpdated(communityId, keccak256("membershipToken"), community.membershipToken, modules.membershipToken);
            community.membershipToken = modules.membershipToken;
        }
        if (modules.governor != address(0)) {
            emit ModuleAddressUpdated(communityId, keccak256("governor"), community.governor, modules.governor);
            community.governor = modules.governor;
        }
        if (modules.timelock != address(0)) {
            emit ModuleAddressUpdated(communityId, keccak256("timelock"), community.timelock, modules.timelock);
            community.timelock = modules.timelock;
        }
        if (modules.countingMultiChoice != address(0)) {
            emit ModuleAddressUpdated(communityId, keccak256("countingMultiChoice"), community.countingMultiChoice, modules.countingMultiChoice);
            community.countingMultiChoice = modules.countingMultiChoice;
        }
        if (modules.requestHub != address(0)) {
            emit ModuleAddressUpdated(communityId, keccak256("requestHub"), community.requestHub, modules.requestHub);
            community.requestHub = modules.requestHub;
        }
        if (modules.draftsManager != address(0)) {
            emit ModuleAddressUpdated(communityId, keccak256("draftsManager"), community.draftsManager, modules.draftsManager);
            community.draftsManager = modules.draftsManager;
        }
        if (modules.engagementsManager != address(0)) {
            emit ModuleAddressUpdated(communityId, keccak256("engagementsManager"), community.engagementsManager, modules.engagementsManager);
            community.engagementsManager = modules.engagementsManager;
        }
        if (modules.valuableActionRegistry != address(0)) {
            emit ModuleAddressUpdated(communityId, keccak256("valuableActionRegistry"), community.valuableActionRegistry, modules.valuableActionRegistry);
            community.valuableActionRegistry = modules.valuableActionRegistry;
        }
        if (modules.verifierPowerToken != address(0)) {
            emit ModuleAddressUpdated(communityId, keccak256("verifierPowerToken"), community.verifierPowerToken, modules.verifierPowerToken);
            community.verifierPowerToken = modules.verifierPowerToken;
        }
        if (modules.verifierElection != address(0)) {
            emit ModuleAddressUpdated(communityId, keccak256("verifierElection"), community.verifierElection, modules.verifierElection);
            community.verifierElection = modules.verifierElection;
        }
        if (modules.verifierManager != address(0)) {
            emit ModuleAddressUpdated(communityId, keccak256("verifierManager"), community.verifierManager, modules.verifierManager);
            community.verifierManager = modules.verifierManager;
        }
        if (modules.valuableActionSBT != address(0)) {
            emit ModuleAddressUpdated(communityId, keccak256("valuableActionSBT"), community.valuableActionSBT, modules.valuableActionSBT);
            community.valuableActionSBT = modules.valuableActionSBT;
        }
        if (modules.positionManager != address(0)) {
            emit ModuleAddressUpdated(communityId, keccak256("positionManager"), community.positionManager, modules.positionManager);
            community.positionManager = modules.positionManager;
        }
        if (modules.credentialManager != address(0)) {
            emit ModuleAddressUpdated(communityId, keccak256("credentialManager"), community.credentialManager, modules.credentialManager);
            community.credentialManager = modules.credentialManager;
        }
        if (modules.cohortRegistry != address(0)) {
            emit ModuleAddressUpdated(communityId, keccak256("cohortRegistry"), community.cohortRegistry, modules.cohortRegistry);
            community.cohortRegistry = modules.cohortRegistry;
        }
        if (modules.investmentCohortManager != address(0)) {
            emit ModuleAddressUpdated(communityId, keccak256("investmentCohortManager"), community.investmentCohortManager, modules.investmentCohortManager);
            community.investmentCohortManager = modules.investmentCohortManager;
        }
        if (modules.revenueRouter != address(0)) {
            emit ModuleAddressUpdated(communityId, keccak256("revenueRouter"), community.revenueRouter, modules.revenueRouter);
            community.revenueRouter = modules.revenueRouter;
        }
        if (modules.treasuryVault != address(0)) {
            emit ModuleAddressUpdated(communityId, keccak256("treasuryVault"), community.treasuryVault, modules.treasuryVault);
            community.treasuryVault = modules.treasuryVault;
        }
        if (modules.treasuryAdapter != address(0)) {
            emit ModuleAddressUpdated(communityId, keccak256("treasuryAdapter"), community.treasuryAdapter, modules.treasuryAdapter);
            community.treasuryAdapter = modules.treasuryAdapter;
        }
        if (modules.communityToken != address(0)) {
            emit ModuleAddressUpdated(communityId, keccak256("communityToken"), community.communityToken, modules.communityToken);
            community.communityToken = modules.communityToken;
        }
        if (modules.paramController != address(0)) {
            emit ModuleAddressUpdated(communityId, keccak256("paramController"), community.paramController, modules.paramController);
            community.paramController = modules.paramController;
        }
        if (modules.commerceDisputes != address(0)) {
            emit ModuleAddressUpdated(communityId, keccak256("commerceDisputes"), community.commerceDisputes, modules.commerceDisputes);
            community.commerceDisputes = modules.commerceDisputes;
        }
        if (modules.marketplace != address(0)) {
            emit ModuleAddressUpdated(communityId, keccak256("marketplace"), community.marketplace, modules.marketplace);
            community.marketplace = modules.marketplace;
        }
        if (modules.housingManager != address(0)) {
            emit ModuleAddressUpdated(communityId, keccak256("housingManager"), community.housingManager, modules.housingManager);
            community.housingManager = modules.housingManager;
        }
        if (modules.projectFactory != address(0)) {
            emit ModuleAddressUpdated(communityId, keccak256("projectFactory"), community.projectFactory, modules.projectFactory);
            community.projectFactory = modules.projectFactory;
        }
    }



    /*//////////////////////////////////////////////////////////////
                          ROLE MANAGEMENT
    //////////////////////////////////////////////////////////////*/    
    /// @notice Grant a community-specific role to a user
    /// @param communityId Community ID
    /// @param user User to grant role to
    /// @param role Role to grant
    function grantCommunityRole(
        uint256 communityId,
        address user,
        bytes32 role
    ) external {
        _requireValidCommunity(communityId);
        _requireCommunityAdmin(communityId);
        
        if (user == address(0)) revert Errors.ZeroAddress();
        
        if (role == MODERATOR_ROLE) {
            moderators[communityId][user] = true;
            communityRoles[communityId][user][role] = true;
        } else if (role == CURATOR_ROLE) {
            curators[communityId][user] = true;
            communityRoles[communityId][user][role] = true;
        } else {
            revert Errors.InvalidInput("Invalid role");
        }
        
        emit CommunityRoleGranted(communityId, user, role);
    }
    
    /// @notice Revoke a community-specific role from a user
    /// @param communityId Community ID
    /// @param user User to revoke role from
    /// @param role Role to revoke
    function revokeCommunityRole(
        uint256 communityId,
        address user,
        bytes32 role
    ) external {
        _requireValidCommunity(communityId);
        _requireCommunityAdmin(communityId);
        
        if (role == MODERATOR_ROLE) {
            moderators[communityId][user] = false;
            communityRoles[communityId][user][role] = false;
        } else if (role == CURATOR_ROLE) {
            curators[communityId][user] = false;
            communityRoles[communityId][user][role] = false;
        } else {
            revert Errors.InvalidInput("Invalid role");
        }
        
        emit CommunityRoleRevoked(communityId, user, role);
    }
    
    /*//////////////////////////////////////////////////////////////
                         STATUS MANAGEMENT
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Activate or deactivate a community
    /// @param communityId Community ID
    /// @param active New active status
    function setCommunityStatus(
        uint256 communityId,
        bool active
    ) external {
        _requireValidCommunity(communityId);
        _requireCommunityAdmin(communityId);
        
        Community storage community = communities[communityId];
        if (community.active == active) return;
        
        community.active = active;
        
        if (active) {
            activeCommunityCount++;
        } else {
            activeCommunityCount--;
        }
        
        emit CommunityStatusChanged(communityId, active);
    }
    
    /*//////////////////////////////////////////////////////////////
                      COMMUNITY RELATIONSHIPS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Form an alliance between two communities
    /// @param communityId1 First community ID
    /// @param communityId2 Second community ID
    function formAlliance(
        uint256 communityId1,
        uint256 communityId2
    ) external {
        _requireValidCommunity(communityId1);
        _requireValidCommunity(communityId2);
        _requireCommunityAdmin(communityId1);
        
        if (communityId1 == communityId2) {
            revert Errors.InvalidInput("Cannot ally with self");
        }
        
        // Add each community to the other's ally list
        communities[communityId1].allyCommunityIds.push(communityId2);
        communities[communityId2].allyCommunityIds.push(communityId1);
        
        emit CommunityAllianceFormed(communityId1, communityId2);
    }
    
    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Get community information
    /// @param communityId Community ID
    /// @return Community data
    function getCommunity(uint256 communityId) external view returns (Community memory) {
        _requireValidCommunity(communityId);
        return communities[communityId];
    }

    /// @notice Get timelock address for a community
    /// @param communityId Community ID
    /// @return Timelock address
    function getTimelock(uint256 communityId) external view returns (address) {
        _requireValidCommunity(communityId);
        return communities[communityId].timelock;
    }
    
    /// @notice Get community governance parameters
    /// @param communityId Community ID
    /// @return debateWindow Debate window in seconds
    /// @return voteWindow Vote window in seconds
    /// @return executionDelay Execution delay in seconds
    function getGovernanceParameters(uint256 communityId) external view returns (
        uint256 debateWindow,
        uint256 voteWindow,
        uint256 executionDelay
    ) {
        _requireValidCommunity(communityId);
        return paramController.getGovernanceParams(communityId);
    }
    
    /// @notice Get community eligibility rules
    /// @param communityId Community ID
    /// @return minSeniority Minimum seniority in seconds
    /// @return minSBTs Minimum SBT count
    /// @return proposalThreshold Minimum tokens for proposals
    function getEligibilityRules(uint256 communityId) external view returns (
        uint256 minSeniority,
        uint256 minSBTs,
        uint256 proposalThreshold
    ) {
        _requireValidCommunity(communityId);
        return paramController.getEligibilityParams(communityId);
    }
    
    /// @notice Get revenue policy parameters for a community
    /// @param communityId Community ID
    /// @return minTreasuryBps Minimum treasury share in basis points
    /// @return minPositionsBps Minimum positions share in basis points
    /// @return spilloverTarget 0 = spillover to positions, 1 = spillover to treasury, 2 = split
    /// @return spilloverSplitBpsToTreasury Treasury split when spilloverTarget = split (bps)
    /// @return feeOnWithdraw Withdrawal fee in basis points
    /// @return backingAssets Array of backing asset addresses
    function getEconomicParameters(uint256 communityId) external view returns (
        uint256 minTreasuryBps,
        uint256 minPositionsBps,
        uint8 spilloverTarget,
        uint256 spilloverSplitBpsToTreasury,
        uint256 feeOnWithdraw,
        address[] memory backingAssets
    ) {
        _requireValidCommunity(communityId);
        (minTreasuryBps, minPositionsBps, spilloverTarget, spilloverSplitBpsToTreasury) = 
            paramController.getRevenuePolicy(communityId);
        feeOnWithdraw = paramController.getUint256(communityId, paramController.FEE_ON_WITHDRAW());
        backingAssets = paramController.getAddressArray(communityId, paramController.BACKING_ASSETS());
    }
    
    /// @notice Check if user has a specific role in a community
    /// @param communityId Community ID
    /// @param user User address
    /// @param role Role to check
    /// @return Whether user has the role
    function hasRole(
        uint256 communityId,
        address user,
        bytes32 role
    ) external view returns (bool) {
        _requireValidCommunity(communityId);
        
        return communityRoles[communityId][user][role];
    }
    
    /// @notice Get all active communities
    /// @return Array of active community IDs
    function getActiveCommunities() external view returns (uint256[] memory) {
        uint256[] memory activeCommunities = new uint256[](activeCommunityCount);
        uint256 index = 0;
        
        for (uint256 i = 1; i < nextCommunityId; i++) {
            if (communities[i].active) {
                activeCommunities[index] = i;
                index++;
            }
        }
        
        return activeCommunities;
    }
    
    /// @notice Get community relationships
    /// @param communityId Community ID
    /// @return parentCommunityId Parent community ID
    /// @return allyCommunityIds Array of allied community IDs
    function getCommunityRelationships(uint256 communityId) external view returns (
        uint256 parentCommunityId,
        uint256[] memory allyCommunityIds
    ) {
        _requireValidCommunity(communityId);
        Community storage community = communities[communityId];
        return (community.parentCommunityId, community.allyCommunityIds);
    }

    /// @notice Get all module addresses for a community
    /// @param communityId Community ID
    /// @return ModuleAddresses struct containing all module addresses
    function getCommunityModules(uint256 communityId) external view returns (ModuleAddresses memory) {
        _requireValidCommunity(communityId);
        Community storage community = communities[communityId];
        
        return ModuleAddresses({
            accessManager: community.accessManager,
            membershipToken: community.membershipToken,
            governor: community.governor,
            timelock: community.timelock,
            countingMultiChoice: community.countingMultiChoice,
            requestHub: community.requestHub,
            draftsManager: community.draftsManager,
            engagementsManager: community.engagementsManager,
            valuableActionRegistry: community.valuableActionRegistry,
            verifierPowerToken: community.verifierPowerToken,
            verifierElection: community.verifierElection,
            verifierManager: community.verifierManager,
            valuableActionSBT: community.valuableActionSBT,
            positionManager: community.positionManager,
            credentialManager: community.credentialManager,
            cohortRegistry: community.cohortRegistry,
            investmentCohortManager: community.investmentCohortManager,
            revenueRouter: community.revenueRouter,
            treasuryVault: community.treasuryVault,
            treasuryAdapter: community.treasuryAdapter,
            communityToken: community.communityToken,
            paramController: community.paramController,
            commerceDisputes: community.commerceDisputes,
            marketplace: community.marketplace,
            housingManager: community.housingManager,
            projectFactory: community.projectFactory
        });
    }



    /*//////////////////////////////////////////////////////////////
                            INTERNAL HELPERS
    //////////////////////////////////////////////////////////////*/    
    /// @notice Require that community exists
    /// @param communityId Community ID to check
    function _requireValidCommunity(uint256 communityId) internal view {
        if (communityId == 0 || communityId >= nextCommunityId) {
            revert Errors.InvalidInput("Community does not exist");
        }
    }

    function _requireCommunityTimelock(uint256 communityId) internal view {
        address timelock = communities[communityId].timelock;
        if (timelock == address(0)) {
            revert Errors.InvalidInput("Community timelock not set");
        }
        if (msg.sender != timelock) {
            revert Errors.NotAuthorized(msg.sender);
        }
    }

    function _validateParentCommunity(uint256 communityId, uint256 parentCommunityId) internal view {
        if (parentCommunityId == 0) {
            return;
        }

        if (parentCommunityId == communityId) {
            revert Errors.InvalidInput("Community cannot be its own parent");
        }

        if (parentCommunityId >= nextCommunityId) {
            revert Errors.InvalidInput("Parent community does not exist");
        }

        if (!communities[parentCommunityId].active) {
            revert Errors.InvalidInput("Parent community not active");
        }
    }
    
    /// @notice Require that caller is community admin
    /// @param communityId Community ID to check  
    function _requireCommunityAdmin(uint256 communityId) internal view {
        address caller = msg.sender;
        
        // Check if caller is a community admin
        if (communityAdmins[communityId][caller]) {
            return; // Authorized
        }

        // If not an admin, revert
        revert Errors.NotAuthorized(caller);
    }
    


}