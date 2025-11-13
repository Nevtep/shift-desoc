// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ProjectFactory {
    struct Project { address creator; string cid; address token1155; bool active; }
    event ProjectCreated(uint256 indexed id, address indexed creator, string cid, address token1155);
    uint256 public lastId; mapping(uint256 => Project) public projects;

    function create(string calldata cid, address token1155) external returns (uint256 id) {
        id = ++lastId; projects[id] = Project(msg.sender, cid, token1155, true);
        emit ProjectCreated(id, msg.sender, cid, token1155);
    }
}
