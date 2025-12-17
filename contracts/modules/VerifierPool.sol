// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Errors} from "contracts/libs/Errors.sol";
import {Types} from "contracts/libs/Types.sol";

/// @title VerifierPool
/// @notice Manages verifier registration, bonding, and M-of-N juror selection for claims verification
/// @dev Provides pseudo-random juror selection with reputation tracking and economic incentives
contract VerifierPool {
    /// @notice Verifier information structure
    struct Verifier {
        bool active;                    // Whether verifier is active
        uint256 bondAmount;            // Amount bonded by verifier
        uint256 reputation;            // Reputation score (0-10000 basis points)
        uint256 totalVerifications;   // Total claims verified
        uint256 successfulVerifications; // Successful verifications (not slashed)
        uint64 registeredAt;          // Registration timestamp
        uint64 lastActiveAt;          // Last activity timestamp
    }

    /// @notice Juror selection result for a claim
    struct JurorSelection {
        address[] selectedJurors;     // Selected juror addresses
        uint256 seed;                // Randomness seed used
        uint64 selectedAt;           // Selection timestamp
        bool completed;              // Whether selection is complete
    }

    // State variables
    address public governance;
    address public claimsContract;
    
    uint256 public minimumBond = 100e18;        // Minimum bond required (100 tokens)
    uint256 public baseReputation = 5000;       // Starting reputation (50%)
    uint256 public maxReputation = 10000;       // Maximum reputation (100%)
    uint256 public reputationDecay = 50;        // Reputation decay per failed verification (0.5%)
    uint256 public reputationReward = 25;       // Reputation reward per successful verification (0.25%)
    
    // Mappings
    mapping(address => Verifier) public verifiers;
    mapping(address => bool) public isVerifier;
    mapping(uint256 => JurorSelection) public selections; // claimId => selection
    
    // Arrays for efficient selection
    address[] public activeVerifiers;
    mapping(address => uint256) public verifierIndex; // address => index in activeVerifiers array
    
    // Events
    event VerifierRegistered(address indexed verifier, uint256 bondAmount);
    event VerifierDeactivated(address indexed verifier, string reason);
    event BondIncreased(address indexed verifier, uint256 oldAmount, uint256 newAmount);
    event BondWithdrawn(address indexed verifier, uint256 amount);
    event JurorsSelected(uint256 indexed claimId, address[] jurors, uint256 seed);
    event ReputationUpdated(address indexed verifier, uint256 oldReputation, uint256 newReputation);
    event ParametersUpdated(uint256 minimumBond, uint256 baseReputation);
    event GovernanceUpdated(address indexed oldGov, address indexed newGov);
    event ClaimsContractUpdated(address indexed oldClaims, address indexed newClaims);

    // Modifiers
    modifier onlyGovernance() {
        if (msg.sender != governance) revert Errors.NotAuthorized(msg.sender);
        _;
    }

    modifier onlyClaims() {
        if (msg.sender != claimsContract) revert Errors.NotAuthorized(msg.sender);
        _;
    }

    /// @notice Constructor
    /// @param _governance Governance contract address
    constructor(address _governance) {
        if (_governance == address(0)) revert Errors.ZeroAddress();
        governance = _governance;
        emit GovernanceUpdated(address(0), _governance);
    }

    /// @notice Register as a verifier with bond
    /// @dev Requires minimum bond amount, assigns base reputation
    function registerVerifier() external payable {
        if (msg.value < minimumBond) {
            revert Errors.InvalidInput("Insufficient bond amount");
        }
        if (isVerifier[msg.sender]) {
            revert Errors.InvalidInput("Already registered");
        }

        // Create verifier record
        verifiers[msg.sender] = Verifier({
            active: true,
            bondAmount: msg.value,
            reputation: baseReputation,
            totalVerifications: 0,
            successfulVerifications: 0,
            registeredAt: uint64(block.timestamp),
            lastActiveAt: uint64(block.timestamp)
        });

        // Add to active verifiers list
        isVerifier[msg.sender] = true;
        verifierIndex[msg.sender] = activeVerifiers.length;
        activeVerifiers.push(msg.sender);

        emit VerifierRegistered(msg.sender, msg.value);
    }

    /// @notice Increase bond amount
    /// @dev Allows verifiers to increase their bond for better selection odds
    function increaseBond() external payable {
        if (!isVerifier[msg.sender]) {
            revert Errors.InvalidInput("Not a registered verifier");
        }
        if (msg.value == 0) {
            revert Errors.InvalidInput("No bond provided");
        }

        Verifier storage verifier = verifiers[msg.sender];
        if (!verifier.active) {
            revert Errors.InvalidInput("Verifier not active");
        }

        uint256 oldBond = verifier.bondAmount;
        verifier.bondAmount += msg.value;
        verifier.lastActiveAt = uint64(block.timestamp);

        emit BondIncreased(msg.sender, oldBond, verifier.bondAmount);
    }

    /// @notice Deactivate verifier and withdraw bond
    /// @dev Allows verifiers to exit the pool, governance can force deactivation
    /// @param verifierAddr Address of verifier to deactivate (use msg.sender for self)
    /// @param reason Reason for deactivation
    function deactivateVerifier(address verifierAddr, string calldata reason) external {
        // Self-deactivation or governance action
        if (msg.sender != verifierAddr && msg.sender != governance) {
            revert Errors.NotAuthorized(msg.sender);
        }
        if (!isVerifier[verifierAddr]) {
            revert Errors.InvalidInput("Not a registered verifier");
        }

        Verifier storage verifier = verifiers[verifierAddr];
        if (!verifier.active) {
            revert Errors.InvalidInput("Already deactivated");
        }

        // Deactivate
        verifier.active = false;
        isVerifier[verifierAddr] = false;

        // Remove from active list (swap with last element)
        uint256 index = verifierIndex[verifierAddr];
        uint256 lastIndex = activeVerifiers.length - 1;
        
        if (index != lastIndex) {
            address lastVerifier = activeVerifiers[lastIndex];
            activeVerifiers[index] = lastVerifier;
            verifierIndex[lastVerifier] = index;
        }
        
        activeVerifiers.pop();
        delete verifierIndex[verifierAddr];

        // Withdraw bond
        uint256 bondAmount = verifier.bondAmount;
        verifier.bondAmount = 0;
        
        (bool success, ) = payable(verifierAddr).call{value: bondAmount}("");
        if (!success) revert Errors.TransferFailed(address(this), verifierAddr, bondAmount);

        emit VerifierDeactivated(verifierAddr, reason);
        emit BondWithdrawn(verifierAddr, bondAmount);
    }

    /// @notice Select M jurors from N available verifiers for a claim
    /// @param claimId Claim ID requiring verification
    /// @param panelSize Total number of jurors to select (N)
    /// @param seed Randomness seed for selection
    /// @return selectedJurors Array of selected juror addresses
    function selectJurors(
        uint256 claimId, 
        uint256 panelSize,
        uint256 seed
    ) external onlyClaims returns (address[] memory selectedJurors) {
        if (panelSize == 0) revert Errors.InvalidInput("Panel size cannot be zero");
        if (panelSize > activeVerifiers.length) {
            revert Errors.InsufficientVerifiers(activeVerifiers.length, panelSize);
        }
        if (selections[claimId].completed) {
            revert Errors.InvalidInput("Jurors already selected for claim");
        }

        // Use pseudo-random weighted selection
        selectedJurors = _weightedRandomSelection(panelSize, seed);
        
        // Update verifier activity timestamps
        for (uint256 i = 0; i < selectedJurors.length; i++) {
            verifiers[selectedJurors[i]].lastActiveAt = uint64(block.timestamp);
        }

        // Store selection
        selections[claimId] = JurorSelection({
            selectedJurors: selectedJurors,
            seed: seed,
            selectedAt: uint64(block.timestamp),
            completed: true
        });

        emit JurorsSelected(claimId, selectedJurors, seed);
        return selectedJurors;
    }

    /// @notice Update verifier reputation after claim resolution
    /// @param claimId Claim ID that was verified
    /// @param jurors Array of juror addresses
    /// @param successful Array indicating which jurors voted correctly
    function updateReputations(
        uint256 claimId,
        address[] calldata jurors,
        bool[] calldata successful
    ) external onlyClaims {
        if (jurors.length != successful.length) {
            revert Errors.InvalidInput("Arrays length mismatch");
        }
        if (!selections[claimId].completed) {
            revert Errors.InvalidInput("No juror selection for claim");
        }

        // TODO: IMPLEMENT BOND SLASHING FOR ECONOMIC SECURITY
        // ⚠️  CRITICAL DEPENDENCY: Must fix Claims.sol reputation system first!
        // 
        // Current blocker: Claims.sol has M-of-N early resolution flaw where slower
        // jurors are marked as "unsuccessful" even when voting correctly, just after
        // the threshold is already met. This would cause constant unfair slashing.
        //
        // REQUIRED SEQUENCE:
        // 1. FIRST: Fix Claims._updateVerifierReputations() fairness issue
        //    - Option A: Wait for all jurors before calculating success
        //    - Option B: Only count votes that could have changed outcome  
        //    - Option C: Two-phase voting (all vote, then evaluate)
        //
        // 2. THEN: Implement bond slashing mechanism:
        //    - Calculate slashing amount based on ActionType.slashVerifierBps
        //    - Slash bond proportionally to severity of poor performance
        //    - Consider progressive slashing (higher penalties for repeat offenders)  
        //    - Implement minimum bond requirements (force re-bonding or exit)
        //    - Route slashed funds to treasury or redistribute to good verifiers
        //
        // Implementation location: Add slashing logic in the reputation update loop below
        // Integration needed: ActionTypeRegistry.slashVerifierBps parameter usage

        for (uint256 i = 0; i < jurors.length; i++) {
            if (!isVerifier[jurors[i]]) continue;
            
            Verifier storage verifier = verifiers[jurors[i]];
            verifier.totalVerifications++;
            
            uint256 oldReputation = verifier.reputation;
            
            if (successful[i]) {
                verifier.successfulVerifications++;
                // Increase reputation up to maximum
                if (verifier.reputation < maxReputation) {
                    verifier.reputation = _min(
                        verifier.reputation + reputationReward,
                        maxReputation
                    );
                }
            } else {
                // Decrease reputation
                if (verifier.reputation > reputationDecay) {
                    verifier.reputation -= reputationDecay;
                } else {
                    verifier.reputation = 0;
                }
                
                // TODO: Add bond slashing here for failed verifications
                // Example implementation:
                // uint256 slashAmount = (verifier.bondAmount * slashVerifierBps) / 10000;
                // verifier.bondAmount -= slashAmount;
                // treasuryBalance += slashAmount;
                // emit BondSlashed(jurors[i], slashAmount, verifier.bondAmount);
            }

            if (verifier.reputation != oldReputation) {
                emit ReputationUpdated(jurors[i], oldReputation, verifier.reputation);
            }
        }
    }

    /// @notice Weighted random selection of jurors
    /// @param count Number of jurors to select
    /// @param seed Randomness seed
    /// @return selected Array of selected verifier addresses
    function _weightedRandomSelection(
        uint256 count, 
        uint256 seed
    ) internal view returns (address[] memory selected) {
        uint256 totalVerifiers = activeVerifiers.length;
        selected = new address[](count);
        
        // Create a copy of active verifiers for selection without replacement
        address[] memory candidates = new address[](totalVerifiers);
        uint256[] memory weights = new uint256[](totalVerifiers);
        uint256 totalWeight = 0;
        
        // Calculate weights based on reputation and bond
        for (uint256 i = 0; i < totalVerifiers; i++) {
            candidates[i] = activeVerifiers[i];
            Verifier memory verifier = verifiers[activeVerifiers[i]];
            
            // Weight = (reputation / 100) * sqrt(bondAmount / minimumBond)
            // This gives higher weight to high reputation and higher bond
            uint256 reputationFactor = verifier.reputation; // 0-10000
            uint256 bondFactor = _sqrt((verifier.bondAmount * 10000) / minimumBond);
            weights[i] = (reputationFactor * bondFactor) / 10000;
            
            if (weights[i] == 0) weights[i] = 1; // Minimum weight
            totalWeight += weights[i];
        }

        // Select jurors without replacement
        for (uint256 j = 0; j < count; j++) {
            uint256 randomValue = uint256(keccak256(abi.encode(seed, j))) % totalWeight;
            uint256 currentWeight = 0;
            
            for (uint256 k = 0; k < candidates.length; k++) {
                if (candidates[k] == address(0)) continue; // Already selected
                
                currentWeight += weights[k];
                if (randomValue < currentWeight) {
                    selected[j] = candidates[k];
                    totalWeight -= weights[k];
                    candidates[k] = address(0); // Mark as selected
                    weights[k] = 0;
                    break;
                }
            }
        }
        
        return selected;
    }

    /// @notice Integer square root implementation
    /// @param x Input value
    /// @return y Square root of x
    function _sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    /// @notice Minimum of two values
    /// @param a First value
    /// @param b Second value
    /// @return Minimum value
    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    // Governance functions

    /// @notice Update system parameters (governance only)
    /// @param _minimumBond New minimum bond amount
    /// @param _baseReputation New base reputation for new verifiers
    /// @param _reputationDecay New reputation decay amount
    /// @param _reputationReward New reputation reward amount
    function updateParameters(
        uint256 _minimumBond,
        uint256 _baseReputation,
        uint256 _reputationDecay,
        uint256 _reputationReward
    ) external onlyGovernance {
        if (_baseReputation > maxReputation) {
            revert Errors.InvalidInput("Base reputation too high");
        }
        if (_reputationDecay > maxReputation || _reputationReward > maxReputation) {
            revert Errors.InvalidInput("Reputation change too high");
        }

        minimumBond = _minimumBond;
        baseReputation = _baseReputation;
        reputationDecay = _reputationDecay;
        reputationReward = _reputationReward;

        emit ParametersUpdated(_minimumBond, _baseReputation);
    }

    /// @notice Update governance address (governance only)
    /// @param _governance New governance address
    function updateGovernance(address _governance) external onlyGovernance {
        if (_governance == address(0)) revert Errors.ZeroAddress();
        address oldGov = governance;
        governance = _governance;
        emit GovernanceUpdated(oldGov, _governance);
    }

    /// @notice Set claims contract address (governance only)
    /// @param _claimsContract Claims contract address
    function setClaimsContract(address _claimsContract) external onlyGovernance {
        if (_claimsContract == address(0)) revert Errors.ZeroAddress();
        address oldClaims = claimsContract;
        claimsContract = _claimsContract;
        emit ClaimsContractUpdated(oldClaims, _claimsContract);
    }

    // View functions

    /// @notice Get active verifier count
    /// @return Number of active verifiers
    function getActiveVerifierCount() external view returns (uint256) {
        return activeVerifiers.length;
    }

    /// @notice Get verifier information
    /// @param verifierAddr Verifier address
    /// @return verifier Verifier struct
    function getVerifier(address verifierAddr) external view returns (Verifier memory verifier) {
        return verifiers[verifierAddr];
    }

    /// @notice Get juror selection for a claim
    /// @param claimId Claim ID
    /// @return selection JurorSelection struct
    function getJurorSelection(uint256 claimId) external view returns (JurorSelection memory selection) {
        return selections[claimId];
    }

    /// @notice Get all active verifiers
    /// @return Array of active verifier addresses
    function getActiveVerifiers() external view returns (address[] memory) {
        return activeVerifiers;
    }

    /// @notice Calculate verifier weight for selection
    /// @param verifierAddr Verifier address
    /// @return weight Selection weight
    function getVerifierWeight(address verifierAddr) external view returns (uint256 weight) {
        if (!isVerifier[verifierAddr]) return 0;
        
        Verifier memory verifier = verifiers[verifierAddr];
        if (!verifier.active) return 0;
        
        uint256 reputationFactor = verifier.reputation;
        uint256 bondFactor = _sqrt((verifier.bondAmount * 10000) / minimumBond);
        weight = (reputationFactor * bondFactor) / 10000;
        
        return weight == 0 ? 1 : weight;
    }

    /// @notice Get verifier statistics
    /// @param verifierAddr Verifier address
    /// @return successRate Success rate as basis points (0-10000)
    /// @return isActive Whether verifier is active
    function getVerifierStats(address verifierAddr) external view returns (uint256 successRate, bool isActive) {
        Verifier memory verifier = verifiers[verifierAddr];
        isActive = verifier.active;
        
        if (verifier.totalVerifications == 0) {
            successRate = baseReputation; // Use base reputation if no history
        } else {
            successRate = (verifier.successfulVerifications * 10000) / verifier.totalVerifications;
        }
    }

    /// @notice Emergency function to recover ETH (governance only)
    /// @param to Recipient address
    /// @param amount Amount to recover
    function emergencyWithdraw(address payable to, uint256 amount) external onlyGovernance {
        if (to == address(0)) revert Errors.ZeroAddress();
        if (amount > address(this).balance) {
            revert Errors.InvalidInput("Insufficient contract balance");
        }
        
        (bool success, ) = to.call{value: amount}("");
        if (!success) revert Errors.TransferFailed(address(this), to, amount);
    }

    /// @notice Fallback to receive ETH for bonds
    receive() external payable {
        // Allow receiving ETH for bonds
    }
}
