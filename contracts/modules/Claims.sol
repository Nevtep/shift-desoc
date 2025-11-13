// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Types} from "../libs/Types.sol";
import {Errors} from "../libs/Errors.sol";

contract Claims {
    struct Claim { uint256 typeId; address worker; string cid; Types.ClaimStatus status; uint64 createdAt; }
    event ClaimSubmitted(uint256 indexed claimId, uint256 indexed typeId, address indexed worker, string cid);
    event ClaimVerified(uint256 indexed claimId, address indexed verifier, bool approve);
    event ClaimResolved(uint256 indexed claimId, Types.ClaimStatus status);
    event ClaimRevoked(uint256 indexed claimId);

    uint256 public lastId;
    mapping(uint256 => Claim) public claims;

    // TODO: integrar panel M-de-N, bonds, selección de jurado, apelaciones, SBT mint, WorkerPoints
    function submit(uint256 typeId, string calldata cid) external returns (uint256 id) {
        id = ++lastId; claims[id] = Claim(typeId, msg.sender, cid, Types.ClaimStatus.Pending, uint64(block.timestamp));
        emit ClaimSubmitted(id, typeId, msg.sender, cid);
    }
    function verify(uint256 id, bool approve) external {
        // TODO: checks de jurado + registrar voto + resolver si M alcanzado
        emit ClaimVerified(id, msg.sender, approve);
    }
    function resolve(uint256 id, bool approve) external /* onlyMgr */ {
        claims[id].status = approve ? Types.ClaimStatus.Approved : Types.ClaimStatus.Rejected;
        emit ClaimResolved(id, claims[id].status);
    }
    function revoke(uint256 id) external /* onlyGov */ {
        claims[id].status = Types.ClaimStatus.Revoked;
        emit ClaimRevoked(id);
    }
}
