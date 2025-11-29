// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Errors} from "contracts/libs/Errors.sol";

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
    
    /// @notice Governance address
    address public governance;
    
    /// @notice Fee schedule storage
    mapping(uint256 => FeePeriod[]) internal _periods;
    
    /// @notice Parameter storage by community and key
    mapping(uint256 => mapping(bytes32 => uint256)) public uintParams;
    mapping(uint256 => mapping(bytes32 => bool)) public boolParams;
    
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
    event GovernanceUpdated(address oldGov, address newGov);
    
    /// @notice Access control modifier
    modifier onlyGovernance() {
        if (msg.sender != governance) revert Errors.NotAuthorized(msg.sender);
        _;
    }
    
    /// @notice Constructor
    /// @param _governance Governance contract address
    constructor(address _governance) {
        if (_governance == address(0)) revert Errors.ZeroAddress();
        governance = _governance;
        emit GovernanceUpdated(address(0), _governance);
    }
    
    /// @notice Schedule a fee change for a community
    /// @param communityId Community identifier
    /// @param p Fee period configuration
    function scheduleFeeChange(uint256 communityId, FeePeriod calldata p) external onlyGovernance {
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
    function setUint256(uint256 communityId, bytes32 key, uint256 value) external onlyGovernance {
        uintParams[communityId][key] = value;
        emit UintParamSet(communityId, key, value);
    }
    
    /// @notice Set bool parameter for a community
    /// @param communityId Community identifier
    /// @param key Parameter key
    /// @param value Parameter value
    function setBool(uint256 communityId, bytes32 key, bool value) external onlyGovernance {
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
    ) external onlyGovernance {
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
    
    /// @notice Update governance address
    /// @param _governance New governance address
    function updateGovernance(address _governance) external onlyGovernance {
        if (_governance == address(0)) revert Errors.ZeroAddress();
        address oldGov = governance;
        governance = _governance;
        emit GovernanceUpdated(oldGov, _governance);
    }
}
