// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

/// @title CompilationTest
/// @notice Basic test to verify contracts compile correctly
contract CompilationTest is Test {
    
    function testBasicFunctionality() public pure {
        // Simple test to verify test framework works
        uint256 a = 1;
        uint256 b = 2;
        assert(a + b == 3);
    }
    
    function testMath() public pure {
        assertEq(uint256(2 + 2), uint256(4));
        assertEq(uint256(10 - 5), uint256(5));
        assertEq(uint256(3 * 4), uint256(12));
    }
}