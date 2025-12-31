// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library Types {
    /// @notice Engagement subtypes for SBTs
    enum EngagementSubtype {
        WORK,
        ROLE,
        CREDENTIAL
    }

    /// @notice Action categories that map to issuance flows
    enum ActionCategory {
        ENGAGEMENT_ONE_SHOT,
        POSITION_ASSIGNMENT,
        INVESTMENT,
        CREDENTIAL
    }

    /// @notice Verifier policy per valuable action
    enum VerifierPolicy {
        NONE,
        FIXED,
        ROLE_BASED,
        JURY,
        MULTISIG
    }
    enum EngagementStatus { Pending, Approved, Rejected, Revoked }
    
    struct ValuableAction {
        uint32 membershipTokenReward;   // MembershipToken amount minted on completion
        uint32 communityTokenReward;    // CommunityToken amount earned for period salary calculation  
        uint32 investorSBTReward;      // InvestorSBT minting for investment-type actions

        // Action classification
        ActionCategory category;        // High-level action category
        bytes32 roleTypeId;             // Default role/position type (for POSITION_ASSIGNMENT)
        uint32 positionPoints;          // Default points for position assignments
        VerifierPolicy verifierPolicy;  // How approvals are authorized
        bytes32 metadataSchemaId;       // Off-chain/on-chain metadata schema identifier
        
        // Verification Parameters
        uint32 jurorsMin;              // M (minimum approvals needed)
        uint32 panelSize;              // N (total jurors selected)
        uint32 verifyWindow;           // Time limit for jury decision
        uint32 verifierRewardWeight;   // Points earned by accurate verifiers
        uint32 slashVerifierBps;       // Penalty for inaccurate verification (0..10000)
        
        // Quality Control
        uint32 cooldownPeriod;         // Minimum time between engagements of this type
        uint32 maxConcurrent;          // Maximum active engagements per person
        bool revocable;                // Can community governance revoke this SBT
        uint32 evidenceTypes;          // Bitmask of required evidence formats
        
        // Governance Requirements
        uint256 proposalThreshold;     // Governance tokens needed to propose new Valuable Actions
        address proposer;              // Who proposed this Valuable Action
        
        // Metadata & Automation
        string evidenceSpecCID;        // IPFS: detailed evidence requirements
        string titleTemplate;          // Template for engagement titles
        bytes32[] automationRules;     // Integration with external systems (GitHub, etc)
        
        // Time-Based Parameters
        uint64 activationDelay;        // Governance approval → active period
        uint64 deprecationWarning;     // Time before auto-deactivation
    }
    
    // Legacy support - will be removed after migration
    struct ActionType {
        uint32 weight;              // puntos
        uint32 jurorsMin;           // M
        uint32 panelSize;           // N
        uint32 verifyWindow;        // segundos
        uint32 cooldown;            // segundos
        uint32 rewardVerify;        // puntos para verificador
        uint32 slashVerifierBps;    // 0..10000
        bool   revocable;
        string evidenceSpecCID;     // IPFS: foto/video + geo + ts
    }
}
