// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract HousingManager {
    event UnitListed(uint256 indexed unitId, string name, uint256 basePricePerNight);
    event Reserved(uint256 indexed unitId, uint256 night, address indexed user);

    function listUnit(string calldata name, uint256 basePricePerNight) external returns (uint256 unitId) {
        // TODO: alta de unidad + calendario
        unitId = 1; emit UnitListed(unitId, name, basePricePerNight);
    }
    function reserve(uint256 unitId, uint256 nightTs) external payable {
        // TODO: reglas de prioridad, descuentos, cobro en stable/token, NFT de reserva
        emit Reserved(unitId, nightTs, msg.sender);
    }
}
