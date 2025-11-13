// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

contract MembershipTokenERC20Votes is ERC20, ERC20Permit, ERC20Votes {
    constructor(string memory n, string memory s) ERC20(n, s) ERC20Permit(n) { _mint(msg.sender, 1_000_000 ether); }
    function _update(address from, address to, uint256 amount) internal override(ERC20, ERC20Votes) { super._update(from, to, amount); }
    function nonces(address owner) public view override(ERC20Permit) returns (uint256) { return super.nonces(owner); }
}
