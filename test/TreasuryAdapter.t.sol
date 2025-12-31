// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TreasuryAdapter} from "contracts/modules/TreasuryAdapter.sol";
import {Errors} from "contracts/libs/Errors.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
    constructor() ERC20("Mock", "MCK") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract TreasuryAdapterTest is Test {
    TreasuryAdapter adapter;
    TestToken token;

    address governance = address(this);
    address caller = address(0xCA11);
    address recipient = address(0xBEEF);

    function setUp() public {
        adapter = new TreasuryAdapter(governance);
        token = new TestToken();

        adapter.setAuthorizedCaller(caller, true);
        token.mint(address(adapter), 1_000 ether);
    }

    function testWhitelistUpdate() public {
        address other = address(0xABCD);
        vm.expectEmit(true, true, false, true);
        emit TreasuryAdapter.CallerWhitelistUpdated(other, true);
        adapter.setAuthorizedCaller(other, true);
        assertTrue(adapter.isAuthorizedCaller(other));
    }

    function testWhitelistOnlyGovernance() public {
        vm.prank(caller);
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, caller));
        adapter.setAuthorizedCaller(address(1), true);
    }

    function testPayoutBountyHappyPath() public {
        vm.prank(caller);
        vm.expectEmit(true, true, true, true);
        emit TreasuryAdapter.BountyPaid(address(token), 100 ether, recipient, caller);
        adapter.payoutBounty(address(token), 100 ether, recipient);
        assertEq(token.balanceOf(recipient), 100 ether);
    }

    function testPayoutBountyRequiresWhitelist() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, address(this)));
        adapter.payoutBounty(address(token), 1 ether, recipient);
    }

    function testPayoutBountyInsufficientBalance() public {
        vm.prank(caller);
        vm.expectRevert(abi.encodeWithSelector(Errors.InsufficientBalance.selector, address(adapter), 2_000 ether, 1_000 ether));
        adapter.payoutBounty(address(token), 2_000 ether, recipient);
    }
}
