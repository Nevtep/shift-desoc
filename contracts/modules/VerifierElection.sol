// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Errors} from "contracts/libs/Errors.sol";

/// @notice Interface for VerifierPowerToken1155 contract
interface IVPT1155 {
    function mint(address to, uint256 id, uint256 amount, string calldata reasonCID) external;
    function burn(address from, uint256 id, uint256 amount, string calldata reasonCID) external;
    function batchMint(address[] calldata to, uint256 id, uint256[] calldata amounts, string calldata reasonCID) external;
    function batchBurn(address[] calldata from, uint256 id, uint256[] calldata amounts, string calldata reasonCID) external;
    function balanceOf(address account, uint256 id) external view returns (uint256);
    function hasVerifierPower(address account, uint256 communityId) external view returns (bool);
}

/// @title VerifierElection
/// @notice Manages verifier election and governance for per-community verifier power tokens
/// @dev Only timelock can execute verifier management functions
contract VerifierElection {
    /// @notice Immutable timelock controller address
    address public immutable timelock;
    
    /// @notice Verifier power token contract
    IVPT1155 public immutable vpt;
    
    /// @notice Verifier set information for a community
    struct VerifierSet {
        address[] verifiers;           // Current verifier addresses
        mapping(address => uint256) powers; // Verifier => power amount
        uint256 totalPower;           // Total power distributed
        uint64 lastUpdated;          // Last update timestamp
        string lastReasonCID;        // IPFS hash of last update reason
    }
    
    /// @notice Track verifier sets per community
    mapping(uint256 => VerifierSet) public verifierSets;
    
    /// @notice Track banned verifiers per community
    mapping(uint256 => mapping(address => bool)) public bannedVerifiers;
    
    /// @notice Track when verifiers were banned (for potential cooldown logic)
    mapping(uint256 => mapping(address => uint64)) public bannedTimestamp;
    
    /// @notice Events for verifier management
    event VerifierSetUpdated(
        uint256 indexed communityId, 
        uint256 verifierCount, 
        uint256 totalPower,
        string reasonCID
    );
    event VerifiersBanned(
        uint256 indexed communityId, 
        address[] offenders, 
        string reasonCID
    );
    event VerifierUnbanned(
        uint256 indexed communityId,
        address verifier,
        string reasonCID
    );
    event VerifierPowerAdjusted(
        uint256 indexed communityId,
        address indexed verifier,
        uint256 oldPower,
        uint256 newPower,
        string reasonCID
    );
    
    /// @notice Access control modifier
    modifier onlyTimelock() {
        if (msg.sender != timelock) revert Errors.NotAuthorized(msg.sender);
        _;
    }
    
    /// @notice Constructor
    /// @param _timelock Timelock controller address
    /// @param _vpt VerifierPowerToken1155 contract address
    constructor(address _timelock, address _vpt) {
        if (_timelock == address(0)) revert Errors.ZeroAddress();
        if (_vpt == address(0)) revert Errors.ZeroAddress();
        
        timelock = _timelock;
        vpt = IVPT1155(_vpt);
    }
    
    /// @notice Set complete verifier set for a community
    /// @dev Mints missing power, burns excess power to match target weights
    /// @param communityId Community identifier
    /// @param addrs Array of verifier addresses
    /// @param weights Array of corresponding power amounts
    /// @param reasonCID IPFS hash explaining the verifier set change
    function setVerifierSet(
        uint256 communityId,
        address[] calldata addrs,
        uint256[] calldata weights,
        string calldata reasonCID
    ) external onlyTimelock {
        if (addrs.length != weights.length) {
            revert Errors.InvalidInput("Array length mismatch");
        }
        if (addrs.length == 0) {
            revert Errors.InvalidInput("Empty verifier set");
        }
        
        VerifierSet storage verifierSet = verifierSets[communityId];
        
        // Reset total power calculation
        uint256 newTotalPower = 0;
        
        // Process each verifier in the new set
        for (uint256 i = 0; i < addrs.length; i++) {
            if (addrs[i] == address(0)) revert Errors.ZeroAddress();
            if (weights[i] == 0) revert Errors.InvalidInput("Zero power not allowed");
            
            // Check if verifier is banned
            if (bannedVerifiers[communityId][addrs[i]]) {
                revert Errors.InvalidInput("Cannot assign power to banned verifier");
            }
            
            uint256 currentPower = vpt.balanceOf(addrs[i], communityId);
            uint256 targetPower = weights[i];
            
            if (targetPower > currentPower) {
                // Mint additional power
                vpt.mint(addrs[i], communityId, targetPower - currentPower, reasonCID);
            } else if (targetPower < currentPower) {
                // Burn excess power
                vpt.burn(addrs[i], communityId, currentPower - targetPower, reasonCID);
            }
            
            // Update verifier set tracking
            verifierSet.powers[addrs[i]] = targetPower;
            newTotalPower += targetPower;
        }
        
        // Remove power from verifiers not in the new set
        address[] memory oldVerifiers = verifierSet.verifiers;
        for (uint256 i = 0; i < oldVerifiers.length; i++) {
            address oldVerifier = oldVerifiers[i];
            bool stillInSet = false;
            
            // Check if old verifier is in new set
            for (uint256 j = 0; j < addrs.length; j++) {
                if (addrs[j] == oldVerifier) {
                    stillInSet = true;
                    break;
                }
            }
            
            // If not in new set, burn all their power
            if (!stillInSet) {
                uint256 currentPower = vpt.balanceOf(oldVerifier, communityId);
                if (currentPower > 0) {
                    vpt.burn(oldVerifier, communityId, currentPower, reasonCID);
                }
                verifierSet.powers[oldVerifier] = 0;
            }
        }
        
        // Update verifier set
        verifierSet.verifiers = addrs;
        verifierSet.totalPower = newTotalPower;
        verifierSet.lastUpdated = uint64(block.timestamp);
        verifierSet.lastReasonCID = reasonCID;
        
        emit VerifierSetUpdated(communityId, addrs.length, newTotalPower, reasonCID);
    }
    
    /// @notice Ban verifiers and burn all their power
    /// @param communityId Community identifier
    /// @param offenders Array of verifier addresses to ban
    /// @param reasonCID IPFS hash explaining the ban reason
    function banVerifiers(
        uint256 communityId,
        address[] calldata offenders,
        string calldata reasonCID
    ) external onlyTimelock {
        if (offenders.length == 0) revert Errors.InvalidInput("No offenders provided");
        
        for (uint256 i = 0; i < offenders.length; i++) {
            address offender = offenders[i];
            if (offender == address(0)) revert Errors.ZeroAddress();
            
            // Mark as banned
            bannedVerifiers[communityId][offender] = true;
            bannedTimestamp[communityId][offender] = uint64(block.timestamp);
            
            // Burn all verifier power
            uint256 currentPower = vpt.balanceOf(offender, communityId);
            if (currentPower > 0) {
                vpt.burn(offender, communityId, currentPower, reasonCID);
                
                // Update verifier set tracking
                VerifierSet storage verifierSet = verifierSets[communityId];
                verifierSet.totalPower -= verifierSet.powers[offender];
                verifierSet.powers[offender] = 0;
            }
        }
        
        emit VerifiersBanned(communityId, offenders, reasonCID);
    }
    
    /// @notice Unban a verifier (allows them to be elected again)
    /// @param communityId Community identifier
    /// @param verifier Verifier address to unban
    /// @param reasonCID IPFS hash explaining the unban reason
    function unbanVerifier(
        uint256 communityId,
        address verifier,
        string calldata reasonCID
    ) external onlyTimelock {
        if (verifier == address(0)) revert Errors.ZeroAddress();
        if (!bannedVerifiers[communityId][verifier]) {
            revert Errors.InvalidInput("Verifier not banned");
        }
        
        bannedVerifiers[communityId][verifier] = false;
        bannedTimestamp[communityId][verifier] = 0;
        
        emit VerifierUnbanned(communityId, verifier, reasonCID);
    }
    
    /// @notice Adjust individual verifier power without changing the full set
    /// @param communityId Community identifier
    /// @param verifier Verifier address
    /// @param newPower New power amount
    /// @param reasonCID IPFS hash explaining the adjustment
    function adjustVerifierPower(
        uint256 communityId,
        address verifier,
        uint256 newPower,
        string calldata reasonCID
    ) external onlyTimelock {
        if (verifier == address(0)) revert Errors.ZeroAddress();
        if (bannedVerifiers[communityId][verifier]) {
            revert Errors.InvalidInput("Cannot adjust power of banned verifier");
        }
        
        uint256 currentPower = vpt.balanceOf(verifier, communityId);
        
        if (newPower > currentPower) {
            // Mint additional power
            vpt.mint(verifier, communityId, newPower - currentPower, reasonCID);
        } else if (newPower < currentPower) {
            // Burn excess power
            vpt.burn(verifier, communityId, currentPower - newPower, reasonCID);
        }
        
        // Update tracking
        VerifierSet storage verifierSet = verifierSets[communityId];
        uint256 oldPower = verifierSet.powers[verifier];
        verifierSet.powers[verifier] = newPower;
        verifierSet.totalPower = verifierSet.totalPower - oldPower + newPower;
        verifierSet.lastUpdated = uint64(block.timestamp);
        
        emit VerifierPowerAdjusted(communityId, verifier, oldPower, newPower, reasonCID);
    }
    
    /// @notice Get verifier set information for a community
    /// @param communityId Community identifier
    /// @return verifiers Array of current verifier addresses
    /// @return powers Array of corresponding power amounts
    /// @return totalPower Total power distributed
    /// @return lastUpdated Last update timestamp
    /// @return lastReasonCID Last reason CID
    function getVerifierSet(uint256 communityId) external view returns (
        address[] memory verifiers,
        uint256[] memory powers,
        uint256 totalPower,
        uint64 lastUpdated,
        string memory lastReasonCID
    ) {
        VerifierSet storage verifierSet = verifierSets[communityId];
        verifiers = verifierSet.verifiers;
        
        powers = new uint256[](verifiers.length);
        for (uint256 i = 0; i < verifiers.length; i++) {
            powers[i] = verifierSet.powers[verifiers[i]];
        }
        
        totalPower = verifierSet.totalPower;
        lastUpdated = verifierSet.lastUpdated;
        lastReasonCID = verifierSet.lastReasonCID;
    }
    
    /// @notice Check if address is a verifier for community
    /// @param communityId Community identifier
    /// @param verifier Address to check
    /// @return isVerifier True if address has verifier power
    /// @return power Amount of verifier power
    /// @return isBanned True if verifier is banned
    function getVerifierStatus(
        uint256 communityId,
        address verifier
    ) external view returns (
        bool isVerifier,
        uint256 power,
        bool isBanned
    ) {
        power = vpt.balanceOf(verifier, communityId);
        isVerifier = power > 0;
        isBanned = bannedVerifiers[communityId][verifier];
    }
    
    /// @notice Get eligible verifiers for panel selection (has power + not banned)
    /// @param communityId Community identifier
    /// @return eligibleVerifiers Array of eligible verifier addresses
    /// @return eligiblePowers Array of corresponding power amounts
    function getEligibleVerifiers(uint256 communityId) external view returns (
        address[] memory eligibleVerifiers,
        uint256[] memory eligiblePowers
    ) {
        VerifierSet storage verifierSet = verifierSets[communityId];
        address[] memory allVerifiers = verifierSet.verifiers;
        
        // Count eligible verifiers
        uint256 eligibleCount = 0;
        for (uint256 i = 0; i < allVerifiers.length; i++) {
            address verifier = allVerifiers[i];
            uint256 power = vpt.balanceOf(verifier, communityId);
            
            if (power > 0 && !bannedVerifiers[communityId][verifier]) {
                eligibleCount++;
            }
        }
        
        // Build eligible arrays
        eligibleVerifiers = new address[](eligibleCount);
        eligiblePowers = new uint256[](eligibleCount);
        
        uint256 index = 0;
        for (uint256 i = 0; i < allVerifiers.length; i++) {
            address verifier = allVerifiers[i];
            uint256 power = vpt.balanceOf(verifier, communityId);
            
            if (power > 0 && !bannedVerifiers[communityId][verifier]) {
                eligibleVerifiers[index] = verifier;
                eligiblePowers[index] = power;
                index++;
            }
        }
    }
    
    /// @notice Get ban information for a verifier
    /// @param communityId Community identifier
    /// @param verifier Verifier address
    /// @return isBanned True if banned
    /// @return bannedAt Timestamp when banned (0 if not banned)
    function getBanInfo(
        uint256 communityId,
        address verifier
    ) external view returns (bool isBanned, uint64 bannedAt) {
        isBanned = bannedVerifiers[communityId][verifier];
        bannedAt = bannedTimestamp[communityId][verifier];
    }
    
    /// @notice Get community verifier statistics
    /// @param communityId Community identifier
    /// @return totalVerifiers Number of verifiers in set
    /// @return activeVerifiers Number of verifiers with power > 0
    /// @return totalPower Total power distributed
    /// @return averagePower Average power per active verifier
    function getCommunityStats(uint256 communityId) external view returns (
        uint256 totalVerifiers,
        uint256 activeVerifiers,
        uint256 totalPower,
        uint256 averagePower
    ) {
        VerifierSet storage verifierSet = verifierSets[communityId];
        address[] memory allVerifiers = verifierSet.verifiers;
        
        totalVerifiers = allVerifiers.length;
        totalPower = verifierSet.totalPower;
        
        // Count active verifiers
        for (uint256 i = 0; i < allVerifiers.length; i++) {
            if (vpt.balanceOf(allVerifiers[i], communityId) > 0) {
                activeVerifiers++;
            }
        }
        
        averagePower = activeVerifiers > 0 ? totalPower / activeVerifiers : 0;
    }
}