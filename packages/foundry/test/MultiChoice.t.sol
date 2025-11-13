// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "forge-std/Test.sol";
import {CountingMultiChoice} from "../../contracts/core/CountingMultiChoice.sol";

contract MultiChoiceTest is Test {
    CountingMultiChoice mc;
    function setUp() public { mc = new CountingMultiChoice(); mc.enableMulti(1, 3); }
    function test_castVoteMulti_basic() public {
        uint256;
        w[0]=6e17; w[1]=3e17; w[2]=1e17;
        mc.castVoteMulti(1, address(this), 100 ether, w, "ok");
        uint256[] memory tot = mc.optionTotals(1);
        assertEq(tot[0], 60 ether); assertEq(tot[1], 30 ether); assertEq(tot[2], 10 ether);
    }
}
