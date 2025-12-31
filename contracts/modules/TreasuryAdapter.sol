// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Errors} from "../libs/Errors.sol";

/// @title TreasuryAdapter
/// @notice Minimal treasury adapter for controlled payouts
/// @dev Future-safe module wiring lives elsewhere; this only handles whitelisted bounty payouts
contract TreasuryAdapter {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event CallerWhitelistUpdated(address indexed caller, bool allowed);
    event BountyPaid(address indexed token, uint256 amount, address indexed to, address indexed caller);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error NotConfigured();

    /*//////////////////////////////////////////////////////////////
                               STORAGE
    //////////////////////////////////////////////////////////////*/

    address public immutable governance;
    mapping(address => bool) public isAuthorizedCaller;

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyGovernance() {
        if (msg.sender != governance) revert Errors.NotAuthorized(msg.sender);
        _;
    }

    modifier onlyAuthorizedCaller() {
        if (!isAuthorizedCaller[msg.sender]) revert Errors.NotAuthorized(msg.sender);
        _;
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(address _governance) {
        if (_governance == address(0)) revert Errors.ZeroAddress();
        governance = _governance;
    }

    /*//////////////////////////////////////////////////////////////
                             ADMIN ACTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Allow or disallow a caller to trigger payouts
    function setAuthorizedCaller(address caller, bool allowed) external onlyGovernance {
        if (caller == address(0)) revert Errors.ZeroAddress();
        isAuthorizedCaller[caller] = allowed;
        emit CallerWhitelistUpdated(caller, allowed);
    }

    /*//////////////////////////////////////////////////////////////
                              PAYOUTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Payout a bounty in ERC20 tokens to a recipient
    /// @dev Caller must be whitelisted (e.g., RequestHub)
    function payoutBounty(address token, uint256 amount, address to) external onlyAuthorizedCaller {
        if (token == address(0)) revert Errors.ZeroAddress();
        if (to == address(0)) revert Errors.ZeroAddress();
        if (amount == 0) revert Errors.InvalidTokenAmount(amount);

        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance < amount) revert Errors.InsufficientBalance(address(this), amount, balance);

        IERC20(token).safeTransfer(to, amount);
        emit BountyPaid(token, amount, to, msg.sender);
    }

    /*//////////////////////////////////////////////////////////////
                             PLACEHOLDER
    //////////////////////////////////////////////////////////////*/

    function execute(address, uint256, bytes calldata, uint8) external pure returns (bool) {
        // Fase 2: Safe/Zodiac (not implemented here)
        revert NotConfigured();
    }
}
