// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Errors} from "contracts/libs/Errors.sol";
import {IVerifierManager} from "contracts/core/interfaces/IVerifierManager.sol";

/// @notice Interface for VerifierElection contract
interface IVerifierElection {
    function getEligibleVerifiers(uint256 communityId) external view returns (
        address[] memory eligibleVerifiers,
        uint256[] memory eligiblePowers
    );
    function getVerifierStatus(uint256 communityId, address verifier) external view returns (
        bool isVerifier,
        uint256 power,
        bool isBanned
    );
}

/// @notice Interface for ParamController to get verification parameters
interface IParamController {
    function getBool(uint256 communityId, bytes32 key) external view returns (bool);
    function getUint256(uint256 communityId, bytes32 key) external view returns (uint256);
}

/// @title VerifierManager
/// @notice Manages VPT-based verifier selection and fraud reporting
/// @dev Integrates with VerifierElection and ParamController for community-specific settings
contract VerifierManager is IVerifierManager {
    /// @notice Core contracts
    IVerifierElection public immutable verifierElection;
    IParamController public immutable paramController;
    address public immutable governance;
    address public engagementsContract;
    
    /// @notice Parameter keys for community configuration
    bytes32 public constant USE_VPT_WEIGHTING = keccak256("USE_VPT_WEIGHTING");
    bytes32 public constant MAX_WEIGHT_PER_VERIFIER = keccak256("MAX_WEIGHT_PER_VERIFIER");
    bytes32 public constant VERIFIER_PANEL_SIZE = keccak256("VERIFIER_PANEL_SIZE");
    bytes32 public constant VERIFIER_MIN = keccak256("VERIFIER_MIN");
    
    /// @notice Juror selection tracking
    struct JurorSelection {
        address[] selectedJurors;
        uint256[] selectedPowers;
        uint256 seed;
        uint64 selectedAt;
        bool completed;
    }
    
    mapping(uint256 => JurorSelection) public selections; // engagementId => selection
    
    /// @notice Events
    event JurorsSelected(
        uint256 indexed engagementId,
        uint256 indexed communityId,
        address[] jurors,
        uint256[] powers,
        uint256 seed,
        bool weighted
    );
    event FraudReported(
        uint256 indexed engagementId,
        uint256 indexed communityId,
        address[] offenders,
        string evidenceCID
    );
    event EngagementsContractUpdated(address oldEngagements, address newEngagements);
    
    /// @notice Access control modifiers
    modifier onlyGovernance() {
        if (msg.sender != governance) revert Errors.NotAuthorized(msg.sender);
        _;
    }
    
    modifier onlyEngagements() {
        if (msg.sender != engagementsContract) revert Errors.NotAuthorized(msg.sender);
        _;
    }
    
    /// @notice Constructor
    /// @param _verifierElection VerifierElection contract address
    /// @param _paramController ParamController contract address
    /// @param _governance Governance contract address
    constructor(
        address _verifierElection,
        address _paramController,
        address _governance
    ) {
        if (_verifierElection == address(0)) revert Errors.ZeroAddress();
        if (_paramController == address(0)) revert Errors.ZeroAddress();
        if (_governance == address(0)) revert Errors.ZeroAddress();
        
        verifierElection = IVerifierElection(_verifierElection);
        paramController = IParamController(_paramController);
        governance = _governance;
    }
    
    /// @notice Set engagements contract address
    /// @param _engagementsContract Engagements contract address
    function setEngagementsContract(address _engagementsContract) external onlyGovernance {
        if (_engagementsContract == address(0)) revert Errors.ZeroAddress();
        address oldEngagements = engagementsContract;
        engagementsContract = _engagementsContract;
        emit EngagementsContractUpdated(oldEngagements, _engagementsContract);
    }
    
    /// @notice Select M jurors from N available verifiers using VPT eligibility
    /// @param engagementId Engagement ID requiring verification
    /// @param communityId Community identifier for verifier pool
    /// @param panelSize Total number of jurors to select (N)
    /// @param seed Randomness seed for selection
    /// @param useWeighting Whether to use VPT amounts as weights in selection
    /// @return selectedJurors Array of selected juror addresses
    function selectJurors(
        uint256 engagementId,
        uint256 communityId,
        uint256 panelSize,
        uint256 seed,
        bool useWeighting
    ) external onlyEngagements returns (address[] memory selectedJurors) {
        if (panelSize == 0) revert Errors.InvalidInput("Panel size cannot be zero");
        if (selections[engagementId].completed) {
            revert Errors.InvalidInput("Jurors already selected for engagement");
        }
        
        // Get eligible verifiers from VerifierElection
        (address[] memory eligibleVerifiers, uint256[] memory eligiblePowers) = 
            verifierElection.getEligibleVerifiers(communityId);
        
        if (eligibleVerifiers.length == 0) {
            revert Errors.InsufficientVerifiers(0, panelSize);
        }
        if (panelSize > eligibleVerifiers.length) {
            revert Errors.InsufficientVerifiers(eligibleVerifiers.length, panelSize);
        }
        
        // Check community settings for weighting preference
        bool shouldUseWeighting = useWeighting;
        if (address(paramController) != address(0)) {
            try paramController.getBool(communityId, USE_VPT_WEIGHTING) returns (bool configuredWeighting) {
                shouldUseWeighting = configuredWeighting;
            // solhint-disable-next-line no-empty-blocks
            } catch {
                // Use provided parameter if config retrieval fails
            }
        }
        
        // Perform selection
        uint256[] memory selectedPowers;
        if (shouldUseWeighting) {
            (selectedJurors, selectedPowers) = _weightedSelection(
                eligibleVerifiers, eligiblePowers, panelSize, seed, communityId
            );
        } else {
            (selectedJurors, selectedPowers) = _uniformSelection(
                eligibleVerifiers, eligiblePowers, panelSize, seed
            );
        }
        
        // Store selection
        selections[engagementId] = JurorSelection({
            selectedJurors: selectedJurors,
            selectedPowers: selectedPowers,
            seed: seed,
            selectedAt: uint64(block.timestamp),
            completed: true
        });
        
        emit JurorsSelected(engagementId, communityId, selectedJurors, selectedPowers, seed, shouldUseWeighting);
        return selectedJurors;
    }
    
    /// @notice Weighted selection based on VPT amounts
    function _weightedSelection(
        address[] memory verifiers,
        uint256[] memory powers,
        uint256 panelSize,
        uint256 seed,
        uint256 communityId
    ) internal view returns (address[] memory selected, uint256[] memory selectedPowers) {
        selected = new address[](panelSize);
        selectedPowers = new uint256[](panelSize);
        
        // Get max weight limit from parameters
        uint256 maxWeight = type(uint256).max;
        if (address(paramController) != address(0)) {
            try paramController.getUint256(communityId, MAX_WEIGHT_PER_VERIFIER) returns (uint256 configuredMax) {
                if (configuredMax > 0) maxWeight = configuredMax;
            // solhint-disable-next-line no-empty-blocks
            } catch {
                // Use unlimited weight if config retrieval fails
            }
        }
        
        // Normalize weights and calculate total
        uint256[] memory weights = new uint256[](verifiers.length);
        uint256 totalWeight = 0;
        
        for (uint256 i = 0; i < verifiers.length; i++) {
            // Cap individual weights at maxWeight
            weights[i] = powers[i] > maxWeight ? maxWeight : powers[i];
            if (weights[i] == 0) weights[i] = 1; // Minimum weight
            totalWeight += weights[i];
        }
        
        // Select without replacement
        bool[] memory used = new bool[](verifiers.length);
        
        for (uint256 j = 0; j < panelSize; j++) {
            uint256 randomValue = uint256(keccak256(abi.encode(seed, j, "weighted"))) % totalWeight;
            uint256 currentWeight = 0;
            
            for (uint256 k = 0; k < verifiers.length; k++) {
                if (used[k]) continue;
                
                currentWeight += weights[k];
                if (randomValue < currentWeight) {
                    selected[j] = verifiers[k];
                    selectedPowers[j] = powers[k];
                    used[k] = true;
                    totalWeight -= weights[k];
                    break;
                }
            }
        }
        
        return (selected, selectedPowers);
    }
    
    /// @notice Uniform selection (all verifiers have equal probability)
    function _uniformSelection(
        address[] memory verifiers,
        uint256[] memory powers,
        uint256 panelSize,
        uint256 seed
    ) internal pure returns (address[] memory selected, uint256[] memory selectedPowers) {
        selected = new address[](panelSize);
        selectedPowers = new uint256[](panelSize);
        
        // Create array of available indices
        uint256[] memory availableIndices = new uint256[](verifiers.length);
        for (uint256 i = 0; i < verifiers.length; i++) {
            availableIndices[i] = i;
        }
        
        uint256 remaining = verifiers.length;
        
        for (uint256 j = 0; j < panelSize; j++) {
            // Select random index from remaining
            uint256 randomIndex = uint256(keccak256(abi.encode(seed, j, "uniform"))) % remaining;
            uint256 selectedIndex = availableIndices[randomIndex];
            
            selected[j] = verifiers[selectedIndex];
            selectedPowers[j] = powers[selectedIndex];
            
            // Remove selected index by swapping with last
            availableIndices[randomIndex] = availableIndices[remaining - 1];
            remaining--;
        }
        
        return (selected, selectedPowers);
    }
    
    /// @notice Report fraud and initiate governance process for banning
    /// @dev This replaces the old bond slashing mechanism
    /// @param engagementId Engagement ID where fraud was detected
    /// @param communityId Community identifier
    /// @param offenders Array of juror addresses that voted incorrectly
    /// @param evidenceCID IPFS hash with fraud evidence
    function reportFraud(
        uint256 engagementId,
        uint256 communityId,
        address[] calldata offenders,
        string calldata evidenceCID
    ) external onlyEngagements {
        if (offenders.length == 0) revert Errors.InvalidInput("No offenders provided");
        if (!selections[engagementId].completed) {
            revert Errors.InvalidInput("No jury selection for engagement");
        }
        
        // Validate offenders were actually selected as jurors
        address[] memory selectedJurors = selections[engagementId].selectedJurors;
        for (uint256 i = 0; i < offenders.length; i++) {
            bool wasSelected = false;
            for (uint256 j = 0; j < selectedJurors.length; j++) {
                if (offenders[i] == selectedJurors[j]) {
                    wasSelected = true;
                    break;
                }
            }
            if (!wasSelected) {
                revert Errors.InvalidInput("Offender was not selected as juror");
            }
        }
        
        emit FraudReported(engagementId, communityId, offenders, evidenceCID);
        
        // NOTE: In the old system, this would slash bonds immediately.
        // In the new VPT system, fraud reports trigger governance proposals
        // to ban verifiers via VerifierElection.banVerifiers()
        // The governance process ensures due process before punishment.
    }
    
    /// @notice Check if address has verifier power for community
    /// @param verifier Address to check
    /// @param communityId Community identifier
    /// @return True if verifier has power > 0 and is not banned
    function hasVerifierPower(address verifier, uint256 communityId) external view returns (bool) {
        (bool isVerifier, , bool isBanned) = verifierElection.getVerifierStatus(communityId, verifier);
        return isVerifier && !isBanned;
    }
    
    /// @notice Get eligible verifier count for a community
    /// @param communityId Community identifier
    /// @return Number of eligible verifiers (power > 0, not banned)
    function getEligibleVerifierCount(uint256 communityId) external view returns (uint256) {
        (address[] memory eligibleVerifiers, ) = verifierElection.getEligibleVerifiers(communityId);
        return eligibleVerifiers.length;
    }
    
    /// @notice Get verifier power amount
    /// @param verifier Address to check
    /// @param communityId Community identifier
    /// @return power Amount of verifier power tokens
    function getVerifierPower(address verifier, uint256 communityId) external view returns (uint256 power) {
        (, power, ) = verifierElection.getVerifierStatus(communityId, verifier);
        return power;
    }
    
    /// @notice Get juror selection details
    /// @param engagementId Engagement ID
    /// @return selection JurorSelection struct
    function getJurorSelection(uint256 engagementId) external view returns (JurorSelection memory selection) {
        return selections[engagementId];
    }
    
    /// @notice Get selected jurors for an engagement
    /// @param engagementId Engagement ID
    /// @return jurors Array of selected juror addresses
    /// @return powers Array of corresponding verifier powers
    function getSelectedJurors(uint256 engagementId) external view returns (
        address[] memory jurors,
        uint256[] memory powers
    ) {
        JurorSelection memory selection = selections[engagementId];
        return (selection.selectedJurors, selection.selectedPowers);
    }
}