// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {Errors} from "contracts/libs/Errors.sol";

/// @notice Interface for VerifierPowerToken1155 contract
interface IVPT1155 {
    function mint(address to, uint256 amount, string calldata reasonCID) external;
    function burn(address from, uint256 amount, string calldata reasonCID) external;
    function batchMint(address[] calldata to, uint256[] calldata amounts, string calldata reasonCID) external;
    function batchBurn(address[] calldata from, uint256[] calldata amounts, string calldata reasonCID) external;
    function balanceOf(address account, uint256 id) external view returns (uint256);
    function hasVerifierPower(address account) external view returns (bool);
}

/// @title VerifierElection
/// @notice Manages verifier election and governance for a single community verifier power token instance
/// @dev Only timelock can execute verifier management functions
contract VerifierElection is AccessManaged {
    /// @notice Verifier power token contract
    IVPT1155 public immutable vpt;

    /// @notice Immutable community scope for this module instance.
    uint256 public immutable communityId;

    /// @notice Verifier set information for the local community
    struct VerifierSet {
        address[] verifiers;
        mapping(address => uint256) powers;
        uint256 totalPower;
        uint64 lastUpdated;
        string lastReasonCID;
    }

    VerifierSet internal verifierSet;
    mapping(address => bool) internal _bannedVerifiers;
    mapping(address => uint64) internal _bannedTimestamp;

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

    /// @notice Constructor
    /// @param manager AccessManager authority
    /// @param _vpt VerifierPowerToken1155 contract address
    /// @param _communityId Immutable community scope for this module instance
    constructor(address manager, address _vpt, uint256 _communityId) AccessManaged(manager) {
        if (manager == address(0)) revert Errors.ZeroAddress();
        if (_vpt == address(0)) revert Errors.ZeroAddress();
        if (_communityId == 0) revert Errors.InvalidInput("Invalid communityId");

        vpt = IVPT1155(_vpt);
        communityId = _communityId;
    }

    /// @notice Set complete verifier set for a community
    /// @dev Mints missing power, burns excess power to match target weights
    /// @param addrs Array of verifier addresses
    /// @param weights Array of corresponding power amounts
    /// @param reasonCID IPFS hash explaining the verifier set change
    function setVerifierSet(
        address[] calldata addrs,
        uint256[] calldata weights,
        string calldata reasonCID
    ) external restricted {
        if (addrs.length != weights.length) {
            revert Errors.InvalidInput("Array length mismatch");
        }
        if (addrs.length == 0) {
            revert Errors.InvalidInput("Empty verifier set");
        }

        uint256 newTotalPower = 0;

        for (uint256 i = 0; i < addrs.length; i++) {
            if (addrs[i] == address(0)) revert Errors.ZeroAddress();
            if (weights[i] == 0) revert Errors.InvalidInput("Zero power not allowed");
            if (_bannedVerifiers[addrs[i]]) {
                revert Errors.InvalidInput("Cannot assign power to banned verifier");
            }

            uint256 currentPower = vpt.balanceOf(addrs[i], communityId);
            uint256 targetPower = weights[i];

            if (targetPower > currentPower) {
                vpt.mint(addrs[i], targetPower - currentPower, reasonCID);
            } else if (targetPower < currentPower) {
                vpt.burn(addrs[i], currentPower - targetPower, reasonCID);
            }

            verifierSet.powers[addrs[i]] = targetPower;
            newTotalPower += targetPower;
        }

        address[] memory oldVerifiers = verifierSet.verifiers;
        for (uint256 i = 0; i < oldVerifiers.length; i++) {
            address oldVerifier = oldVerifiers[i];
            bool stillInSet = false;

            for (uint256 j = 0; j < addrs.length; j++) {
                if (addrs[j] == oldVerifier) {
                    stillInSet = true;
                    break;
                }
            }

            if (!stillInSet) {
                uint256 currentPower = vpt.balanceOf(oldVerifier, communityId);
                if (currentPower > 0) {
                    vpt.burn(oldVerifier, currentPower, reasonCID);
                }
                verifierSet.powers[oldVerifier] = 0;
            }
        }

        verifierSet.verifiers = addrs;
        verifierSet.totalPower = newTotalPower;
        verifierSet.lastUpdated = uint64(block.timestamp);
        verifierSet.lastReasonCID = reasonCID;

        emit VerifierSetUpdated(communityId, addrs.length, newTotalPower, reasonCID);
    }

    /// @notice Ban verifiers and burn all their power
    /// @param offenders Array of verifier addresses to ban
    /// @param reasonCID IPFS hash explaining the ban reason
    function banVerifiers(
        address[] calldata offenders,
        string calldata reasonCID
    ) external restricted {
        if (offenders.length == 0) revert Errors.InvalidInput("No offenders provided");

        for (uint256 i = 0; i < offenders.length; i++) {
            address offender = offenders[i];
            if (offender == address(0)) revert Errors.ZeroAddress();

            _bannedVerifiers[offender] = true;
            _bannedTimestamp[offender] = uint64(block.timestamp);

            uint256 currentPower = vpt.balanceOf(offender, communityId);
            if (currentPower > 0) {
                vpt.burn(offender, currentPower, reasonCID);
                verifierSet.totalPower -= verifierSet.powers[offender];
                verifierSet.powers[offender] = 0;
            }
        }

        emit VerifiersBanned(communityId, offenders, reasonCID);
    }

    /// @notice Unban a verifier (allows them to be elected again)
    /// @param verifier Verifier address to unban
    /// @param reasonCID IPFS hash explaining the unban reason
    function unbanVerifier(
        address verifier,
        string calldata reasonCID
    ) external restricted {
        if (verifier == address(0)) revert Errors.ZeroAddress();
        if (!_bannedVerifiers[verifier]) {
            revert Errors.InvalidInput("Verifier not banned");
        }

        _bannedVerifiers[verifier] = false;
        _bannedTimestamp[verifier] = 0;

        emit VerifierUnbanned(communityId, verifier, reasonCID);
    }

    /// @notice Adjust individual verifier power without changing the full set
    /// @param verifier Verifier address
    /// @param newPower New power amount
    /// @param reasonCID IPFS hash explaining the adjustment
    function adjustVerifierPower(
        address verifier,
        uint256 newPower,
        string calldata reasonCID
    ) external restricted {
        if (verifier == address(0)) revert Errors.ZeroAddress();
        if (_bannedVerifiers[verifier]) {
            revert Errors.InvalidInput("Cannot adjust power of banned verifier");
        }

        uint256 currentPower = vpt.balanceOf(verifier, communityId);

        if (newPower > currentPower) {
            vpt.mint(verifier, newPower - currentPower, reasonCID);
        } else if (newPower < currentPower) {
            vpt.burn(verifier, currentPower - newPower, reasonCID);
        }

        uint256 oldPower = verifierSet.powers[verifier];
        verifierSet.powers[verifier] = newPower;
        verifierSet.totalPower = verifierSet.totalPower - oldPower + newPower;
        verifierSet.lastUpdated = uint64(block.timestamp);

        emit VerifierPowerAdjusted(communityId, verifier, oldPower, newPower, reasonCID);
    }

    /// @notice Get verifier set information for a community
    /// @return verifiers Array of current verifier addresses
    /// @return powers Array of corresponding power amounts
    /// @return totalPower Total power distributed
    /// @return lastUpdated Last update timestamp
    /// @return lastReasonCID Last reason CID
    function getVerifierSet() external view returns (
        address[] memory verifiers,
        uint256[] memory powers,
        uint256 totalPower,
        uint64 lastUpdated,
        string memory lastReasonCID
    ) {
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
    /// @param verifier Address to check
    /// @return isVerifier True if address has verifier power
    /// @return power Amount of verifier power
    /// @return isBanned True if verifier is banned
    function getVerifierStatus(
        address verifier
    ) external view returns (
        bool isVerifier,
        uint256 power,
        bool isBanned
    ) {
        power = vpt.balanceOf(verifier, communityId);
        isVerifier = power > 0;
        isBanned = _bannedVerifiers[verifier];
    }

    /// @notice Get eligible verifiers for panel selection (has power + not banned)
    /// @return eligibleVerifiers Array of eligible verifier addresses
    /// @return eligiblePowers Array of corresponding power amounts
    function getEligibleVerifiers() external view returns (
        address[] memory eligibleVerifiers,
        uint256[] memory eligiblePowers
    ) {
        address[] memory allVerifiers = verifierSet.verifiers;

        uint256 eligibleCount = 0;
        for (uint256 i = 0; i < allVerifiers.length; i++) {
            address verifier = allVerifiers[i];
            uint256 power = vpt.balanceOf(verifier, communityId);
            if (power > 0 && !_bannedVerifiers[verifier]) {
                eligibleCount++;
            }
        }

        eligibleVerifiers = new address[](eligibleCount);
        eligiblePowers = new uint256[](eligibleCount);

        uint256 index = 0;
        for (uint256 i = 0; i < allVerifiers.length; i++) {
            address verifier = allVerifiers[i];
            uint256 power = vpt.balanceOf(verifier, communityId);
            if (power > 0 && !_bannedVerifiers[verifier]) {
                eligibleVerifiers[index] = verifier;
                eligiblePowers[index] = power;
                index++;
            }
        }
    }

    /// @notice Get ban information for a verifier
    /// @param verifier Verifier address
    /// @return isBanned True if banned
    /// @return bannedAt Timestamp when banned (0 if not banned)
    function getBanInfo(
        address verifier
    ) external view returns (bool isBanned, uint64 bannedAt) {
        isBanned = _bannedVerifiers[verifier];
        bannedAt = _bannedTimestamp[verifier];
    }

    /// @notice Get community verifier statistics
    /// @return totalVerifiers Number of verifiers in set
    /// @return activeVerifiers Number of verifiers with power > 0
    /// @return totalPower Total power distributed
    /// @return averagePower Average power per active verifier
    function getCommunityStats() external view returns (
        uint256 totalVerifiers,
        uint256 activeVerifiers,
        uint256 totalPower,
        uint256 averagePower
    ) {
        address[] memory allVerifiers = verifierSet.verifiers;
        totalVerifiers = allVerifiers.length;
        totalPower = verifierSet.totalPower;

        for (uint256 i = 0; i < allVerifiers.length; i++) {
            if (vpt.balanceOf(allVerifiers[i], communityId) > 0) {
                activeVerifiers++;
            }
        }

        averagePower = activeVerifiers > 0 ? totalPower / activeVerifiers : 0;
    }

    function bannedVerifiers(address verifier) external view returns (bool) {
        return _bannedVerifiers[verifier];
    }

    function bannedTimestamp(address verifier) external view returns (uint64) {
        return _bannedTimestamp[verifier];
    }
}
