// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract RequestHub {
    enum Status { OPEN_DEBATE, FROZEN, ARCHIVED }
    struct RequestMeta { address author; string title; string cid; Status status; uint64 createdAt; }
    uint256 public lastId; mapping(uint256 => RequestMeta) public requests;

    event RequestCreated(uint256 indexed id, address indexed author, string title, string cid);
    event CommentPosted(uint256 indexed id, uint256 indexed commentId, address indexed author, string cid, uint256 parentId);
    event RequestStatusChanged(uint256 indexed id, Status status);

    function createRequest(string calldata title, string calldata cid) external returns (uint256 id) {
        id = ++lastId; requests[id] = RequestMeta(msg.sender, title, cid, Status.OPEN_DEBATE, uint64(block.timestamp));
        emit RequestCreated(id, msg.sender, title, cid);
    }
    function postComment(uint256 id, uint256 parentId, string calldata cid) external returns (uint256 cId) {
        cId = uint256(keccak256(abi.encodePacked(id, msg.sender, cid, block.timestamp)));
        emit CommentPosted(id, cId, msg.sender, cid, parentId);
    }
    function setStatus(uint256 id, Status s) external /*onlyMod*/ { requests[id].status = s; emit RequestStatusChanged(id, s); }
}
