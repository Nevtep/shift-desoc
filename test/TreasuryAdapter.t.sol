// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {IAccessManaged} from "@openzeppelin/contracts/access/manager/IAccessManaged.sol";
import {TreasuryAdapter, RequestHubLike, IInvestmentVaultAdapter} from "contracts/modules/TreasuryAdapter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
    constructor() ERC20("Mock", "MCK") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract CommunityRegistryMock {
    address public treasuryVault;

    struct ModuleAddresses {
        address governor;
        address timelock;
        address requestHub;
        address draftsManager;
        address engagementsManager;
        address valuableActionRegistry;
        address verifierPowerToken;
        address verifierElection;
        address verifierManager;
        address valuableActionSBT;
        address treasuryVault;
        address treasuryAdapter;
        address communityToken;
        address paramController;
    }

    function setTreasuryVault(address vault) external {
        treasuryVault = vault;
    }

    function getCommunityModules(uint256) external view returns (ModuleAddresses memory) {
        return ModuleAddresses({
            governor: address(0),
            timelock: address(0),
            requestHub: address(0),
            draftsManager: address(0),
            engagementsManager: address(0),
            valuableActionRegistry: address(0),
            verifierPowerToken: address(0),
            verifierElection: address(0),
            verifierManager: address(0),
            valuableActionSBT: address(0),
            treasuryVault: treasuryVault,
            treasuryAdapter: address(0),
            communityToken: address(0),
            paramController: address(0)
        });
    }
}

contract RequestHubMock is RequestHubLike {
    event BountyCalled(uint256 requestId, address token, uint256 amount);
    function addBounty(uint256 requestId, address token, uint256 amount) external override {
        emit BountyCalled(requestId, token, amount);
    }
}

contract VaultAdapterMock is IInvestmentVaultAdapter {
    event Deposit(address token, uint256 amount, bytes params);
    event Withdraw(address token, uint256 amount, address to, bytes params);

    function deposit(address token, uint256 amount, bytes calldata params) external override returns (bytes memory) {
        emit Deposit(token, amount, params);
        return "";
    }

    function withdraw(address token, uint256 amount, address to, bytes calldata params) external override returns (bytes memory) {
        emit Withdraw(token, amount, to, params);
        return "";
    }
}

