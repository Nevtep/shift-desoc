// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IModuleProduct
 * @notice Generic interface for product modules that integrate with Marketplace
 * @dev Modules like HousingManager implement this to provide:
 *      - Dynamic pricing via quote()
 *      - Resource creation via consume()
 *      - Post-settlement hooks via onOrderSettled()
 */
interface IModuleProduct {
    /**
     * @notice Calculate final price for a product purchase
     * @dev Should revert if product is unavailable or params are invalid
     * @param productId Module-specific product identifier (e.g. unitId for housing)
     * @param params ABI-encoded module-specific parameters (e.g. dates for housing)
     * @param basePrice Base price from the Marketplace offer
     * @return finalPrice The computed final price for this purchase
     */
    function quote(uint256 productId, bytes calldata params, uint256 basePrice)
        external
        view
        returns (uint256 finalPrice);

    /**
     * @notice Create a resource after payment has been escrowed
     * @dev Called by Marketplace after funds are secured
     *      Should revert if resource cannot be created (e.g. race condition)
     * @param productId Module-specific product identifier
     * @param buyer Address of the buyer
     * @param params ABI-encoded module-specific parameters
     * @param amountPaid Amount that was paid and escrowed
     * @return resourceId Module-specific resource identifier (e.g. reservationId)
     */
    function consume(uint256 productId, address buyer, bytes calldata params, uint256 amountPaid)
        external
        returns (uint256 resourceId);

    /**
     * @notice Optional hook called after order settlement
     * @dev Allows modules to update state based on settlement outcome
     * @param productId Module-specific product identifier
     * @param resourceId Module-specific resource identifier returned by consume()
     * @param outcome Settlement outcome (1 = PAID, 2 = REFUNDED)
     */
    function onOrderSettled(uint256 productId, uint256 resourceId, uint8 outcome) external;
}
