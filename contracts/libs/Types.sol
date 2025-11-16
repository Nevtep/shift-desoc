// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library Types {
    struct ValuableAction {
        uint32 membershipTokenReward;   // MembershipToken amount minted on completion
        uint32 communityTokenReward;    // CommunityToken amount earned for period salary calculation  
        uint32 investorSBTReward;      // InvestorSBT minting for investment-type actions
        
        // Verification Parameters
        uint32 jurorsMin;              // M (minimum approvals needed)
        uint32 panelSize;              // N (total jurors selected)
        uint32 verifyWindow;           // Time limit for jury decision
        uint32 verifierRewardWeight;   // Points earned by accurate verifiers
        uint32 slashVerifierBps;       // Penalty for inaccurate verification (0..10000)
        
        // Quality Control
        uint32 cooldownPeriod;         // Minimum time between claims of this type
        uint32 maxConcurrent;          // Maximum active claims per person
        bool revocable;                // Can community governance revoke this SBT
        uint32 evidenceTypes;          // Bitmask of required evidence formats
        
        // Governance Requirements
        uint256 proposalThreshold;     // Governance tokens needed to propose new Valuable Actions
        address proposer;              // Who proposed this Valuable Action
        bool requiresGovernanceApproval; // Whether this action needs community vote to activate
        
        // Metadata & Automation
        string evidenceSpecCID;        // IPFS: detailed evidence requirements
        string titleTemplate;          // Template for claim titles
        bytes32[] automationRules;     // Integration with external systems (GitHub, etc)
        
        // Time-Based Parameters
        uint64 activationDelay;        // Governance approval → active period
        uint64 deprecationWarning;     // Time before auto-deactivation
        bool founderVerified;          // Special status for community bootstrapping
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
    
    enum ClaimStatus { Pending, Approved, Rejected, Revoked }
}
