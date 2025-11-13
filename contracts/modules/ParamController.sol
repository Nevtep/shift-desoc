// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ParamController {
    struct FeePeriod { uint64 start; uint64 end; uint32 bps; }
    mapping(uint256 => FeePeriod[]) internal _periods;
    event FeeScheduled(uint256 indexed communityId, FeePeriod p);

    function scheduleFeeChange(uint256 communityId, FeePeriod calldata p) external /*onlyGov*/ {
        _periods[communityId].push(p); emit FeeScheduled(communityId, p);
    }
    function currentFeeBps(uint256 communityId) external view returns (uint32) {
        uint64 ts = uint64(block.timestamp); FeePeriod[] storage arr = _periods[communityId];
        for (uint i; i < arr.length; ++i) if (ts >= arr[i].start && ts <= arr[i].end) return arr[i].bps;
        return 0;
    }
}
