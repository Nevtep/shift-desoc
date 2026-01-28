// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Errors} from "../libs/Errors.sol";
import {CommunityRegistry} from "./CommunityRegistry.sol";

/// @title TreasuryAdapter
/// @notice Policy + Safe transaction builder for community treasuries
/// @dev Does not custody funds or execute transfers; returns Safe-ready payloads only
contract TreasuryAdapter is AccessManaged {

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event PolicyUpdated(uint256 indexed communityId, bytes32 indexed kind, address indexed target, uint256 value);
    event TxBuilt(uint256 indexed communityId, bytes32 indexed txKind, address indexed target, uint256 value, bytes32 dataHash);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error TxValidationFailed(bytes32 reason);

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    bytes32 public constant REASON_OK = bytes32("OK");
    bytes32 public constant REASON_TREASURY_NOT_SET = bytes32("TREASURY_NOT_SET");
    bytes32 public constant REASON_TOKEN_NOT_ALLOWED = bytes32("TOKEN_NOT_ALLOWED");
    bytes32 public constant REASON_DEST_NOT_ALLOWED = bytes32("DEST_NOT_ALLOWED");
    bytes32 public constant REASON_ADAPTER_NOT_ALLOWED = bytes32("ADAPTER_NOT_ALLOWED");
    bytes32 public constant REASON_CAP_NOT_SET = bytes32("CAP_NOT_SET");
    bytes32 public constant REASON_AMOUNT_EXCEEDS_CAP = bytes32("AMOUNT_EXCEEDS_CAP");

    /*//////////////////////////////////////////////////////////////
                               STORAGE
    //////////////////////////////////////////////////////////////*/

    CommunityRegistry public immutable communityRegistry;

    mapping(uint256 => mapping(address => bool)) public tokenAllowed;
    mapping(uint256 => mapping(address => bool)) public destinationAllowed;
    mapping(uint256 => mapping(address => bool)) public vaultAdapterAllowed;
    mapping(uint256 => mapping(address => uint16)) public capBps; // 0 = disabled

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(address manager, address _communityRegistry) AccessManaged(manager) {
        if (manager == address(0)) revert Errors.ZeroAddress();
        if (_communityRegistry == address(0)) revert Errors.ZeroAddress();
        communityRegistry = CommunityRegistry(_communityRegistry);
    }

    /*//////////////////////////////////////////////////////////////
                             ADMIN ACTIONS
    //////////////////////////////////////////////////////////////*/

    function setTokenAllowed(uint256 communityId, address token, bool allowed) external restricted {
        if (token == address(0)) revert Errors.ZeroAddress();
        tokenAllowed[communityId][token] = allowed;
        emit PolicyUpdated(communityId, bytes32("TOKEN"), token, allowed ? 1 : 0);
    }

    function setDestinationAllowed(uint256 communityId, address target, bool allowed) external restricted {
        if (target == address(0)) revert Errors.ZeroAddress();
        destinationAllowed[communityId][target] = allowed;
        emit PolicyUpdated(communityId, bytes32("DEST"), target, allowed ? 1 : 0);
    }

    function setVaultAdapterAllowed(uint256 communityId, address adapter, bool allowed) external restricted {
        if (adapter == address(0)) revert Errors.ZeroAddress();
        vaultAdapterAllowed[communityId][adapter] = allowed;
        emit PolicyUpdated(communityId, bytes32("ADAPTER"), adapter, allowed ? 1 : 0);
    }

    function setCapBps(uint256 communityId, address token, uint16 capBpsValue) external restricted {
        if (token == address(0)) revert Errors.ZeroAddress();
        if (capBpsValue > 10_000) revert Errors.InvalidInput("cap too high");
        capBps[communityId][token] = capBpsValue;
        emit PolicyUpdated(communityId, bytes32("CAP_BPS"), token, capBpsValue);
    }

    /*//////////////////////////////////////////////////////////////
                          VIEW HELPERS
    //////////////////////////////////////////////////////////////*/

    function maxSpendPerTx(uint256 communityId, address token) public view returns (uint256) {
        address treasuryVault = _getTreasuryVault(communityId);
        uint16 cap = capBps[communityId][token];
        if (treasuryVault == address(0) || cap == 0) return 0;
        uint256 balance = IERC20(token).balanceOf(treasuryVault);
        return (balance * cap) / 10_000;
    }

    function validateSpend(uint256 communityId, address token, address to, uint256 amount) public view returns (bool ok, bytes32 reason) {
        address treasuryVault = _getTreasuryVault(communityId);
        if (treasuryVault == address(0)) return (false, REASON_TREASURY_NOT_SET);
        if (!tokenAllowed[communityId][token]) return (false, REASON_TOKEN_NOT_ALLOWED);
        if (!destinationAllowed[communityId][to]) return (false, REASON_DEST_NOT_ALLOWED);
        uint16 cap = capBps[communityId][token];
        if (cap == 0) return (false, REASON_CAP_NOT_SET);

        uint256 maxSpend = maxSpendPerTx(communityId, token);
        if (amount > maxSpend) return (false, REASON_AMOUNT_EXCEEDS_CAP);

        return (true, REASON_OK);
    }

    /*//////////////////////////////////////////////////////////////
                          TX BUILDERS
    //////////////////////////////////////////////////////////////*/

    function buildERC20TransferTx(uint256 communityId, address token, address to, uint256 amount)
        external
        view
        returns (address target, uint256 value, bytes memory data)
    {
        (bool ok, bytes32 reason) = validateSpend(communityId, token, to, amount);
        if (!ok) revert TxValidationFailed(reason);
        target = token;
        value = 0;
        data = abi.encodeCall(IERC20.transfer, (to, amount));
    }

    /// @notice Build calldata to add or top-up a bounty in RequestHub (no funds move here)
    function buildSetRequestBountyTx(uint256 communityId, address requestHub, uint256 requestId, address token, uint256 amount)
        external
        view
        returns (address target, uint256 value, bytes memory data)
    {
        if (!tokenAllowed[communityId][token]) revert TxValidationFailed(REASON_TOKEN_NOT_ALLOWED);
        if (!destinationAllowed[communityId][requestHub]) revert TxValidationFailed(REASON_DEST_NOT_ALLOWED);
        if (_getTreasuryVault(communityId) == address(0)) revert TxValidationFailed(REASON_TREASURY_NOT_SET);
        target = requestHub;
        value = 0;
        data = abi.encodeCall(RequestHubLike.addBounty, (requestId, token, amount));
    }

    function buildVaultDepositTx(uint256 communityId, address adapter, address token, uint256 amount, bytes calldata params)
        external
        view
        returns (address target, uint256 value, bytes memory data)
    {
        _validateAdapter(communityId, adapter);
        (bool ok, bytes32 reason) = validateSpend(communityId, token, adapter, amount);
        if (!ok) revert TxValidationFailed(reason);
        target = adapter;
        value = 0;
        data = abi.encodeCall(IInvestmentVaultAdapter.deposit, (token, amount, params));
    }

    function buildVaultWithdrawTx(
        uint256 communityId,
        address adapter,
        address token,
        uint256 amount,
        address to,
        bytes calldata params
    ) external view returns (address target, uint256 value, bytes memory data) {
        _validateAdapter(communityId, adapter);
        // destination allowlist applies to receiver of withdrawn funds
        (bool ok, bytes32 reason) = validateSpend(communityId, token, to, amount);
        if (!ok) revert TxValidationFailed(reason);
        target = adapter;
        value = 0;
        data = abi.encodeCall(IInvestmentVaultAdapter.withdraw, (token, amount, to, params));
    }

    /*//////////////////////////////////////////////////////////////
                          INTERNAL HELPERS
    //////////////////////////////////////////////////////////////*/

    function _getTreasuryVault(uint256 communityId) internal view returns (address) {
        return communityRegistry.getCommunityModules(communityId).treasuryVault;
    }

    function _validateAdapter(uint256 communityId, address adapter) internal view {
        if (!vaultAdapterAllowed[communityId][adapter]) revert TxValidationFailed(REASON_ADAPTER_NOT_ALLOWED);
    }
}

interface RequestHubLike {
    function addBounty(uint256 requestId, address token, uint256 amount) external;
}

interface IInvestmentVaultAdapter {
    function deposit(address token, uint256 amount, bytes calldata params) external returns (bytes memory result);
    function withdraw(address token, uint256 amount, address to, bytes calldata params) external returns (bytes memory result);
}
