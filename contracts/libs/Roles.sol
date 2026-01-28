// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Roles
/// @notice Canonical role identifiers for AccessManager-gated functions across Shift
/// @dev Keep role ids unique and stable once deployed; update this file when introducing new roles.
library Roles {
    // AccessManager roles (uint64) — unique across the system
    uint64 public constant COHORT_REVENUE_ROUTER_ROLE = 1;
    uint64 public constant COHORT_INVESTMENT_RECORDER_ROLE = 2;
    uint64 public constant VALUABLE_ACTION_REGISTRY_ISSUER_ROLE = 3;
    uint64 public constant VALUABLE_ACTION_SBT_MANAGER_ROLE = 4;
    uint64 public constant VALUABLE_ACTION_SBT_GOVERNANCE_ROLE = 5;
    uint64 public constant REVENUE_ROUTER_DISTRIBUTOR_ROLE = 6;
    uint64 public constant REVENUE_ROUTER_POSITION_MANAGER_ROLE = 7;
    uint64 public constant COMMUNITY_TOKEN_MINTER_ROLE = 8;
    uint64 public constant COMMUNITY_TOKEN_TREASURY_ROLE = 9;
    uint64 public constant COMMUNITY_TOKEN_EMERGENCY_ROLE = 10;
    uint64 public constant MEMBERSHIP_TOKEN_MINTER_ROLE = 11;
    uint64 public constant MEMBERSHIP_TOKEN_GOVERNANCE_ROLE = 12;
    uint64 public constant COMMERCE_DISPUTES_CALLER_ROLE = 13;
    uint64 public constant HOUSING_MARKETPLACE_CALLER_ROLE = 14;
    uint64 public constant VERIFIER_MANAGER_CALLER_ROLE = 15;

    // CommunityRegistry roles (bytes32) kept here for single-source-of-truth
    bytes32 public constant COMMUNITY_GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    bytes32 public constant COMMUNITY_MODERATOR_ROLE = keccak256("MODERATOR_ROLE");
    bytes32 public constant COMMUNITY_CURATOR_ROLE = keccak256("CURATOR_ROLE");
}