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
    function totalSupply() external view returns (uint256);
    function getCommunityVerifiers(uint256 startIndex, uint256 maxResults) external view returns (
        address[] memory verifiers,
        uint256[] memory powers,
        bool hasMore
    );
    function getCommunityStats() external view returns (
        uint256 totalVerifiers,
        uint256 totalPower,
        uint256 averagePower
    );
}

/// @title VerifierElection
/// @notice Manages verifier election and governance for a single community verifier power token instance
/// @dev Only timelock can execute verifier management functions.
/// The VPT token's active roster is the single canonical verifier roster: eligibility, `getVerifierSet`
/// and `getCommunityStats` are all derived from it, so any path that changes a balance (this contract,
/// direct `mint`/`batchMint`, `adminTransfer`) is reflected without a second hand-maintained list.
/// Bans remain Election state and are filtered out of eligibility.
contract VerifierElection is AccessManaged {
    /// @notice Verifier power token contract
    IVPT1155 public immutable vpt;

    /// @notice Immutable community scope for this module instance.
    uint256 public immutable communityId;

    /// @notice Page size used when reading the token roster
    uint256 internal constant ROSTER_PAGE = 100;

    /// @notice Verifier set metadata (the roster itself lives in the VPT token)
    struct VerifierSet {
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

        // Snapshot the canonical roster before minting so directly-minted holders are also replaced
        (address[] memory oldVerifiers,) = _roster();

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

            newTotalPower += targetPower;
        }

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
            }
        }

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

        verifierSet.lastUpdated = uint64(block.timestamp);

        emit VerifierPowerAdjusted(communityId, verifier, currentPower, newPower, reasonCID);
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
        (verifiers, powers) = _roster();
        totalPower = vpt.totalSupply();
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
        (address[] memory allVerifiers, uint256[] memory allPowers) = _roster();

        uint256 eligibleCount = 0;
        for (uint256 i = 0; i < allVerifiers.length; i++) {
            if (allPowers[i] > 0 && !_bannedVerifiers[allVerifiers[i]]) {
                eligibleCount++;
            }
        }

        eligibleVerifiers = new address[](eligibleCount);
        eligiblePowers = new uint256[](eligibleCount);

        uint256 index = 0;
        for (uint256 i = 0; i < allVerifiers.length; i++) {
            if (allPowers[i] > 0 && !_bannedVerifiers[allVerifiers[i]]) {
                eligibleVerifiers[index] = allVerifiers[i];
                eligiblePowers[index] = allPowers[i];
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
    /// @return totalVerifiers Number of verifiers in the token roster
    /// @return activeVerifiers Number of verifiers with power > 0 (equal to totalVerifiers)
    /// @return totalPower Total power distributed
    /// @return averagePower Average power per active verifier
    function getCommunityStats() external view returns (
        uint256 totalVerifiers,
        uint256 activeVerifiers,
        uint256 totalPower,
        uint256 averagePower
    ) {
        // Token roster members always hold power > 0, so total == active.
        (totalVerifiers, totalPower, averagePower) = vpt.getCommunityStats();
        activeVerifiers = totalVerifiers;
    }

    /// @dev Reads the full active roster from the VPT token in bounded pages.
    function _roster() internal view returns (address[] memory verifiers, uint256[] memory powers) {
        (uint256 count,,) = vpt.getCommunityStats();
        verifiers = new address[](count);
        powers = new uint256[](count);

        uint256 filled = 0;
        bool hasMore = count > 0;
        while (hasMore) {
            (address[] memory pageV, uint256[] memory pageP, bool more) =
                vpt.getCommunityVerifiers(filled, ROSTER_PAGE);
            for (uint256 i = 0; i < pageV.length; i++) {
                verifiers[filled + i] = pageV[i];
                powers[filled + i] = pageP[i];
            }
            filled += pageV.length;
            hasMore = more && pageV.length > 0;
        }
    }

    function bannedVerifiers(address verifier) external view returns (bool) {
        return _bannedVerifiers[verifier];
    }

    function bannedTimestamp(address verifier) external view returns (uint64) {
        return _bannedTimestamp[verifier];
    }
}
