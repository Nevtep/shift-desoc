// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Errors} from "../libs/Errors.sol";
import {ParamController} from "./ParamController.sol";

/// @title CommunityRegistry
/// @notice Central registry for community metadata, parameters, and module addresses
/// @dev Single source of truth for community coordination and configuration
contract CommunityRegistry is AccessControl {
    
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
        address governor;             // Governor contract
        address timelock;             // Timelock contract
        address requestHub;           // RequestHub contract
        address draftsManager;        // DraftsManager contract
        address engagementsManager;   // Engagements contract
        address valuableActionRegistry; // ValuableActionRegistry contract
        address verifierPowerToken;   // VerifierPowerToken1155 contract (VPT system)
        address verifierElection;     // VerifierElection contract (VPT system)
        address verifierManager;      // VerifierManager contract (VPT system)
        address valuableActionSBT;    // ValuableActionSBT contract
        address treasuryAdapter;      // TreasuryAdapter contract
        address communityToken;       // CommunityToken contract
        address paramController;      // ParamController contract
        
        // Cross-Community Links
        uint256 parentCommunityId;   // Parent community (0 if root)
        uint256[] allyCommunityIds;  // Allied communities
    }
    
    /// @notice Module addresses structure for easy return
    struct ModuleAddresses {
        address governor;
        address timelock;
        address requestHub;
        address draftsManager;
        address engagementsManager;
        address valuableActionRegistry;
        address verifierPowerToken;
        address verifierElection;
        address verifierManager;
        address valuableActionSBT;
        address treasuryAdapter;
        address communityToken;
        address paramController;
    }



    /*//////////////////////////////////////////////////////////////
                                ROLES
    //////////////////////////////////////////////////////////////*/    
    /// @notice Role for governance operations
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    
    /// @notice Role for community moderators
    bytes32 public constant MODERATOR_ROLE = keccak256("MODERATOR_ROLE");
    
    /// @notice Role for community curators
    bytes32 public constant CURATOR_ROLE = keccak256("CURATOR_ROLE");
    
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
    
    /// @notice Emitted when communities form an alliance
    event CommunityAllianceFormed(
        uint256 indexed communityId1,
        uint256 indexed communityId2
    );
    
    /*//////////////////////////////////////////////////////////////
                               CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    
    /// @param initialAdmin Address that will have DEFAULT_ADMIN_ROLE
    /// @param _paramController ParamController contract address
    constructor(address initialAdmin, address _paramController) {
        if (initialAdmin == address(0)) revert Errors.ZeroAddress();
        if (_paramController == address(0)) revert Errors.ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
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
        if (bytes(name).length == 0) {
            revert Errors.InvalidInput("Community name cannot be empty");
        }
        
        // Validate parent community if specified
        if (parentCommunityId != 0) {
            if (!communities[parentCommunityId].active) {
                revert Errors.InvalidInput("Parent community not active");
            }
        }
        
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
        communityRoles[communityId][msg.sender][DEFAULT_ADMIN_ROLE] = true;
        communityAdmins[communityId][msg.sender] = true;
        
        // Increment active community count
        activeCommunityCount++;
        
        emit CommunityRegistered(communityId, name, msg.sender, parentCommunityId);
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
        
        // Set default governance parameters (7 day debate, 3 day vote, 2 day execution delay)
        paramController.setGovernanceParams(communityId, 7 days, 3 days, 2 days);
        
        // Set default eligibility rules (no restrictions by default)
        paramController.setEligibilityParams(communityId, 0, 0, 1e18);
        
        // Set default revenue policy (25% min workers, 25% treasury, 50% investors, spillover to treasury)

        // Using basis points: 2500 = 25%, 2500 = 25%, 5000 = 50%
        paramController.setRevenuePolicy(communityId, 2500, 2500, 5000, 1);
        
        // Set default backing assets (empty by default)
        address[] memory emptyAssets = new address[](0);
        paramController.setAddressArray(communityId, paramController.BACKING_ASSETS(), emptyAssets);
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
        
        if (moduleKey == keccak256("governor")) {
            oldAddress = community.governor;
            community.governor = moduleAddress;
        } else if (moduleKey == keccak256("timelock")) {
            oldAddress = community.timelock;
            community.timelock = moduleAddress;
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
        } else if (moduleKey == keccak256("treasuryAdapter")) {
            oldAddress = community.treasuryAdapter;
            community.treasuryAdapter = moduleAddress;
        } else if (moduleKey == keccak256("communityToken")) {
            oldAddress = community.communityToken;
            community.communityToken = moduleAddress;
        } else if (moduleKey == keccak256("paramController")) {
            oldAddress = community.paramController;
            community.paramController = moduleAddress;
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
        
        Community storage community = communities[communityId];
        
        // Update all module addresses
        if (modules.governor != address(0)) {
            emit ModuleAddressUpdated(communityId, keccak256("governor"), community.governor, modules.governor);
            community.governor = modules.governor;
        }
        if (modules.timelock != address(0)) {
            emit ModuleAddressUpdated(communityId, keccak256("timelock"), community.timelock, modules.timelock);
            community.timelock = modules.timelock;
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
    /// @return minWorkersBps Minimum workers share in basis points
    /// @return treasuryBps Treasury base share in basis points
    /// @return investorsBps Investors pool share in basis points
    /// @return spilloverTarget 0 = spillover to workers, 1 = spillover to treasury
    /// @return feeOnWithdraw Withdrawal fee in basis points
    /// @return backingAssets Array of backing asset addresses
    function getEconomicParameters(uint256 communityId) external view returns (
        uint256 minWorkersBps,
        uint256 treasuryBps,
        uint256 investorsBps,
        uint8 spilloverTarget,
        uint256 feeOnWithdraw,
        address[] memory backingAssets
    ) {
        _requireValidCommunity(communityId);
        (minWorkersBps, treasuryBps, investorsBps, spilloverTarget) = 
            paramController.getRevenuePolicy(communityId);
        feeOnWithdraw = paramController.getUint256(communityId, paramController.FEE_ON_WITHDRAW());
        backingAssets = paramController.getAddressArray(communityId, paramController.BACKING_ASSETS());
    }
    
    /// @notice Get all module addresses for a community
    /// @param communityId Community ID
    /// @return governor Governor contract address
    /// @return timelock Timelock contract address
    /// @return requestHub RequestHub contract address
    /// @return draftsManager DraftsManager contract address
    /// @return engagementsManager Engagements contract address
    /// @return valuableActionRegistry ValuableActionRegistry contract address
    /// @return valuableActionSBT ValuableActionSBT contract address
    /// @return treasuryAdapter TreasuryAdapter contract address
    /// @return communityToken CommunityToken contract address
    function getModuleAddresses(uint256 communityId) external view returns (
        address governor,
        address timelock,
        address requestHub,
        address draftsManager,
        address engagementsManager,
        address valuableActionRegistry,
        address valuableActionSBT,
        address treasuryAdapter,
        address communityToken
    ) {
        _requireValidCommunity(communityId);
        Community storage community = communities[communityId];
        return (
            community.governor,
            community.timelock,
            community.requestHub,
            community.draftsManager,
            community.engagementsManager,
            community.valuableActionRegistry,
            community.valuableActionSBT,
            community.treasuryAdapter,
            community.communityToken
        );
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
            governor: community.governor,
            timelock: community.timelock,
            requestHub: community.requestHub,
            draftsManager: community.draftsManager,
            engagementsManager: community.engagementsManager,
            valuableActionRegistry: community.valuableActionRegistry,
            verifierPowerToken: community.verifierPowerToken,
            verifierElection: community.verifierElection,
            verifierManager: community.verifierManager,
            valuableActionSBT: community.valuableActionSBT,
            treasuryAdapter: community.treasuryAdapter,
            communityToken: community.communityToken,
            paramController: community.paramController
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
    
    /// @notice Require that caller is community admin
    /// @param communityId Community ID to check  
    function _requireCommunityAdmin(uint256 communityId) internal view {
        address caller = msg.sender;
        
        // Check if caller is a community admin
        if (communityAdmins[communityId][caller]) {
            return; // Authorized
        }
        
        // Check if caller has global admin role
        if (hasRole(DEFAULT_ADMIN_ROLE, caller)) {
            return; // Authorized
        }
        
        // If neither condition is met, revert
        revert Errors.NotAuthorized(caller);
    }
    


}