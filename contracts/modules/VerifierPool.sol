// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract VerifierPool {
    // MVP: listado simple de verificadores aprobados; en v1: scoring/ponderación
    mapping(address => bool) public isVerifier;
    event VerifierSet(address indexed v, bool ok);
    function setVerifier(address v, bool ok) external /* onlyGov */ { isVerifier[v] = ok; emit VerifierSet(v, ok); }
}
