// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library Types {
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
