// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Types} from "contracts/libs/Types.sol";
import {Errors} from "contracts/libs/Errors.sol";

contract ActionTypeRegistry {
    event ActionTypeCreated(uint256 indexed id, Types.ActionType cfg, address indexed by);
    event ActionTypeUpdated(uint256 indexed id, Types.ActionType cfg, address indexed by);

    uint256 public lastId;
    mapping(uint256 => Types.ActionType) public typesById;
    mapping(address => bool) public isModerator;

    modifier onlyMod() { if (!isModerator[msg.sender]) revert Errors.NotAuthorized(msg.sender); _; }

    function setModerator(address who, bool val) external /* onlyGov */ { isModerator[who] = val; }

    function create(Types.ActionType calldata cfg) external onlyMod returns (uint256 id) {
        id = ++lastId; typesById[id] = cfg; emit ActionTypeCreated(id, cfg, msg.sender);
    }
    function update(uint256 id, Types.ActionType calldata cfg) external onlyMod {
        require(id > 0 && id <= lastId, "BAD_ID"); typesById[id] = cfg; emit ActionTypeUpdated(id, cfg, msg.sender);
    }
}
