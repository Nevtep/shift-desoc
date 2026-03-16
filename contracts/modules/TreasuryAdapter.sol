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

    uint256 public immutable communityId;

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

    mapping(address => bool) internal _tokenAllowed;
    mapping(address => bool) internal _destinationAllowed;
    mapping(address => bool) internal _vaultAdapterAllowed;
    mapping(address => uint16) internal _capBps; // 0 = disabled

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(address manager, address _communityRegistry, uint256 _communityId) AccessManaged(manager) {
        if (manager == address(0)) revert Errors.ZeroAddress();
        if (_communityRegistry == address(0)) revert Errors.ZeroAddress();
        if (_communityId == 0) revert Errors.InvalidInput("Community ID cannot be zero");
        communityRegistry = CommunityRegistry(_communityRegistry);
        communityId = _communityId;
    }

    /*//////////////////////////////////////////////////////////////
                             ADMIN ACTIONS
    //////////////////////////////////////////////////////////////*/

    function setTokenAllowed(address token, bool allowed) external restricted {
        if (token == address(0)) revert Errors.ZeroAddress();
        _tokenAllowed[token] = allowed;
        emit PolicyUpdated(communityId, bytes32("TOKEN"), token, allowed ? 1 : 0);
    }

    function setDestinationAllowed(address target, bool allowed) external restricted {
        if (target == address(0)) revert Errors.ZeroAddress();
        _destinationAllowed[target] = allowed;
        emit PolicyUpdated(communityId, bytes32("DEST"), target, allowed ? 1 : 0);
    }

    function setVaultAdapterAllowed(address adapter, bool allowed) external restricted {
        if (adapter == address(0)) revert Errors.ZeroAddress();
        _vaultAdapterAllowed[adapter] = allowed;
        emit PolicyUpdated(communityId, bytes32("ADAPTER"), adapter, allowed ? 1 : 0);
    }

    function setCapBps(address token, uint16 capBpsValue) external restricted {
        if (token == address(0)) revert Errors.ZeroAddress();
        if (capBpsValue > 10_000) revert Errors.InvalidInput("cap too high");
        _capBps[token] = capBpsValue;
        emit PolicyUpdated(communityId, bytes32("CAP_BPS"), token, capBpsValue);
    }

    /*//////////////////////////////////////////////////////////////
                          VIEW HELPERS
    //////////////////////////////////////////////////////////////*/

    function maxSpendPerTx(address token) public view returns (uint256) {
        address treasuryVault = _getTreasuryVault();
        uint16 cap = _capBps[token];
        if (treasuryVault == address(0) || cap == 0) return 0;
        uint256 balance = IERC20(token).balanceOf(treasuryVault);
        return (balance * cap) / 10_000;
    }

    function validateSpend(address token, address to, uint256 amount) public view returns (bool ok, bytes32 reason) {
        address treasuryVault = _getTreasuryVault();
        if (treasuryVault == address(0)) return (false, REASON_TREASURY_NOT_SET);
        if (!_tokenAllowed[token]) return (false, REASON_TOKEN_NOT_ALLOWED);
        if (!_destinationAllowed[to]) return (false, REASON_DEST_NOT_ALLOWED);
        uint16 cap = _capBps[token];
        if (cap == 0) return (false, REASON_CAP_NOT_SET);

        uint256 maxSpend = maxSpendPerTx(token);
        if (amount > maxSpend) return (false, REASON_AMOUNT_EXCEEDS_CAP);

        return (true, REASON_OK);
    }

    /*//////////////////////////////////////////////////////////////
                          TX BUILDERS
    //////////////////////////////////////////////////////////////*/

    function buildERC20TransferTx(address token, address to, uint256 amount)
        external
        view
        returns (address target, uint256 value, bytes memory data)
    {
        (bool ok, bytes32 reason) = validateSpend(token, to, amount);
        if (!ok) revert TxValidationFailed(reason);
        target = token;
        value = 0;
        data = abi.encodeCall(IERC20.transfer, (to, amount));
    }

    /// @notice Build calldata to add or top-up a bounty in RequestHub (no funds move here)
    function buildSetRequestBountyTx(address requestHub, uint256 requestId, address token, uint256 amount)
        external
        view
        returns (address target, uint256 value, bytes memory data)
    {
        if (!_tokenAllowed[token]) revert TxValidationFailed(REASON_TOKEN_NOT_ALLOWED);
        if (!_destinationAllowed[requestHub]) revert TxValidationFailed(REASON_DEST_NOT_ALLOWED);
        if (_getTreasuryVault() == address(0)) revert TxValidationFailed(REASON_TREASURY_NOT_SET);
        target = requestHub;
        value = 0;
        data = abi.encodeCall(RequestHubLike.addBounty, (requestId, token, amount));
    }

    function buildVaultDepositTx(address adapter, address token, uint256 amount, bytes calldata params)
        external
        view
        returns (address target, uint256 value, bytes memory data)
    {
        _validateAdapter(adapter);
        (bool ok, bytes32 reason) = validateSpend(token, adapter, amount);
        if (!ok) revert TxValidationFailed(reason);
        target = adapter;
        value = 0;
        data = abi.encodeCall(IInvestmentVaultAdapter.deposit, (token, amount, params));
    }

    function buildVaultWithdrawTx(
        address adapter,
        address token,
        uint256 amount,
        address to,
        bytes calldata params
    ) external view returns (address target, uint256 value, bytes memory data) {
        _validateAdapter(adapter);
        // destination allowlist applies to receiver of withdrawn funds
        (bool ok, bytes32 reason) = validateSpend(token, to, amount);
        if (!ok) revert TxValidationFailed(reason);
        target = adapter;
        value = 0;
        data = abi.encodeCall(IInvestmentVaultAdapter.withdraw, (token, amount, to, params));
    }

    /*//////////////////////////////////////////////////////////////
                          INTERNAL HELPERS
    //////////////////////////////////////////////////////////////*/
    function _getTreasuryVault() internal view returns (address) {
        return communityRegistry.getCommunityModules(communityId).treasuryVault;
    }

    function _validateAdapter(address adapter) internal view {
        if (!_vaultAdapterAllowed[adapter]) revert TxValidationFailed(REASON_ADAPTER_NOT_ALLOWED);
    }

    function tokenAllowed(address token) external view returns (bool) {
        return _tokenAllowed[token];
    }

    function destinationAllowed(address destination) external view returns (bool) {
        return _destinationAllowed[destination];
    }

    function vaultAdapterAllowed(address adapter) external view returns (bool) {
        return _vaultAdapterAllowed[adapter];
    }

    function capBps(address token) external view returns (uint16) {
        return _capBps[token];
    }
}

interface RequestHubLike {
    function addBounty(uint256 requestId, address token, uint256 amount) external;
}

interface IInvestmentVaultAdapter {
    function deposit(address token, uint256 amount, bytes calldata params) external returns (bytes memory result);
    function withdraw(address token, uint256 amount, address to, bytes calldata params) external returns (bytes memory result);
}
