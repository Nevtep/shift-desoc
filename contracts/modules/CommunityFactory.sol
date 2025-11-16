// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {ShiftGovernor} from "../core/ShiftGovernor.sol";
import {CountingMultiChoice} from "../core/CountingMultiChoice.sol";
import {MembershipTokenERC20Votes} from "../tokens/MembershipTokenERC20Votes.sol";
import {ValuableActionRegistry} from "./ValuableActionRegistry.sol";
import {Claims} from "./Claims.sol";
import {RequestHub} from "./RequestHub.sol";
import {DraftsManager} from "./DraftsManager.sol";
import {CommunityRegistry} from "./CommunityRegistry.sol";
import {CommunityToken} from "../tokens/CommunityToken.sol";
import {WorkerSBT} from "./WorkerSBT.sol";
import {VerifierPool} from "./VerifierPool.sol";
import {TreasuryAdapter} from "./TreasuryAdapter.sol";
import {Types} from "../libs/Types.sol";
import {Errors} from "../libs/Errors.sol";

/// @title CommunityFactory
/// @notice Factory contract for deploying complete community governance infrastructure
/// @dev Creates full governance stack with proper initialization and founder bootstrap
contract CommunityFactory is AccessControl {
    
    /*//////////////////////////////////////////////////////////////
                            TEMPLATE ADDRESSES
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Template contract addresses for cloning
    address public immutable governorTemplate;
    address public immutable timelockTemplate;
    address public immutable membershipTokenTemplate;
    address public immutable valuableActionRegistryTemplate;
    address public immutable claimsTemplate;
    address public immutable requestHubTemplate;
    address public immutable draftsManagerTemplate;
    address public immutable communityTokenTemplate;
    address public immutable workerSBTTemplate;
    address public immutable verifierPoolTemplate;
    address public immutable treasuryAdapterTemplate;
    
    /// @notice Shared counting contract for multi-choice voting
    address public immutable countingMultiChoice;
    
    /// @notice Central community registry
    address public immutable communityRegistry;
    
    /*//////////////////////////////////////////////////////////////
                            FOUNDER PARAMETERS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Initial MembershipTokens minted to founder
    uint256 public constant FOUNDER_INITIAL_TOKENS = 10_000 ether;
    
    /// @notice Initial governance parameters for new communities
    struct GovernanceParams {
        uint256 debateWindow;      // Time for proposal debate (seconds)
        uint256 voteWindow;        // Time for voting (seconds) 
        uint256 executionDelay;    // Time before execution (seconds)
        uint256 minSeniority;      // Minimum account age to participate
        uint256 minSBTs;           // Minimum SBT count to participate
        uint256 proposalThreshold; // Minimum tokens to create proposal
        uint256[3] revenueSplit;   // [workers%, treasury%, investors%]
        uint256 feeOnWithdraw;     // Fee percentage on withdrawals (basis points)
    }
    
    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Emitted when a new community is deployed
    event CommunityDeployed(
        uint256 indexed communityId,
        address indexed founder,
        address governor,
        address timelock,
        address membershipToken,
        address valuableActionRegistry
    );
    
    /// @notice Emitted when founder receives initial setup
    event FounderBootstrapped(
        uint256 indexed communityId,
        address indexed founder,
        uint256 membershipTokens,
        uint256[] valuableActionIds
    );
    
    /*//////////////////////////////////////////////////////////////
                               CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    
    /// @param _communityRegistry Address of the CommunityRegistry contract
    /// @param _countingMultiChoice Address of the CountingMultiChoice contract
    /// @param _templates Array of template contract addresses in specific order
    constructor(
        address _communityRegistry,
        address _countingMultiChoice,
        address[11] memory _templates
    ) {
        if (_communityRegistry == address(0)) revert Errors.ZeroAddress();
        if (_countingMultiChoice == address(0)) revert Errors.ZeroAddress();
        
        communityRegistry = _communityRegistry;
        countingMultiChoice = _countingMultiChoice;
        
        // Template addresses in order: governor, timelock, membershipToken, valuableActionRegistry,
        // claims, requestHub, draftsManager, communityToken, workerSBT, verifierPool, treasuryAdapter
        governorTemplate = _templates[0];
        timelockTemplate = _templates[1];
        membershipTokenTemplate = _templates[2];
        valuableActionRegistryTemplate = _templates[3];
        claimsTemplate = _templates[4];
        requestHubTemplate = _templates[5];
        draftsManagerTemplate = _templates[6];
        communityTokenTemplate = _templates[7];
        workerSBTTemplate = _templates[8];
        verifierPoolTemplate = _templates[9];
        treasuryAdapterTemplate = _templates[10];
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    /*//////////////////////////////////////////////////////////////
                          COMMUNITY DEPLOYMENT
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Deploy a complete community governance infrastructure
    /// @param name Community name
    /// @param description Community description
    /// @param metadataURI IPFS URI for additional metadata
    /// @param governanceParams Initial governance configuration
    /// @param parentCommunityId Parent community ID (0 for root communities)
    /// @return communityId The newly created community ID
    function createCommunity(
        string calldata name,
        string calldata description,
        string calldata metadataURI,
        GovernanceParams calldata governanceParams,
        uint256 parentCommunityId
    ) external returns (uint256 communityId) {
        address founder = msg.sender;
        
        // 1. Register community in central registry
        communityId = CommunityRegistry(communityRegistry).registerCommunity(
            name,
            description,
            metadataURI,
            parentCommunityId
        );
        
        // 2. Deploy core governance contracts
        address membershipToken = _deployMembershipToken(name, communityId, founder);
        address timelock = _deployTimelock(governanceParams.executionDelay);
        address governor = _deployGovernor(membershipToken, timelock);
        
        // 3. Deploy module contracts
        address valuableActionRegistry = _deployValuableActionRegistry(communityId);
        address workerSBT = _deployWorkerSBT(communityId);
        address verifierPool = _deployVerifierPool(communityId);
        address claims = _deployClaims(valuableActionRegistry, verifierPool, workerSBT, membershipToken);
        address requestHub = _deployRequestHub(communityId);
        address draftsManager = _deployDraftsManager(communityId, governor);
        address communityToken = _deployCommunityToken(name);
        address treasuryAdapter = _deployTreasuryAdapter(communityId);
        
        // 4. Update community registry with module addresses
        _updateCommunityModules(
            communityId,
            governor,
            timelock,
            membershipToken,
            valuableActionRegistry,
            claims,
            requestHub,
            draftsManager,
            communityToken,
            workerSBT,
            verifierPool,
            treasuryAdapter
        );
        
        // 5. Initialize contracts with proper configurations
        _initializeContracts(
            communityId,
            governor,
            timelock,
            membershipToken,
            valuableActionRegistry,
            claims,
            founder,
            governanceParams
        );
        
        // 6. Bootstrap founder with initial tokens and ValuableActions
        uint256[] memory valuableActionIds = _bootstrapFounder(
            communityId,
            founder,
            membershipToken,
            valuableActionRegistry
        );
        
        emit CommunityDeployed(
            communityId,
            founder,
            governor,
            timelock,
            membershipToken,
            valuableActionRegistry
        );
        
        emit FounderBootstrapped(
            communityId,
            founder,
            FOUNDER_INITIAL_TOKENS,
            valuableActionIds
        );
        
        return communityId;
    }
    
    /*//////////////////////////////////////////////////////////////
                         DEPLOYMENT HELPERS
    //////////////////////////////////////////////////////////////*/
    
    /// @dev Deploy MembershipToken for the community
    function _deployMembershipToken(string calldata name, uint256 communityId, address founder) 
        private returns (address) {
        string memory tokenName = string.concat(name, " Membership");
        string memory tokenSymbol = string.concat("MEMBER-", _toString(communityId));
        
        // Deploy new MembershipToken instance with proper constructor
        MembershipTokenERC20Votes membershipToken = new MembershipTokenERC20Votes(
            tokenName,
            tokenSymbol, 
            communityId,
            founder // founder gets initial admin role
        );
        
        return address(membershipToken);
    }
    
    /// @dev Deploy TimelockController for the community
    function _deployTimelock(uint256 executionDelay) private returns (address) {
        address[] memory proposers = new address[](1);
        address[] memory executors = new address[](1);
        
        proposers[0] = address(this); // Factory can propose initially
        executors[0] = address(0);    // Anyone can execute after delay
        
        return address(new TimelockController(executionDelay, proposers, executors, address(0)));
    }
    
    /// @dev Deploy ShiftGovernor for the community
    function _deployGovernor(address membershipToken, address timelock) 
        private returns (address) {
        return address(new ShiftGovernor(membershipToken, timelock));
    }
    
    /// @dev Deploy ValuableActionRegistry for the community
    function _deployValuableActionRegistry(uint256 communityId) private returns (address) {
        // Deploy new instance instead of cloning since constructor takes parameters
        return address(new ValuableActionRegistry(msg.sender));
    }
    
    /// @dev Deploy Claims contract for the community
    function _deployClaims(address valuableActionRegistry, address verifierPool, address workerSBT, address membershipToken) private returns (address) {
        // Deploy new instance with required constructor parameters
        return address(new Claims(
            msg.sender,           // governance (founder initially)
            valuableActionRegistry,
            verifierPool,
            workerSBT,
            membershipToken       // for minting governance tokens
        ));
    }
    
    /// @dev Deploy RequestHub for the community
    function _deployRequestHub(uint256 communityId) private returns (address) {
        // TODO: Implement RequestHub constructor when contract is available
        // For now, return template address
        return requestHubTemplate;
    }
    
    /// @dev Deploy DraftsManager for the community
    function _deployDraftsManager(uint256 communityId, address governor) 
        private returns (address) {
        // TODO: Implement DraftsManager constructor when contract is available
        // For now, return template address
        return draftsManagerTemplate;
    }
    
    /// @dev Deploy CommunityToken for the community
    function _deployCommunityToken(string calldata name) private returns (address) {
        // TODO: Implement CommunityToken constructor when contract is available
        // For now, return template address
        return communityTokenTemplate;
    }
    
    /// @dev Deploy WorkerSBT for the community
    function _deployWorkerSBT(uint256 communityId) private returns (address) {
        // TODO: Implement WorkerSBT constructor when contract is available
        // For now, return template address
        return workerSBTTemplate;
    }
    
    /// @dev Deploy VerifierPool for the community
    function _deployVerifierPool(uint256 communityId) private returns (address) {
        // TODO: Implement VerifierPool constructor when contract is available
        // For now, return template address
        return verifierPoolTemplate;
    }
    
    /// @dev Deploy TreasuryAdapter for the community
    function _deployTreasuryAdapter(uint256 communityId) private returns (address) {
        // TODO: Implement TreasuryAdapter constructor when contract is available
        // For now, return template address
        return treasuryAdapterTemplate;
    }
    
    /*//////////////////////////////////////////////////////////////
                         INITIALIZATION HELPERS
    //////////////////////////////////////////////////////////////*/
    
    /// @dev Update CommunityRegistry with all module addresses
    function _updateCommunityModules(
        uint256 communityId,
        address governor,
        address timelock,
        address membershipToken,
        address valuableActionRegistry,
        address claims,
        address requestHub,
        address draftsManager,
        address communityToken,
        address workerSBT,
        address verifierPool,
        address treasuryAdapter
    ) private {
        CommunityRegistry registry = CommunityRegistry(communityRegistry);
        
        registry.setModuleAddress(communityId, keccak256("governor"), governor);
        registry.setModuleAddress(communityId, keccak256("timelock"), timelock);
        registry.setModuleAddress(communityId, keccak256("membershipToken"), membershipToken);
        registry.setModuleAddress(communityId, keccak256("valuableActionRegistry"), valuableActionRegistry);
        registry.setModuleAddress(communityId, keccak256("claimsManager"), claims);
        registry.setModuleAddress(communityId, keccak256("requestHub"), requestHub);
        registry.setModuleAddress(communityId, keccak256("draftsManager"), draftsManager);
        registry.setModuleAddress(communityId, keccak256("communityToken"), communityToken);
        registry.setModuleAddress(communityId, keccak256("workerSBT"), workerSBT);
        registry.setModuleAddress(communityId, keccak256("verifierPool"), verifierPool);
        registry.setModuleAddress(communityId, keccak256("treasuryAdapter"), treasuryAdapter);
    }
    
    /// @dev Initialize all contracts with proper configurations
    function _initializeContracts(
        uint256 communityId,
        address governor,
        address timelock,
        address membershipToken,
        address valuableActionRegistry,
        address claims,
        address founder,
        GovernanceParams calldata params
    ) private {
        // Set up Governor with multi-choice counting
        ShiftGovernor(payable(governor)).setCountingMulti(countingMultiChoice);
        
        // Configure timelock roles (Governor as proposer, community as executor)
        TimelockController timelockContract = TimelockController(payable(timelock));
        timelockContract.grantRole(timelockContract.PROPOSER_ROLE(), governor);
        timelockContract.revokeRole(timelockContract.PROPOSER_ROLE(), address(this));
        
        // Grant founder initial administrative access (temporary)
        CommunityRegistry(communityRegistry).grantCommunityRole(
            communityId, 
            founder, 
            keccak256("GOVERNANCE_ROLE")
        );
        
        // Add founder to ValuableActionRegistry whitelist for bootstrap
        ValuableActionRegistry(valuableActionRegistry).addFounder(founder, communityId);
        
        // Initialize MembershipToken with authorized minters (Claims and this factory)
        MembershipTokenERC20Votes(membershipToken).initialize(claims, address(this));
    }
    
    /// @dev Bootstrap founder with initial MembershipTokens and ValuableActions
    function _bootstrapFounder(
        uint256 communityId,
        address founder,
        address membershipToken,
        address valuableActionRegistry
    ) private returns (uint256[] memory valuableActionIds) {
        // Mint initial MembershipTokens for founder
        MembershipTokenERC20Votes(membershipToken).mint(
            founder, 
            FOUNDER_INITIAL_TOKENS,
            "Initial founder bootstrap tokens"
        );
        
        valuableActionIds = new uint256[](3);
        
        // Create initial ValuableActions for community bootstrap
        // Note: Using smaller values that fit in uint32 (max ~4.2 billion)
        Types.ValuableAction memory communitySetup = Types.ValuableAction({
            membershipTokenReward: 1000,  // Base amount without ether multiplier
            communityTokenReward: 100,
            investorSBTReward: 0,
            jurorsMin: 1,
            panelSize: 1,
            verifyWindow: uint32(7 days),
            verifierRewardWeight: 10,
            slashVerifierBps: 0,
            cooldownPeriod: 0,
            maxConcurrent: 1,
            revocable: false,
            evidenceTypes: 1, // Text evidence
            proposalThreshold: 0,
            proposer: founder,
            requiresGovernanceApproval: false,
            evidenceSpecCID: "QmFounderSetup",
            titleTemplate: "Community Setup Completion",
            automationRules: new bytes32[](0),
            activationDelay: 0,
            deprecationWarning: uint32(365 days),
            founderVerified: true
        });
        
        Types.ValuableAction memory governanceInit = Types.ValuableAction({
            membershipTokenReward: 2000,
            communityTokenReward: 200,
            investorSBTReward: 0,
            jurorsMin: 1,
            panelSize: 1,
            verifyWindow: uint32(7 days),
            verifierRewardWeight: 20,
            slashVerifierBps: 0,
            cooldownPeriod: 0,
            maxConcurrent: 1,
            revocable: false,
            evidenceTypes: 1,
            proposalThreshold: 0,
            proposer: founder,
            requiresGovernanceApproval: false,
            evidenceSpecCID: "QmGovernanceInit",
            titleTemplate: "Governance Framework Initialization",
            automationRules: new bytes32[](0),
            activationDelay: 0,
            deprecationWarning: uint32(365 days),
            founderVerified: true
        });
        
        Types.ValuableAction memory firstProposal = Types.ValuableAction({
            membershipTokenReward: 500,
            communityTokenReward: 50,
            investorSBTReward: 0,
            jurorsMin: 1,
            panelSize: 1,
            verifyWindow: uint32(7 days),
            verifierRewardWeight: 5,
            slashVerifierBps: 0,
            cooldownPeriod: uint32(1 days),
            maxConcurrent: 5,
            revocable: true,
            evidenceTypes: 3, // Text + Link evidence
            proposalThreshold: 0,
            proposer: founder,
            requiresGovernanceApproval: false,
            evidenceSpecCID: "QmFirstProposal",
            titleTemplate: "First Community Proposal",
            automationRules: new bytes32[](0),
            activationDelay: 0,
            deprecationWarning: uint32(90 days),
            founderVerified: true
        });
        
        // Create these ValuableActions in the registry
        valuableActionIds[0] = ValuableActionRegistry(valuableActionRegistry).proposeValuableAction(
            communityId, communitySetup, "Initial community setup tasks"
        );
        valuableActionIds[1] = ValuableActionRegistry(valuableActionRegistry).proposeValuableAction(
            communityId, governanceInit, "Governance framework initialization"
        );
        valuableActionIds[2] = ValuableActionRegistry(valuableActionRegistry).proposeValuableAction(
            communityId, firstProposal, "First community proposal creation"
        );
        
        return valuableActionIds;
    }
    
    /*//////////////////////////////////////////////////////////////
                              UTILITIES
    //////////////////////////////////////////////////////////////*/
    
    /// @dev Convert uint256 to string
    function _toString(uint256 value) private pure returns (string memory) {
        if (value == 0) return "0";
        
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        
        return string(buffer);
    }
    
    /// @dev Get substring of a string
    function _substring(string calldata str, uint256 start, uint256 length) 
        private pure returns (string memory) {
        bytes calldata strBytes = bytes(str);
        if (start >= strBytes.length) return "";
        
        uint256 end = start + length;
        if (end > strBytes.length) end = strBytes.length;
        
        bytes memory result = new bytes(end - start);
        for (uint256 i = start; i < end; i++) {
            result[i - start] = strBytes[i];
        }
        
        return string(result);
    }
}