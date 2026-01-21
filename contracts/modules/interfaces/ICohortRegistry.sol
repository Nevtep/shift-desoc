// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ICohortRegistry
/// @notice CohortRegistry interface for revenue distribution and claims.
interface ICohortRegistry {
    struct Cohort {
        uint256 id;
        uint256 communityId;
        uint16 targetRoiBps;
        uint64 createdAt;
        uint64 startAt;
        uint64 endAt;
        uint32 priorityWeight;
        uint256 investedTotal;
        uint256 recoveredTotal;
        bool active;
        bytes32 termsHash;
    }

    function getActiveCohorts(uint256 communityId) external view returns (uint256[] memory);
    function getCohort(uint256 cohortId) external view returns (Cohort memory);
    function isCohortActive(uint256 cohortId) external view returns (bool);
    function getCohortCommunity(uint256 cohortId) external view returns (uint256);
    function getInvestmentAmountByToken(uint256 tokenId) external view returns (uint256);
}
