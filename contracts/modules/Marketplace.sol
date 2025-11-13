// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Marketplace {
    event SkuListed(uint256 indexed skuId, address indexed token, uint256 price, bool stable);
    event Purchased(uint256 indexed skuId, address indexed buyer, uint256 qty, bool paidStable);

    function listSku(address token, uint256 price, bool paidInStable) external returns (uint256 skuId) {
        // TODO almacenar SKU (ERC1155 o ERC721) + price
        skuId = 1; emit SkuListed(skuId, token, price, paidInStable);
    }
    function buy(uint256 skuId, uint256 qty, bool payStable) external {
        // TODO transferencias y recaudación
        emit Purchased(skuId, msg.sender, qty, payStable);
    }
}