contract TreasuryAdapterTest is Test {
    AccessManager manager;
    TreasuryAdapter adapter;
    CommunityRegistryMock registry;
    TestToken token;
    RequestHubMock requestHub;
    VaultAdapterMock vaultAdapter;

    uint256 constant COMMUNITY_ID = 1;
    address governance = address(this);
    address destination = address(0xBEEF);
    address vault = address(0xFEE1);

    function setUp() public {
        registry = new CommunityRegistryMock();
        token = new TestToken();
        requestHub = new RequestHubMock();
        vaultAdapter = new VaultAdapterMock();
        manager = new AccessManager(governance);
        adapter = new TreasuryAdapter(address(manager), address(registry));

        registry.setTreasuryVault(vault);
        token.mint(vault, 1_000 ether);

        adapter.setTokenAllowed(COMMUNITY_ID, address(token), true);
        adapter.setDestinationAllowed(COMMUNITY_ID, destination, true);
        adapter.setDestinationAllowed(COMMUNITY_ID, address(requestHub), true);
        adapter.setDestinationAllowed(COMMUNITY_ID, address(vaultAdapter), true);
        adapter.setVaultAdapterAllowed(COMMUNITY_ID, address(vaultAdapter), true);
        adapter.setCapBps(COMMUNITY_ID, address(token), 1_000); // 10%
    }

    function testPolicySettersGovernanceOnly() public {
        address attacker = address(0xBAD);
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, attacker));
        adapter.setTokenAllowed(COMMUNITY_ID, address(token), false);
    }

    function testMaxSpendPerTxUsesVaultBalance() public view {
        uint256 maxSpend = adapter.maxSpendPerTx(COMMUNITY_ID, address(token));
        assertEq(maxSpend, 100 ether);
    }

    function testValidateSpendHappyPath() public view {
        (bool ok, bytes32 reason) = adapter.validateSpend(COMMUNITY_ID, address(token), destination, 50 ether);
        assertTrue(ok);
        assertEq(reason, adapter.REASON_OK());
    }

    function testValidateSpendReasons() public {
        registry.setTreasuryVault(address(0));
        (bool okTreasury, bytes32 reasonTreasury) = adapter.validateSpend(COMMUNITY_ID, address(token), destination, 1 ether);
        assertFalse(okTreasury);
        assertEq(reasonTreasury, adapter.REASON_TREASURY_NOT_SET());

        registry.setTreasuryVault(vault);
        (bool okToken, bytes32 reasonToken) = adapter.validateSpend(COMMUNITY_ID, address(0xDEAD), destination, 1 ether);
        assertFalse(okToken);
        assertEq(reasonToken, adapter.REASON_TOKEN_NOT_ALLOWED());

        (bool okDest, bytes32 reasonDest) = adapter.validateSpend(COMMUNITY_ID, address(token), address(0xBAAD), 1 ether);
        assertFalse(okDest);
        assertEq(reasonDest, adapter.REASON_DEST_NOT_ALLOWED());

        adapter.setCapBps(COMMUNITY_ID, address(token), 0);
        (bool okCap, bytes32 reasonCap) = adapter.validateSpend(COMMUNITY_ID, address(token), destination, 1 ether);
        assertFalse(okCap);
        assertEq(reasonCap, adapter.REASON_CAP_NOT_SET());

        adapter.setCapBps(COMMUNITY_ID, address(token), 500); // 5%
        (bool okAmt, bytes32 reasonAmt) = adapter.validateSpend(COMMUNITY_ID, address(token), destination, 60 ether);
        assertFalse(okAmt);
        assertEq(reasonAmt, adapter.REASON_AMOUNT_EXCEEDS_CAP());
    }

    function testBuildErc20TransferTxSuccess() public view {
        (address target, uint256 value, bytes memory data) = adapter.buildERC20TransferTx(COMMUNITY_ID, address(token), destination, 50 ether);
        assertEq(target, address(token));
        assertEq(value, 0);
        bytes memory expected = abi.encodeCall(IERC20.transfer, (destination, 50 ether));
        assertEq(data, expected);
    }

    function testBuildErc20TransferTxRevertsOnValidation() public {
        registry.setTreasuryVault(address(0));
        vm.expectRevert(abi.encodeWithSelector(TreasuryAdapter.TxValidationFailed.selector, adapter.REASON_TREASURY_NOT_SET()));
        adapter.buildERC20TransferTx(COMMUNITY_ID, address(token), destination, 10 ether);
    }

    function testBuildRequestBountyTx() public view {
        (address target, uint256 value, bytes memory data) = adapter.buildSetRequestBountyTx(COMMUNITY_ID, address(requestHub), 1, address(token), 20 ether);
        assertEq(target, address(requestHub));
        assertEq(value, 0);
        bytes memory expected = abi.encodeCall(RequestHubLike.addBounty, (1, address(token), 20 ether));
        assertEq(data, expected);
    }

    function testBuildRequestBountyTxRevertsWhenNotAllowed() public {
        adapter.setDestinationAllowed(COMMUNITY_ID, address(requestHub), false);
        vm.expectRevert(abi.encodeWithSelector(TreasuryAdapter.TxValidationFailed.selector, adapter.REASON_DEST_NOT_ALLOWED()));
        adapter.buildSetRequestBountyTx(COMMUNITY_ID, address(requestHub), 1, address(token), 20 ether);
    }

    function testBuildVaultDepositTx() public view {
        (address target, uint256 value, bytes memory data) = adapter.buildVaultDepositTx(COMMUNITY_ID, address(vaultAdapter), address(token), 50 ether, bytes("params"));
        assertEq(target, address(vaultAdapter));
        assertEq(value, 0);
        bytes memory expected = abi.encodeCall(IInvestmentVaultAdapter.deposit, (address(token), 50 ether, bytes("params")));
        assertEq(data, expected);
    }

    function testBuildVaultDepositTxRevertsAdapterNotAllowed() public {
        adapter.setVaultAdapterAllowed(COMMUNITY_ID, address(vaultAdapter), false);
        vm.expectRevert(abi.encodeWithSelector(TreasuryAdapter.TxValidationFailed.selector, adapter.REASON_ADAPTER_NOT_ALLOWED()));
        adapter.buildVaultDepositTx(COMMUNITY_ID, address(vaultAdapter), address(token), 10 ether, bytes("params"));
    }

    function testBuildVaultWithdrawTx() public {
        adapter.setDestinationAllowed(COMMUNITY_ID, address(this), true);
        (address target, uint256 value, bytes memory data) = adapter.buildVaultWithdrawTx(COMMUNITY_ID, address(vaultAdapter), address(token), 50 ether, address(this), bytes("params"));
        assertEq(target, address(vaultAdapter));
        assertEq(value, 0);
        bytes memory expected = abi.encodeCall(IInvestmentVaultAdapter.withdraw, (address(token), 50 ether, address(this), bytes("params")));
        assertEq(data, expected);
    }
}
