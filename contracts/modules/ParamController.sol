// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Errors} from "contracts/libs/Errors.sol";
import {ICommunityRegistry} from "contracts/modules/interfaces/ICommunityRegistry.sol";

/// @title ParamController
/// @notice Manages community parameters including verification settings and fee schedules
/// @dev Provides governance-controlled parameter management for community-specific configurations
contract ParamController {
    /// @notice Fee period structure for time-based fee changes
    struct FeePeriod { 
        uint64 start; 
        uint64 end; 
        uint32 bps; 
    }
    
    /// @notice Community registry reference (set once post-deploy)
    ICommunityRegistry public communityRegistry;

    /// @notice System admin allowed to wire the registry one-time
    address public immutable systemAdmin;

    /// @notice Tracks whether registry has been wired
    bool public registrySet;
    
    /// @notice Fee schedule storage
    mapping(uint256 => FeePeriod[]) internal _periods;
    
    /// @notice Parameter storage by community and key
    mapping(uint256 => mapping(bytes32 => uint256)) public uintParams;
    mapping(uint256 => mapping(bytes32 => bool)) public boolParams;
    mapping(uint256 => mapping(bytes32 => address[])) public addressArrayParams;
    
    /// @notice Parameter keys for governance system
    bytes32 public constant DEBATE_WINDOW = keccak256("DEBATE_WINDOW");
    bytes32 public constant VOTE_WINDOW = keccak256("VOTE_WINDOW");
    bytes32 public constant EXECUTION_DELAY = keccak256("EXECUTION_DELAY");
    
    /// @notice Parameter keys for eligibility rules
    bytes32 public constant MIN_SENIORITY = keccak256("MIN_SENIORITY");
    bytes32 public constant MIN_SBTS = keccak256("MIN_SBTS");
    bytes32 public constant PROPOSAL_THRESHOLD = keccak256("PROPOSAL_THRESHOLD");
    
    /// @notice Parameter keys for economic system
    bytes32 public constant MIN_TREASURY_BPS = keccak256("MIN_TREASURY_BPS");
    bytes32 public constant MIN_POSITIONS_BPS = keccak256("MIN_POSITIONS_BPS");
    bytes32 public constant SPILLOVER_TARGET = keccak256("SPILLOVER_TARGET");
    bytes32 public constant SPILLOVER_SPLIT_BPS_TREASURY = keccak256("SPILLOVER_SPLIT_BPS_TREASURY");
    bytes32 public constant FEE_ON_WITHDRAW = keccak256("FEE_ON_WITHDRAW");
    bytes32 public constant BACKING_ASSETS = keccak256("BACKING_ASSETS");
    
    /// @notice Parameter keys for cohort system
    bytes32 public constant MAX_INVESTOR_COHORTS_ACTIVE = keccak256("MAX_INVESTOR_COHORTS_ACTIVE");
    bytes32 public constant COHORT_PRIORITY_SCHEME = keccak256("COHORT_PRIORITY_SCHEME");
    
    /// @notice Parameter keys for verifier system
    bytes32 public constant VERIFIER_PANEL_SIZE = keccak256("VERIFIER_PANEL_SIZE");
    bytes32 public constant VERIFIER_MIN = keccak256("VERIFIER_MIN");
    bytes32 public constant MAX_PANELS_PER_EPOCH = keccak256("MAX_PANELS_PER_EPOCH");
    bytes32 public constant USE_VPT_WEIGHTING = keccak256("USE_VPT_WEIGHTING");
    bytes32 public constant MAX_WEIGHT_PER_VERIFIER = keccak256("MAX_WEIGHT_PER_VERIFIER");
    bytes32 public constant COOLDOWN_AFTER_FRAUD = keccak256("COOLDOWN_AFTER_FRAUD");
    
    /// @notice Events
    event FeeScheduled(uint256 indexed communityId, FeePeriod p);
    event UintParamSet(uint256 indexed communityId, bytes32 indexed key, uint256 value);
    event BoolParamSet(uint256 indexed communityId, bytes32 indexed key, bool value);
    event AddressArrayParamSet(uint256 indexed communityId, bytes32 indexed key, address[] value);
    event CommunityRegistrySet(address registry);
    
    /// @notice Constructor
    /// @param _systemAdmin Address allowed to set the registry once
    constructor(address _systemAdmin) {
        if (_systemAdmin == address(0)) revert Errors.ZeroAddress();
        systemAdmin = _systemAdmin;
    }

    /// @notice Set the community registry (one-time wiring)
    /// @param registry CommunityRegistry address
    function setCommunityRegistry(address registry) external {
        if (msg.sender != systemAdmin) revert Errors.NotAuthorized(msg.sender);
        if (registry == address(0)) revert Errors.ZeroAddress();
        if (registrySet) revert Errors.InvalidInput("Registry already set");

        communityRegistry = ICommunityRegistry(registry);
        registrySet = true;
        emit CommunityRegistrySet(registry);
    }

    /// @notice Restrict writes to the community timelock or bootstrap admin when timelock is unset
    modifier onlyAuthorized(uint256 communityId) {
        if (!registrySet) revert Errors.InvalidInput("Registry not set");
        address timelock = communityRegistry.getTimelock(communityId);

        if (timelock == address(0)) {
            // Bootstrap path: community admin before timelock is wired
            if (!communityRegistry.communityAdmins(communityId, msg.sender)) {
                revert Errors.NotAuthorized(msg.sender);
            }
        } else {
            if (msg.sender != timelock) revert Errors.NotAuthorized(msg.sender);
        }
        _;
    }

    /// @notice Restrict to the registry for initialization helpers
    modifier onlyCommunityRegistry() {
        if (msg.sender != address(communityRegistry)) revert Errors.NotAuthorized(msg.sender);
        _;
    }
    
    /// @notice Schedule a fee change for a community
    /// @param communityId Community identifier
    /// @param p Fee period configuration
    function scheduleFeeChange(uint256 communityId, FeePeriod calldata p) external onlyAuthorized(communityId) {
        if (p.start >= p.end) revert Errors.InvalidInput("Invalid time period");
        if (p.bps > 10000) revert Errors.InvalidInput("Fee too high");
        
        _periods[communityId].push(p);
        emit FeeScheduled(communityId, p);
    }
    
    /// @notice Get current fee basis points for a community
    /// @param communityId Community identifier
    /// @return Current fee in basis points
    function currentFeeBps(uint256 communityId) external view returns (uint32) {
        uint64 ts = uint64(block.timestamp);
        FeePeriod[] storage arr = _periods[communityId];
        
        for (uint256 i = 0; i < arr.length; i++) {
            if (ts >= arr[i].start && ts <= arr[i].end) {
                return arr[i].bps;
            }
        }
        return 0;
    }
    
    /// @notice Set uint256 parameter for a community
    /// @param communityId Community identifier
    /// @param key Parameter key
    /// @param value Parameter value
    function setUint256(uint256 communityId, bytes32 key, uint256 value) external onlyAuthorized(communityId) {
        uintParams[communityId][key] = value;
        emit UintParamSet(communityId, key, value);
    }
    
    /// @notice Set bool parameter for a community
    /// @param communityId Community identifier
    /// @param key Parameter key
    /// @param value Parameter value
    function setBool(uint256 communityId, bytes32 key, bool value) external onlyAuthorized(communityId) {
        boolParams[communityId][key] = value;
        emit BoolParamSet(communityId, key, value);
    }
    
    /// @notice Get uint256 parameter for a community
    /// @param communityId Community identifier
    /// @param key Parameter key
    /// @return Parameter value (0 if not set)
    function getUint256(uint256 communityId, bytes32 key) external view returns (uint256) {
        return uintParams[communityId][key];
    }
    
    /// @notice Get bool parameter for a community
    /// @param communityId Community identifier
    /// @param key Parameter key
    /// @return Parameter value (false if not set)
    function getBool(uint256 communityId, bytes32 key) external view returns (bool) {
        return boolParams[communityId][key];
    }
    
    /// @notice Set address array parameter for a community
    /// @param communityId Community identifier
    /// @param key Parameter key
    /// @param value Parameter value
    function setAddressArray(uint256 communityId, bytes32 key, address[] calldata value) external onlyAuthorized(communityId) {
        addressArrayParams[communityId][key] = value;
        emit AddressArrayParamSet(communityId, key, value);
    }
    
    /// @notice Get address array parameter for a community
    /// @param communityId Community identifier
    /// @param key Parameter key
    /// @return Parameter value (empty array if not set)
    function getAddressArray(uint256 communityId, bytes32 key) external view returns (address[] memory) {
        return addressArrayParams[communityId][key];
    }
    
    /// @notice Set multiple verifier parameters at once
    /// @param communityId Community identifier
    /// @param verifierPanelSize Number of verifiers to select for panels
    /// @param verifierMin Minimum approvals needed from panel
    /// @param maxPanelsPerEpoch Maximum concurrent verification panels
    /// @param useVPTWeighting Whether to use VPT amounts as selection weights
    /// @param maxWeightPerVerifier Maximum weight any single verifier can have
    /// @param cooldownAfterFraud Cooldown period after fraud detection (seconds)
    function setVerifierParams(
        uint256 communityId,
        uint256 verifierPanelSize,
        uint256 verifierMin,
        uint256 maxPanelsPerEpoch,
        bool useVPTWeighting,
        uint256 maxWeightPerVerifier,
        uint256 cooldownAfterFraud
    ) external onlyAuthorized(communityId) {
        if (verifierMin > verifierPanelSize) revert Errors.InvalidInput("Min cannot exceed panel size");
        if (verifierPanelSize == 0) revert Errors.InvalidInput("Panel size cannot be zero");
        
        uintParams[communityId][VERIFIER_PANEL_SIZE] = verifierPanelSize;
        uintParams[communityId][VERIFIER_MIN] = verifierMin;
        uintParams[communityId][MAX_PANELS_PER_EPOCH] = maxPanelsPerEpoch;
        uintParams[communityId][MAX_WEIGHT_PER_VERIFIER] = maxWeightPerVerifier;
        uintParams[communityId][COOLDOWN_AFTER_FRAUD] = cooldownAfterFraud;
        boolParams[communityId][USE_VPT_WEIGHTING] = useVPTWeighting;
        
        emit UintParamSet(communityId, VERIFIER_PANEL_SIZE, verifierPanelSize);
        emit UintParamSet(communityId, VERIFIER_MIN, verifierMin);
        emit UintParamSet(communityId, MAX_PANELS_PER_EPOCH, maxPanelsPerEpoch);
        emit UintParamSet(communityId, MAX_WEIGHT_PER_VERIFIER, maxWeightPerVerifier);
        emit UintParamSet(communityId, COOLDOWN_AFTER_FRAUD, cooldownAfterFraud);
        emit BoolParamSet(communityId, USE_VPT_WEIGHTING, useVPTWeighting);
    }
    
    /// @notice Get all verifier parameters for a community
    /// @param communityId Community identifier
    /// @return verifierPanelSize Number of verifiers to select for panels
    /// @return verifierMin Minimum approvals needed from panel
    /// @return maxPanelsPerEpoch Maximum concurrent verification panels
    /// @return useVPTWeighting Whether to use VPT amounts as selection weights
    /// @return maxWeightPerVerifier Maximum weight any single verifier can have
    /// @return cooldownAfterFraud Cooldown period after fraud detection (seconds)
    function getVerifierParams(uint256 communityId) external view returns (
        uint256 verifierPanelSize,
        uint256 verifierMin,
        uint256 maxPanelsPerEpoch,
        bool useVPTWeighting,
        uint256 maxWeightPerVerifier,
        uint256 cooldownAfterFraud
    ) {
        verifierPanelSize = uintParams[communityId][VERIFIER_PANEL_SIZE];
        verifierMin = uintParams[communityId][VERIFIER_MIN];
        maxPanelsPerEpoch = uintParams[communityId][MAX_PANELS_PER_EPOCH];
        useVPTWeighting = boolParams[communityId][USE_VPT_WEIGHTING];
        maxWeightPerVerifier = uintParams[communityId][MAX_WEIGHT_PER_VERIFIER];
        cooldownAfterFraud = uintParams[communityId][COOLDOWN_AFTER_FRAUD];
    }
    
    /// @notice Set governance parameters for a community
    /// @param communityId Community identifier
    /// @param debateWindow Time for proposal debate (seconds)
    /// @param voteWindow Time for voting (seconds)
    /// @param executionDelay Time before execution (seconds)
    function setGovernanceParams(
        uint256 communityId,
        uint256 debateWindow,
        uint256 voteWindow,
        uint256 executionDelay
    ) external onlyAuthorized(communityId) {
        uintParams[communityId][DEBATE_WINDOW] = debateWindow;
        uintParams[communityId][VOTE_WINDOW] = voteWindow;
        uintParams[communityId][EXECUTION_DELAY] = executionDelay;
        
        emit UintParamSet(communityId, DEBATE_WINDOW, debateWindow);
        emit UintParamSet(communityId, VOTE_WINDOW, voteWindow);
        emit UintParamSet(communityId, EXECUTION_DELAY, executionDelay);
    }
    
    /// @notice Get governance parameters for a community
    /// @param communityId Community identifier
    /// @return debateWindow Time for proposal debate (seconds)
    /// @return voteWindow Time for voting (seconds)
    /// @return executionDelay Time before execution (seconds)
    function getGovernanceParams(uint256 communityId) external view returns (
        uint256 debateWindow,
        uint256 voteWindow,
        uint256 executionDelay
    ) {
        debateWindow = uintParams[communityId][DEBATE_WINDOW];
        voteWindow = uintParams[communityId][VOTE_WINDOW];
        executionDelay = uintParams[communityId][EXECUTION_DELAY];
    }
    
    /// @notice Set eligibility parameters for a community
    /// @param communityId Community identifier
    /// @param minSeniority Minimum account age to participate (seconds)
    /// @param minSBTs Minimum SBT count to participate
    /// @param proposalThreshold Minimum tokens to create proposal
    function setEligibilityParams(
        uint256 communityId,
        uint256 minSeniority,
        uint256 minSBTs,
        uint256 proposalThreshold
    ) external onlyAuthorized(communityId) {
        uintParams[communityId][MIN_SENIORITY] = minSeniority;
        uintParams[communityId][MIN_SBTS] = minSBTs;
        uintParams[communityId][PROPOSAL_THRESHOLD] = proposalThreshold;
        
        emit UintParamSet(communityId, MIN_SENIORITY, minSeniority);
        emit UintParamSet(communityId, MIN_SBTS, minSBTs);
        emit UintParamSet(communityId, PROPOSAL_THRESHOLD, proposalThreshold);
    }
    
    /// @notice Get eligibility parameters for a community
    /// @param communityId Community identifier
    /// @return minSeniority Minimum account age to participate (seconds)
    /// @return minSBTs Minimum SBT count to participate
    /// @return proposalThreshold Minimum tokens to create proposal
    function getEligibilityParams(uint256 communityId) external view returns (
        uint256 minSeniority,
        uint256 minSBTs,
        uint256 proposalThreshold
    ) {
        minSeniority = uintParams[communityId][MIN_SENIORITY];
        minSBTs = uintParams[communityId][MIN_SBTS];
        proposalThreshold = uintParams[communityId][PROPOSAL_THRESHOLD];
    }
    

    

    
    /// @notice Set revenue policy parameters for distribution
    /// @param communityId Community identifier
    /// @param minTreasuryBps Minimum share for treasury (bps)
    /// @param minPositionsBps Minimum share for positions (bps)
    /// @param spilloverTarget 0 = positions, 1 = treasury, 2 = split
    /// @param spilloverSplitBpsToTreasury Treasury share when target = split (bps)
    function setRevenuePolicy(
        uint256 communityId,
        uint16 minTreasuryBps,
        uint16 minPositionsBps,
        uint8 spilloverTarget,
        uint16 spilloverSplitBpsToTreasury
    ) external onlyAuthorized(communityId) {
        if (minTreasuryBps + minPositionsBps > 10000) {
            revert Errors.InvalidInput("Guarantees exceed 100%");
        }
        if (spilloverTarget > 2) {
            revert Errors.InvalidInput("Invalid spillover target");
        }
        if (spilloverTarget == 2 && spilloverSplitBpsToTreasury > 10000) {
            revert Errors.InvalidInput("Split bps > 100%");
        }

        uintParams[communityId][MIN_TREASURY_BPS] = minTreasuryBps;
        uintParams[communityId][MIN_POSITIONS_BPS] = minPositionsBps;
        uintParams[communityId][SPILLOVER_TARGET] = spilloverTarget;
        uintParams[communityId][SPILLOVER_SPLIT_BPS_TREASURY] = spilloverSplitBpsToTreasury;

        emit UintParamSet(communityId, MIN_TREASURY_BPS, minTreasuryBps);
        emit UintParamSet(communityId, MIN_POSITIONS_BPS, minPositionsBps);
        emit UintParamSet(communityId, SPILLOVER_TARGET, spilloverTarget);
        emit UintParamSet(communityId, SPILLOVER_SPLIT_BPS_TREASURY, spilloverSplitBpsToTreasury);
    }

    /// @notice Get revenue policy parameters
    /// @param communityId Community identifier
    /// @return minTreasuryBps Minimum treasury share (bps)
    /// @return minPositionsBps Minimum positions share (bps)
    /// @return spilloverTarget Spillover target (0=positions,1=treasury,2=split)
    /// @return spilloverSplitBpsToTreasury Treasury share when split
    function getRevenuePolicy(uint256 communityId) external view returns (
        uint16 minTreasuryBps,
        uint16 minPositionsBps,
        uint8 spilloverTarget,
        uint16 spilloverSplitBpsToTreasury
    ) {
        minTreasuryBps = uint16(uintParams[communityId][MIN_TREASURY_BPS]);
        minPositionsBps = uint16(uintParams[communityId][MIN_POSITIONS_BPS]);
        spilloverTarget = uint8(uintParams[communityId][SPILLOVER_TARGET]);
        spilloverSplitBpsToTreasury = uint16(uintParams[communityId][SPILLOVER_SPLIT_BPS_TREASURY]);
    }
    
    /// @notice Set cohort system parameters
    /// @param communityId Community identifier
    /// @param maxActiveCohortsLimit Maximum number of active investment cohorts
    /// @param priorityScheme 0 = ProRataByUnrecovered, 1 = ProRataByUnrecoveredWeighted
    function setCohortParams(
        uint256 communityId,
        uint256 maxActiveCohortsLimit,
        uint8 priorityScheme
    ) external onlyAuthorized(communityId) {
        if (maxActiveCohortsLimit == 0) {
            revert Errors.InvalidInput("Max cohorts must be greater than 0");
        }
        if (priorityScheme > 1) {
            revert Errors.InvalidInput("Priority scheme must be 0 or 1");
        }
        
        uintParams[communityId][MAX_INVESTOR_COHORTS_ACTIVE] = maxActiveCohortsLimit;
        uintParams[communityId][COHORT_PRIORITY_SCHEME] = priorityScheme;
        
        emit UintParamSet(communityId, MAX_INVESTOR_COHORTS_ACTIVE, maxActiveCohortsLimit);
        emit UintParamSet(communityId, COHORT_PRIORITY_SCHEME, priorityScheme);
    }
    
    /// @notice Get cohort system parameters
    /// @param communityId Community identifier
    /// @return maxActiveCohorts Maximum number of active investment cohorts
    /// @return priorityScheme 0 = ProRataByUnrecovered, 1 = ProRataByUnrecoveredWeighted
    function getCohortParams(uint256 communityId) external view returns (
        uint256 maxActiveCohorts,
        uint8 priorityScheme
    ) {
        maxActiveCohorts = uintParams[communityId][MAX_INVESTOR_COHORTS_ACTIVE];
        priorityScheme = uint8(uintParams[communityId][COHORT_PRIORITY_SCHEME]);
    }
    
    /// @notice Initialize default parameters during community bootstrap (registry-only)
    /// @param communityId Community identifier
    /// @param deployerAdmin Expected community admin performing bootstrap
    function initializeDefaultParameters(uint256 communityId, address deployerAdmin) external onlyCommunityRegistry {
        address timelock = communityRegistry.getTimelock(communityId);
        if (timelock != address(0)) revert Errors.InvalidInput("Timelock already set");
        if (!communityRegistry.communityAdmins(communityId, deployerAdmin)) revert Errors.NotAuthorized(deployerAdmin);

        // Set default governance parameters (7 day debate, 3 day vote, 2 day execution delay)
        uintParams[communityId][DEBATE_WINDOW] = 7 days;
        uintParams[communityId][VOTE_WINDOW] = 3 days;
        uintParams[communityId][EXECUTION_DELAY] = 2 days;

        emit UintParamSet(communityId, DEBATE_WINDOW, 7 days);
        emit UintParamSet(communityId, VOTE_WINDOW, 3 days);
        emit UintParamSet(communityId, EXECUTION_DELAY, 2 days);

        // Default eligibility rules (no restrictions by default)
        uintParams[communityId][MIN_SENIORITY] = 0;
        uintParams[communityId][MIN_SBTS] = 0;
        uintParams[communityId][PROPOSAL_THRESHOLD] = 1e18;

        emit UintParamSet(communityId, MIN_SENIORITY, 0);
        emit UintParamSet(communityId, MIN_SBTS, 0);
        emit UintParamSet(communityId, PROPOSAL_THRESHOLD, 1e18);

        // Default revenue policy (25% treasury, 25% positions, spillover to treasury)
        uintParams[communityId][MIN_TREASURY_BPS] = 2500;
        uintParams[communityId][MIN_POSITIONS_BPS] = 2500;
        uintParams[communityId][SPILLOVER_TARGET] = 1; // treasury
        uintParams[communityId][SPILLOVER_SPLIT_BPS_TREASURY] = 0;

        emit UintParamSet(communityId, MIN_TREASURY_BPS, 2500);
        emit UintParamSet(communityId, MIN_POSITIONS_BPS, 2500);
        emit UintParamSet(communityId, SPILLOVER_TARGET, 1);
        emit UintParamSet(communityId, SPILLOVER_SPLIT_BPS_TREASURY, 0);

        // Default backing assets empty
        address[] memory emptyAssets = new address[](0);
        addressArrayParams[communityId][BACKING_ASSETS] = emptyAssets;
        emit AddressArrayParamSet(communityId, BACKING_ASSETS, emptyAssets);
    }
}
