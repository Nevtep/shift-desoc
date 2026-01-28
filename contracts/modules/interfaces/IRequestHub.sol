// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal interface for RequestHub used by modules that need request lookups
interface IRequestHub {
    enum Status {
        OPEN_DEBATE,
        FROZEN,
        ARCHIVED
    }

    struct Request {
        uint256 communityId;
        address author;
        string title;
        string cid;
        Status status;
        uint64 createdAt;
        uint64 lastActivity;
        string[] tags;
        uint256 commentCount;
        address bountyToken;
        uint256 bountyAmount;
        uint256 linkedValuableAction;
        bool consumed;
        address winner;
    }

    /// @notice Get request details (reverts if request is missing)
    function getRequest(uint256 requestId) external view returns (Request memory request);
}
