// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract WorkerSBT is ERC721 {
    error Soulbound();
    address public manager; // Claims contract
    uint256 public nextId = 1;

    constructor(address m) ERC721("Shift Worker SBT", "sSBT") { manager = m; }

    function mint(address to) external {
        require(msg.sender == manager, "ONLY_MGR");
        _safeMint(to, nextId++);
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }
}
