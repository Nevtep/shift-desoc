// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {IAccessManaged} from "@openzeppelin/contracts/access/manager/IAccessManaged.sol";
import {VerifierElection} from "../contracts/modules/VerifierElection.sol";
import {VerifierPowerToken1155} from "../contracts/tokens/VerifierPowerToken1155.sol";
import {Errors} from "../contracts/libs/Errors.sol";

contract VerifierElectionTest is Test {
    VerifierElection public verifierElection;
    VerifierPowerToken1155 public vpt;
    AccessManager public accessManager;
    
    address public timelock = makeAddr("timelock");
    address public verifier1 = makeAddr("verifier1");
    address public verifier2 = makeAddr("verifier2");
    address public verifier3 = makeAddr("verifier3");
    address public verifier4 = makeAddr("verifier4");
    address public unauthorizedUser = makeAddr("unauthorized");
    
    uint256 public constant COMMUNITY_ID_1 = 1;
    uint256 public constant COMMUNITY_ID_2 = 2;
    string public constant BASE_URI = "https://api.shift.com/metadata/";
    string public constant REASON_CID = "QmTestReasonHash";
    
    event VerifierSetUpdated(uint256 indexed communityId, uint256 verifierCount, uint256 totalPower, string reasonCID);
    event VerifiersBanned(uint256 indexed communityId, address[] offenders, string reasonCID);
    event VerifierUnbanned(uint256 indexed communityId, address verifier, string reasonCID);
    event VerifierPowerAdjusted(uint256 indexed communityId, address indexed verifier, uint256 oldPower, uint256 newPower, string reasonCID);
    
    function setUp() public {
        accessManager = new AccessManager(verifier1); // temporary admin; updated below
        vpt = new VerifierPowerToken1155(address(accessManager), BASE_URI);
        verifierElection = new VerifierElection(address(accessManager), address(vpt));
        
        vm.startPrank(verifier1);
        accessManager.grantRole(accessManager.ADMIN_ROLE(), timelock, 0);
        bytes4[] memory selectors = new bytes4[](4);
        selectors[0] = verifierElection.setVerifierSet.selector;
        selectors[1] = verifierElection.banVerifiers.selector;
        selectors[2] = verifierElection.unbanVerifier.selector;
        selectors[3] = verifierElection.adjustVerifierPower.selector;
        accessManager.setTargetFunctionRole(address(verifierElection), selectors, accessManager.ADMIN_ROLE());

        // Configure VPT function roles
        bytes4[] memory vptSelectors = new bytes4[](6);
        vptSelectors[0] = vpt.initializeCommunity.selector;
        vptSelectors[1] = vpt.mint.selector;
        vptSelectors[2] = vpt.burn.selector;
        vptSelectors[3] = vpt.batchMint.selector;
        vptSelectors[4] = vpt.batchBurn.selector;
        vptSelectors[5] = vpt.adminTransfer.selector;
        accessManager.setTargetFunctionRole(address(vpt), vptSelectors, accessManager.ADMIN_ROLE());
        accessManager.grantRole(accessManager.ADMIN_ROLE(), address(verifierElection), 0);
        vm.stopPrank();

        // Initialize communities
        vm.startPrank(timelock);
        vpt.initializeCommunity(COMMUNITY_ID_1, "metadata1");
        vpt.initializeCommunity(COMMUNITY_ID_2, "metadata2");
        vm.stopPrank();
    }
    
    /*//////////////////////////////////////////////////////////////
                           CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testConstructor() public view {
        assertEq(address(verifierElection.vpt()), address(vpt));
    }
    
    function testConstructorZeroTimelockReverts() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        new VerifierElection(address(0), address(vpt));
    }
    
    function testConstructorZeroVPTReverts() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        new VerifierElection(address(accessManager), address(0));
    }
    
    /*//////////////////////////////////////////////////////////////
                        VERIFIER SET MANAGEMENT TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testSetVerifierSet() public {
        address[] memory verifiers = new address[](3);
        verifiers[0] = verifier1;
        verifiers[1] = verifier2;
        verifiers[2] = verifier3;
        
        uint256[] memory weights = new uint256[](3);
        weights[0] = 100;
        weights[1] = 150;
        weights[2] = 200;
        
        vm.expectEmit(true, false, false, true);
        emit VerifierSetUpdated(COMMUNITY_ID_1, 3, 450, REASON_CID);
        
        vm.prank(timelock);
        verifierElection.setVerifierSet(COMMUNITY_ID_1, verifiers, weights, REASON_CID);
        
        // Verify balances were set correctly
        assertEq(vpt.balanceOf(verifier1, COMMUNITY_ID_1), 100);
        assertEq(vpt.balanceOf(verifier2, COMMUNITY_ID_1), 150);
        assertEq(vpt.balanceOf(verifier3, COMMUNITY_ID_1), 200);
        
        // Verify verifier set data
        (
            address[] memory returnedVerifiers,
            uint256[] memory powers,
            uint256 totalPower,
            uint64 lastUpdated,
            string memory lastReasonCID
        ) = verifierElection.getVerifierSet(COMMUNITY_ID_1);
        
        assertEq(returnedVerifiers.length, 3);
        assertEq(returnedVerifiers[0], verifier1);
        assertEq(powers[0], 100);
        assertEq(totalPower, 450);
        assertEq(lastReasonCID, REASON_CID);
        assertTrue(lastUpdated > 0);
    }
    
    function testSetVerifierSetNonTimelockReverts() public {
        address[] memory verifiers = new address[](1);
        verifiers[0] = verifier1;
        uint256[] memory weights = new uint256[](1);
        weights[0] = 100;
        
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, unauthorizedUser));
        vm.prank(unauthorizedUser);
        verifierElection.setVerifierSet(COMMUNITY_ID_1, verifiers, weights, REASON_CID);
    }
    
    function testSetVerifierSetArrayLengthMismatchReverts() public {
        address[] memory verifiers = new address[](2);
        uint256[] memory weights = new uint256[](3);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Array length mismatch"));
        vm.prank(timelock);
        verifierElection.setVerifierSet(COMMUNITY_ID_1, verifiers, weights, REASON_CID);
    }
    
    function testSetVerifierSetEmptyArrayReverts() public {
        address[] memory verifiers = new address[](0);
        uint256[] memory weights = new uint256[](0);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Empty verifier set"));
        vm.prank(timelock);
        verifierElection.setVerifierSet(COMMUNITY_ID_1, verifiers, weights, REASON_CID);
    }
    
    function testSetVerifierSetZeroPowerReverts() public {
        address[] memory verifiers = new address[](2);
        verifiers[0] = verifier1;
        verifiers[1] = verifier2;
        
        uint256[] memory weights = new uint256[](2);
        weights[0] = 100;
        weights[1] = 0; // Zero power not allowed
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Zero power not allowed"));
        vm.prank(timelock);
        verifierElection.setVerifierSet(COMMUNITY_ID_1, verifiers, weights, REASON_CID);
    }
    
    function testSetVerifierSetUpdateExisting() public {
        // First set
        address[] memory verifiers1 = new address[](2);
        verifiers1[0] = verifier1;
        verifiers1[1] = verifier2;
        
        uint256[] memory weights1 = new uint256[](2);
        weights1[0] = 100;
        weights1[1] = 150;
        
        vm.prank(timelock);
        verifierElection.setVerifierSet(COMMUNITY_ID_1, verifiers1, weights1, REASON_CID);
        
        // Update set - change weights and add new verifier
        address[] memory verifiers2 = new address[](3);
        verifiers2[0] = verifier1;
        verifiers2[1] = verifier2;
        verifiers2[2] = verifier3;
        
        uint256[] memory weights2 = new uint256[](3);
        weights2[0] = 200; // Increase verifier1's power
        weights2[1] = 100; // Decrease verifier2's power
        weights2[2] = 300; // New verifier3
        
        vm.prank(timelock);
        verifierElection.setVerifierSet(COMMUNITY_ID_1, verifiers2, weights2, REASON_CID);
        
        assertEq(vpt.balanceOf(verifier1, COMMUNITY_ID_1), 200);
        assertEq(vpt.balanceOf(verifier2, COMMUNITY_ID_1), 100);
        assertEq(vpt.balanceOf(verifier3, COMMUNITY_ID_1), 300);
    }
    
    function testSetVerifierSetRemoveVerifier() public {
        // Set initial verifiers
        address[] memory verifiers1 = new address[](3);
        verifiers1[0] = verifier1;
        verifiers1[1] = verifier2;
        verifiers1[2] = verifier3;
        
        uint256[] memory weights1 = new uint256[](3);
        weights1[0] = 100;
        weights1[1] = 150;
        weights1[2] = 200;
        
        vm.prank(timelock);
        verifierElection.setVerifierSet(COMMUNITY_ID_1, verifiers1, weights1, REASON_CID);
        
        // Remove verifier2 from the set
        address[] memory verifiers2 = new address[](2);
        verifiers2[0] = verifier1;
        verifiers2[1] = verifier3;
        
        uint256[] memory weights2 = new uint256[](2);
        weights2[0] = 100;
        weights2[1] = 200;
        
        vm.prank(timelock);
        verifierElection.setVerifierSet(COMMUNITY_ID_1, verifiers2, weights2, REASON_CID);
        
        // verifier2 should have zero power now
        assertEq(vpt.balanceOf(verifier1, COMMUNITY_ID_1), 100);
        assertEq(vpt.balanceOf(verifier2, COMMUNITY_ID_1), 0);
        assertEq(vpt.balanceOf(verifier3, COMMUNITY_ID_1), 200);
    }
    
    /*//////////////////////////////////////////////////////////////
                            BAN/UNBAN TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testBanVerifiers() public {
        // Setup: create verifier set first
        address[] memory verifiers = new address[](3);
        verifiers[0] = verifier1;
        verifiers[1] = verifier2;
        verifiers[2] = verifier3;
        
        uint256[] memory weights = new uint256[](3);
        weights[0] = 100;
        weights[1] = 150;
        weights[2] = 200;
        
        vm.prank(timelock);
        verifierElection.setVerifierSet(COMMUNITY_ID_1, verifiers, weights, REASON_CID);
        
        // Ban verifier1 and verifier2
        address[] memory offenders = new address[](2);
        offenders[0] = verifier1;
        offenders[1] = verifier2;
        
        vm.expectEmit(true, false, false, true);
        emit VerifiersBanned(COMMUNITY_ID_1, offenders, REASON_CID);
        
        vm.prank(timelock);
        verifierElection.banVerifiers(COMMUNITY_ID_1, offenders, REASON_CID);
        
        // Check that their power was burned and they are marked as banned
        assertEq(vpt.balanceOf(verifier1, COMMUNITY_ID_1), 0);
        assertEq(vpt.balanceOf(verifier2, COMMUNITY_ID_1), 0);
        assertEq(vpt.balanceOf(verifier3, COMMUNITY_ID_1), 200); // Unchanged
        
        (bool isBanned1, uint64 bannedAt1) = verifierElection.getBanInfo(COMMUNITY_ID_1, verifier1);
        (bool isBanned2, ) = verifierElection.getBanInfo(COMMUNITY_ID_1, verifier2);
        (bool isBanned3, ) = verifierElection.getBanInfo(COMMUNITY_ID_1, verifier3);
        
        assertTrue(isBanned1);
        assertTrue(isBanned2);
        assertFalse(isBanned3);
        assertTrue(bannedAt1 > 0);
    }
    
    function testBanVerifiersNonTimelockReverts() public {
        address[] memory offenders = new address[](1);
        offenders[0] = verifier1;
        
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, unauthorizedUser));
        vm.prank(unauthorizedUser);
        verifierElection.banVerifiers(COMMUNITY_ID_1, offenders, REASON_CID);
    }
    
    function testBanVerifiersEmptyArrayReverts() public {
        address[] memory offenders = new address[](0);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "No offenders provided"));
        vm.prank(timelock);
        verifierElection.banVerifiers(COMMUNITY_ID_1, offenders, REASON_CID);
    }
    
    function testUnbanVerifier() public {
        // Setup: create verifier set and ban someone
        vm.startPrank(timelock);
        
        address[] memory verifiers = new address[](1);
        verifiers[0] = verifier1;
        uint256[] memory weights = new uint256[](1);
        weights[0] = 100;
        
        verifierElection.setVerifierSet(COMMUNITY_ID_1, verifiers, weights, REASON_CID);
        
        address[] memory offenders = new address[](1);
        offenders[0] = verifier1;
        verifierElection.banVerifiers(COMMUNITY_ID_1, offenders, REASON_CID);
        
        // Now unban
        vm.expectEmit(true, true, false, true);
        emit VerifierUnbanned(COMMUNITY_ID_1, verifier1, REASON_CID);
        
        verifierElection.unbanVerifier(COMMUNITY_ID_1, verifier1, REASON_CID);
        vm.stopPrank();
        
        (bool isBanned, uint64 bannedAt) = verifierElection.getBanInfo(COMMUNITY_ID_1, verifier1);
        assertFalse(isBanned);
        assertEq(bannedAt, 0);
    }
    
    function testUnbanVerifierNotBannedReverts() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Verifier not banned"));
        vm.prank(timelock);
        verifierElection.unbanVerifier(COMMUNITY_ID_1, verifier1, REASON_CID);
    }
    
    function testSetVerifierSetBannedVerifierReverts() public {
        // Setup: ban a verifier first
        vm.startPrank(timelock);
        
        address[] memory verifiers1 = new address[](1);
        verifiers1[0] = verifier1;
        uint256[] memory weights1 = new uint256[](1);
        weights1[0] = 100;
        
        verifierElection.setVerifierSet(COMMUNITY_ID_1, verifiers1, weights1, REASON_CID);
        
        address[] memory offenders = new address[](1);
        offenders[0] = verifier1;
        verifierElection.banVerifiers(COMMUNITY_ID_1, offenders, REASON_CID);
        vm.stopPrank();
        
        // Try to assign power to banned verifier
        address[] memory verifiers2 = new address[](1);
        verifiers2[0] = verifier1; // Still banned
        uint256[] memory weights2 = new uint256[](1);
        weights2[0] = 200;
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Cannot assign power to banned verifier"));
        vm.prank(timelock);
        verifierElection.setVerifierSet(COMMUNITY_ID_1, verifiers2, weights2, REASON_CID);
    }
    
    /*//////////////////////////////////////////////////////////////
                       INDIVIDUAL POWER ADJUSTMENT TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testAdjustVerifierPower() public {
        // Setup: create verifier set first
        vm.startPrank(timelock);
        
        address[] memory verifiers = new address[](1);
        verifiers[0] = verifier1;
        uint256[] memory weights = new uint256[](1);
        weights[0] = 100;
        
        verifierElection.setVerifierSet(COMMUNITY_ID_1, verifiers, weights, REASON_CID);
        
        vm.expectEmit(true, true, false, true);
        emit VerifierPowerAdjusted(COMMUNITY_ID_1, verifier1, 100, 200, REASON_CID);
        
        verifierElection.adjustVerifierPower(COMMUNITY_ID_1, verifier1, 200, REASON_CID);
        vm.stopPrank();
        
        assertEq(vpt.balanceOf(verifier1, COMMUNITY_ID_1), 200);
        
        (, , uint256 totalPower, ,) = verifierElection.getVerifierSet(COMMUNITY_ID_1);
        assertEq(totalPower, 200);
    }
    
    function testAdjustVerifierPowerBannedReverts() public {
        // Setup and ban
        vm.startPrank(timelock);
        
        address[] memory verifiers = new address[](1);
        verifiers[0] = verifier1;
        uint256[] memory weights = new uint256[](1);
        weights[0] = 100;
        
        verifierElection.setVerifierSet(COMMUNITY_ID_1, verifiers, weights, REASON_CID);
        
        address[] memory offenders = new address[](1);
        offenders[0] = verifier1;
        verifierElection.banVerifiers(COMMUNITY_ID_1, offenders, REASON_CID);
        vm.stopPrank();
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Cannot adjust power of banned verifier"));
        vm.prank(timelock);
        verifierElection.adjustVerifierPower(COMMUNITY_ID_1, verifier1, 200, REASON_CID);
    }
    
    /*//////////////////////////////////////////////////////////////
                           VIEW FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testGetVerifierStatus() public {
        // Test non-verifier first
        (bool isVerifier1, uint256 power1, bool isBanned1) = verifierElection.getVerifierStatus(COMMUNITY_ID_1, verifier1);
        assertFalse(isVerifier1);
        assertEq(power1, 0);
        assertFalse(isBanned1);
        
        // Setup verifier
        vm.startPrank(timelock);
        
        address[] memory verifiers = new address[](1);
        verifiers[0] = verifier1;
        uint256[] memory weights = new uint256[](1);
        weights[0] = 100;
        
        verifierElection.setVerifierSet(COMMUNITY_ID_1, verifiers, weights, REASON_CID);
        vm.stopPrank();
        
        (bool isVerifier2, uint256 power2, bool isBanned2) = verifierElection.getVerifierStatus(COMMUNITY_ID_1, verifier1);
        assertTrue(isVerifier2);
        assertEq(power2, 100);
        assertFalse(isBanned2);
    }
    
    function testGetEligibleVerifiers() public {
        // Setup mixed verifier set (some banned, some active)
        vm.startPrank(timelock);
        
        address[] memory verifiers = new address[](3);
        verifiers[0] = verifier1;
        verifiers[1] = verifier2;
        verifiers[2] = verifier3;
        
        uint256[] memory weights = new uint256[](3);
        weights[0] = 100;
        weights[1] = 150;
        weights[2] = 200;
        
        verifierElection.setVerifierSet(COMMUNITY_ID_1, verifiers, weights, REASON_CID);
        
        // Ban verifier2
        address[] memory offenders = new address[](1);
        offenders[0] = verifier2;
        verifierElection.banVerifiers(COMMUNITY_ID_1, offenders, REASON_CID);
        vm.stopPrank();
        
        (address[] memory eligible, uint256[] memory eligiblePowers) = verifierElection.getEligibleVerifiers(COMMUNITY_ID_1);
        
        assertEq(eligible.length, 2); // Only verifier1 and verifier3 should be eligible
        assertEq(eligible[0], verifier1);
        assertEq(eligible[1], verifier3);
        assertEq(eligiblePowers[0], 100);
        assertEq(eligiblePowers[1], 200);
    }
    
    function testGetCommunityStats() public {
        vm.startPrank(timelock);
        
        address[] memory verifiers = new address[](3);
        verifiers[0] = verifier1;
        verifiers[1] = verifier2;
        verifiers[2] = verifier3;
        
        uint256[] memory weights = new uint256[](3);
        weights[0] = 100;
        weights[1] = 150;
        weights[2] = 200;
        
        verifierElection.setVerifierSet(COMMUNITY_ID_1, verifiers, weights, REASON_CID);
        
        // Burn one verifier's power to test active vs total count
        verifierElection.adjustVerifierPower(COMMUNITY_ID_1, verifier2, 0, REASON_CID);
        vm.stopPrank();
        
        (
            uint256 totalVerifiers,
            uint256 activeVerifiers,
            uint256 totalPower,
            uint256 averagePower
        ) = verifierElection.getCommunityStats(COMMUNITY_ID_1);
        
        assertEq(totalVerifiers, 3); // All verifiers in the set
        assertEq(activeVerifiers, 2); // Only those with power > 0
        assertEq(totalPower, 300); // 100 + 0 + 200
        assertEq(averagePower, 150); // 300 / 2 active verifiers
    }
    
    /*//////////////////////////////////////////////////////////////
                         MULTI-COMMUNITY TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testMultipleCommunities() public {
        vm.startPrank(timelock);
        
        // Set verifiers for community 1
        address[] memory verifiers1 = new address[](2);
        verifiers1[0] = verifier1;
        verifiers1[1] = verifier2;
        
        uint256[] memory weights1 = new uint256[](2);
        weights1[0] = 100;
        weights1[1] = 150;
        
        verifierElection.setVerifierSet(COMMUNITY_ID_1, verifiers1, weights1, REASON_CID);
        
        // Set different verifiers for community 2
        address[] memory verifiers2 = new address[](2);
        verifiers2[0] = verifier2; // Same verifier in both communities
        verifiers2[1] = verifier3;
        
        uint256[] memory weights2 = new uint256[](2);
        weights2[0] = 200;
        weights2[1] = 300;
        
        verifierElection.setVerifierSet(COMMUNITY_ID_2, verifiers2, weights2, REASON_CID);
        vm.stopPrank();
        
        // Verify verifier2 has different power in different communities
        assertEq(vpt.balanceOf(verifier2, COMMUNITY_ID_1), 150);
        assertEq(vpt.balanceOf(verifier2, COMMUNITY_ID_2), 200);
        
        // Verify verifier1 only has power in community 1
        assertEq(vpt.balanceOf(verifier1, COMMUNITY_ID_1), 100);
        assertEq(vpt.balanceOf(verifier1, COMMUNITY_ID_2), 0);
        
        // Ban verifier2 in community 1 only
        address[] memory offenders = new address[](1);
        offenders[0] = verifier2;
        
        vm.prank(timelock);
        verifierElection.banVerifiers(COMMUNITY_ID_1, offenders, REASON_CID);
        
        // Check ban status is community-specific
        (bool isBanned1, ) = verifierElection.getBanInfo(COMMUNITY_ID_1, verifier2);
        (bool isBanned2, ) = verifierElection.getBanInfo(COMMUNITY_ID_2, verifier2);
        
        assertTrue(isBanned1); // Banned in community 1
        assertFalse(isBanned2); // Not banned in community 2
        
        // Power should be zero in community 1 but intact in community 2
        assertEq(vpt.balanceOf(verifier2, COMMUNITY_ID_1), 0);
        assertEq(vpt.balanceOf(verifier2, COMMUNITY_ID_2), 200);
    }
    
    /*//////////////////////////////////////////////////////////////
                            FUZZ TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testFuzzSetVerifierSet(uint8 numVerifiers, uint256 basePower) public {
        vm.assume(numVerifiers > 0 && numVerifiers <= 10);
        vm.assume(basePower > 0 && basePower <= 1000);
        
        address[] memory verifiers = new address[](numVerifiers);
        uint256[] memory weights = new uint256[](numVerifiers);
        uint256 expectedTotalPower = 0;
        
        for (uint256 i = 0; i < numVerifiers; i++) {
            verifiers[i] = makeAddr(string(abi.encodePacked("verifier", i)));
            weights[i] = basePower + i; // Each verifier gets slightly different power
            expectedTotalPower += weights[i];
        }
        
        vm.prank(timelock);
        verifierElection.setVerifierSet(COMMUNITY_ID_1, verifiers, weights, REASON_CID);
        
        // Verify all verifiers got the correct power
        for (uint256 i = 0; i < numVerifiers; i++) {
            assertEq(vpt.balanceOf(verifiers[i], COMMUNITY_ID_1), weights[i]);
        }
        
        (, , uint256 totalPower, ,) = verifierElection.getVerifierSet(COMMUNITY_ID_1);
        assertEq(totalPower, expectedTotalPower);
    }
}