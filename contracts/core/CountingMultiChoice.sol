// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ICountingMultiChoice} from "./interfaces/ICountingMultiChoice.sol";

contract CountingMultiChoice is ICountingMultiChoice {
    struct Cfg { uint8 options; bool enabled; }
    struct Tally { uint256[] totals; }
    mapping(uint256 => Cfg) internal _cfg;
    mapping(uint256 => mapping(address => uint256[])) internal _ballots;
    mapping(uint256 => Tally) internal _tally;

    function enableMulti(uint256 proposalId, uint8 options) external {
        require(!_cfg[proposalId].enabled, "ENABLED");
        _cfg[proposalId] = Cfg({options: options, enabled: true});
        _tally[proposalId].totals = new uint256[](options);
    }

    function castVoteMulti(uint256 proposalId, address voter, uint256 weight, uint256[] calldata weights, string calldata reason)
        external returns (uint256)
    {
        Cfg memory c = _cfg[proposalId];
        require(c.enabled, "NOT_MULTI");
        require(weights.length == c.options, "LEN");

        uint256 sum;
        for (uint i; i < weights.length; ++i) sum += weights[i];
        require(sum <= 1e18, "ALLOC>100%");

        uint256[] storage prev = _ballots[proposalId][voter];
        if (prev.length > 0) {
            for (uint i; i < prev.length; ++i) _tally[proposalId].totals[i] -= (prev[i] * weight) / 1e18;
        }
        _ballots[proposalId][voter] = weights;
        for (uint i; i < weights.length; ++i) _tally[proposalId].totals[i] += (weights[i] * weight) / 1e18;

        emit VoteCastMulti(proposalId, voter, weights, weight, reason);
        return weight;
    }

    function optionTotals(uint256 proposalId) external view returns (uint256[] memory) { return _tally[proposalId].totals; }
    function numOptionsOf(uint256 proposalId) external view returns (uint8) { return _cfg[proposalId].options; }
}
