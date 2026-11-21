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
    string public constant BASE_URI = "https://api.shift.com/metadata/";
    string public constant REASON_CID = "QmTestReasonHash";
    
    event VerifierSetUpdated(uint256 indexed communityId, uint256 verifierCount, uint256 totalPower, string reasonCID);
    event VerifiersBanned(uint256 indexed communityId, address[] offenders, string reasonCID);
    event VerifierUnbanned(uint256 indexed communityId, address verifier, string reasonCID);
    event VerifierPowerAdjusted(uint256 indexed communityId, address indexed verifier, uint256 oldPower, uint256 newPower, string reasonCID);
    
    function setUp() public {
        accessManager = new AccessManager(verifier1); // temporary admin; updated below
        vpt = new VerifierPowerToken1155(address(accessManager), BASE_URI, COMMUNITY_ID_1);
        verifierElection = new VerifierElection(address(accessManager), address(vpt), COMMUNITY_ID_1);
        
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
        vptSelectors[0] = bytes4(keccak256("initializeCommunity(string)"));
        vptSelectors[1] = bytes4(keccak256("mint(address,uint256,string)"));
        vptSelectors[2] = bytes4(keccak256("burn(address,uint256,string)"));
        vptSelectors[3] = bytes4(keccak256("batchMint(address[],uint256[],string)"));
        vptSelectors[4] = bytes4(keccak256("batchBurn(address[],uint256[],string)"));
        vptSelectors[5] = bytes4(keccak256("adminTransfer(address,address,uint256,string)"));
        accessManager.setTargetFunctionRole(address(vpt), vptSelectors, accessManager.ADMIN_ROLE());
        accessManager.grantRole(accessManager.ADMIN_ROLE(), address(verifierElection), 0);
        vm.stopPrank();

        // Initialize communities
        vm.startPrank(timelock);
        vpt.initializeCommunity("metadata1");
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
        new VerifierElection(address(0), address(vpt), COMMUNITY_ID_1);
    }
    
    function testConstructorZeroVPTReverts() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        new VerifierElection(address(accessManager), address(0), COMMUNITY_ID_1);

        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Invalid communityId"));
        new VerifierElection(address(accessManager), address(vpt), 0);
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
        verifierElection.setVerifierSet( verifiers, weights, REASON_CID);
        
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
        ) = verifierElection.getVerifierSet();
        
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
        verifierElection.setVerifierSet( verifiers, weights, REASON_CID);
    }
    
    function testSetVerifierSetArrayLengthMismatchReverts() public {
        address[] memory verifiers = new address[](2);
        uint256[] memory weights = new uint256[](3);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Array length mismatch"));
        vm.prank(timelock);
        verifierElection.setVerifierSet( verifiers, weights, REASON_CID);
    }
    
    function testSetVerifierSetEmptyArrayReverts() public {
        address[] memory verifiers = new address[](0);
        uint256[] memory weights = new uint256[](0);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Empty verifier set"));
        vm.prank(timelock);
        verifierElection.setVerifierSet( verifiers, weights, REASON_CID);
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
        verifierElection.setVerifierSet( verifiers, weights, REASON_CID);
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
        verifierElection.setVerifierSet( verifiers1, weights1, REASON_CID);
        
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
        verifierElection.setVerifierSet( verifiers2, weights2, REASON_CID);
        
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
        verifierElection.setVerifierSet( verifiers1, weights1, REASON_CID);
        
        // Remove verifier2 from the set
        address[] memory verifiers2 = new address[](2);
        verifiers2[0] = verifier1;
        verifiers2[1] = verifier3;
        
        uint256[] memory weights2 = new uint256[](2);
        weights2[0] = 100;
        weights2[1] = 200;
        
        vm.prank(timelock);
        verifierElection.setVerifierSet( verifiers2, weights2, REASON_CID);
        
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
        verifierElection.setVerifierSet( verifiers, weights, REASON_CID);
        
        // Ban verifier1 and verifier2
        address[] memory offenders = new address[](2);
        offenders[0] = verifier1;
        offenders[1] = verifier2;
        
        vm.expectEmit(true, false, false, true);
        emit VerifiersBanned(COMMUNITY_ID_1, offenders, REASON_CID);
        
        vm.prank(timelock);
        verifierElection.banVerifiers( offenders, REASON_CID);
        
        // Check that their power was burned and they are marked as banned
        assertEq(vpt.balanceOf(verifier1, COMMUNITY_ID_1), 0);
        assertEq(vpt.balanceOf(verifier2, COMMUNITY_ID_1), 0);
        assertEq(vpt.balanceOf(verifier3, COMMUNITY_ID_1), 200); // Unchanged
        
        (bool isBanned1, uint64 bannedAt1) = verifierElection.getBanInfo( verifier1);
        (bool isBanned2, ) = verifierElection.getBanInfo( verifier2);
        (bool isBanned3, ) = verifierElection.getBanInfo( verifier3);
        
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
        verifierElection.banVerifiers( offenders, REASON_CID);
    }
    
    function testBanVerifiersEmptyArrayReverts() public {
        address[] memory offenders = new address[](0);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "No offenders provided"));
        vm.prank(timelock);
        verifierElection.banVerifiers( offenders, REASON_CID);
    }
    
    function testUnbanVerifier() public {
        // Setup: create verifier set and ban someone
        vm.startPrank(timelock);
        
        address[] memory verifiers = new address[](1);
        verifiers[0] = verifier1;
        uint256[] memory weights = new uint256[](1);
        weights[0] = 100;
        
        verifierElection.setVerifierSet( verifiers, weights, REASON_CID);
        
        address[] memory offenders = new address[](1);
        offenders[0] = verifier1;
        verifierElection.banVerifiers( offenders, REASON_CID);
        
        // Now unban
        vm.expectEmit(true, true, false, true);
        emit VerifierUnbanned(COMMUNITY_ID_1, verifier1, REASON_CID);
        
        verifierElection.unbanVerifier( verifier1, REASON_CID);
        vm.stopPrank();
        
        (bool isBanned, uint64 bannedAt) = verifierElection.getBanInfo( verifier1);
        assertFalse(isBanned);
        assertEq(bannedAt, 0);
    }
    
    function testUnbanVerifierNotBannedReverts() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Verifier not banned"));
        vm.prank(timelock);
        verifierElection.unbanVerifier( verifier1, REASON_CID);
    }
    
    function testSetVerifierSetBannedVerifierReverts() public {
        // Setup: ban a verifier first
        vm.startPrank(timelock);
        
        address[] memory verifiers1 = new address[](1);
        verifiers1[0] = verifier1;
        uint256[] memory weights1 = new uint256[](1);
        weights1[0] = 100;
        
        verifierElection.setVerifierSet( verifiers1, weights1, REASON_CID);
        
        address[] memory offenders = new address[](1);
        offenders[0] = verifier1;
        verifierElection.banVerifiers( offenders, REASON_CID);
        vm.stopPrank();
        
        // Try to assign power to banned verifier
        address[] memory verifiers2 = new address[](1);
        verifiers2[0] = verifier1; // Still banned
        uint256[] memory weights2 = new uint256[](1);
        weights2[0] = 200;
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Cannot assign power to banned verifier"));
        vm.prank(timelock);
        verifierElection.setVerifierSet( verifiers2, weights2, REASON_CID);
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
        
        verifierElection.setVerifierSet( verifiers, weights, REASON_CID);
        
        vm.expectEmit(true, true, false, true);
        emit VerifierPowerAdjusted(COMMUNITY_ID_1, verifier1, 100, 200, REASON_CID);
        
        verifierElection.adjustVerifierPower( verifier1, 200, REASON_CID);
        vm.stopPrank();
        
        assertEq(vpt.balanceOf(verifier1, COMMUNITY_ID_1), 200);
        
        (, , uint256 totalPower, ,) = verifierElection.getVerifierSet();
        assertEq(totalPower, 200);
    }
    
    function testAdjustVerifierPowerBannedReverts() public {
        // Setup and ban
        vm.startPrank(timelock);
        
        address[] memory verifiers = new address[](1);
        verifiers[0] = verifier1;
        uint256[] memory weights = new uint256[](1);
        weights[0] = 100;
        
        verifierElection.setVerifierSet( verifiers, weights, REASON_CID);
        
        address[] memory offenders = new address[](1);
        offenders[0] = verifier1;
        verifierElection.banVerifiers( offenders, REASON_CID);
        vm.stopPrank();
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Cannot adjust power of banned verifier"));
        vm.prank(timelock);
        verifierElection.adjustVerifierPower( verifier1, 200, REASON_CID);
    }
    
    /*//////////////////////////////////////////////////////////////
                           VIEW FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testGetVerifierStatus() public {
        // Test non-verifier first
        (bool isVerifier1, uint256 power1, bool isBanned1) = verifierElection.getVerifierStatus( verifier1);
        assertFalse(isVerifier1);
        assertEq(power1, 0);
        assertFalse(isBanned1);
        
        // Setup verifier
        vm.startPrank(timelock);
        
        address[] memory verifiers = new address[](1);
        verifiers[0] = verifier1;
        uint256[] memory weights = new uint256[](1);
        weights[0] = 100;
        
        verifierElection.setVerifierSet( verifiers, weights, REASON_CID);
        vm.stopPrank();
        
        (bool isVerifier2, uint256 power2, bool isBanned2) = verifierElection.getVerifierStatus( verifier1);
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
        
        verifierElection.setVerifierSet( verifiers, weights, REASON_CID);
        
        // Ban verifier2
        address[] memory offenders = new address[](1);
        offenders[0] = verifier2;
        verifierElection.banVerifiers( offenders, REASON_CID);
        vm.stopPrank();
        
        (address[] memory eligible, uint256[] memory eligiblePowers) = verifierElection.getEligibleVerifiers();
        
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
        
        verifierElection.setVerifierSet( verifiers, weights, REASON_CID);
        
        // Burn one verifier's power to test active vs total count
        verifierElection.adjustVerifierPower( verifier2, 0, REASON_CID);
        vm.stopPrank();
        
        (
            uint256 totalVerifiers,
            uint256 activeVerifiers,
            uint256 totalPower,
            uint256 averagePower
        ) = verifierElection.getCommunityStats();
        
        assertEq(totalVerifiers, 2); // token roster: zero-power members are not counted (SHI-135)
        assertEq(activeVerifiers, 2); // Only those with power > 0
        assertEq(totalPower, 300); // 100 + 0 + 200
        assertEq(averagePower, 150); // 300 / 2 active verifiers
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
        verifierElection.setVerifierSet( verifiers, weights, REASON_CID);
        
        // Verify all verifiers got the correct power
        for (uint256 i = 0; i < numVerifiers; i++) {
            assertEq(vpt.balanceOf(verifiers[i], COMMUNITY_ID_1), weights[i]);
        }
        
        (, , uint256 totalPower, ,) = verifierElection.getVerifierSet();
        assertEq(totalPower, expectedTotalPower);
    }

    /*//////////////////////////////////////////////////////////////
              SHI-135: TOKEN ROSTER IS THE SINGLE CANONICAL ROSTER
    //////////////////////////////////////////////////////////////*/

    function _seedSet() internal {
        address[] memory a = new address[](2);
        a[0] = verifier1;
        a[1] = verifier2;
        uint256[] memory w = new uint256[](2);
        w[0] = 100;
        w[1] = 150;
        vm.prank(timelock);
        verifierElection.setVerifierSet(a, w, REASON_CID);
    }

    function _assertRosterMatchesToken(uint256 expectedCount) internal view {
        (address[] memory setAddrs, uint256[] memory setPowers, uint256 setTotal,,) = verifierElection.getVerifierSet();
        (address[] memory elig, uint256[] memory eligPowers) = verifierElection.getEligibleVerifiers();
        (uint256 totalVerifiers, uint256 activeVerifiers, uint256 totalPower,) = verifierElection.getCommunityStats();
        assertEq(setAddrs.length, expectedCount, "set length");
        assertEq(setPowers.length, expectedCount, "set powers length");
        assertEq(totalVerifiers, expectedCount, "stats total");
        assertEq(activeVerifiers, expectedCount, "stats active");
        assertEq(totalPower, vpt.totalSupply(), "stats power == token supply");
        assertEq(setTotal, vpt.totalSupply(), "set total == token supply");
        for (uint256 i = 0; i < setAddrs.length; i++) {
            assertEq(setPowers[i], vpt.balanceOf(setAddrs[i], COMMUNITY_ID_1));
        }
        // no banned addresses in these scenarios, so eligibility == roster
        assertEq(elig.length, expectedCount, "eligible length");
        for (uint256 i = 0; i < elig.length; i++) {
            assertEq(eligPowers[i], vpt.balanceOf(elig[i], COMMUNITY_ID_1));
        }
    }

    function _contains(address[] memory list, address who) internal pure returns (bool) {
        for (uint256 i = 0; i < list.length; i++) if (list[i] == who) return true;
        return false;
    }

    function testAdjustNewAddressIsEligibleListedAndCounted() public {
        _seedSet();
        vm.prank(timelock);
        verifierElection.adjustVerifierPower(verifier3, 70, REASON_CID);

        (address[] memory elig, uint256[] memory powers) = verifierElection.getEligibleVerifiers();
        assertTrue(_contains(elig, verifier3));
        for (uint256 i = 0; i < elig.length; i++) if (elig[i] == verifier3) assertEq(powers[i], 70);
        (address[] memory setAddrs,,,,) = verifierElection.getVerifierSet();
        assertTrue(_contains(setAddrs, verifier3));
        _assertRosterMatchesToken(3);
    }

    function testAdjustToZeroRemovesAndRegrantRestores() public {
        _seedSet();
        vm.startPrank(timelock);
        verifierElection.adjustVerifierPower(verifier2, 0, REASON_CID);
        vm.stopPrank();
        (address[] memory elig,) = verifierElection.getEligibleVerifiers();
        assertFalse(_contains(elig, verifier2));
        (address[] memory setAddrs,,,,) = verifierElection.getVerifierSet();
        assertFalse(_contains(setAddrs, verifier2));
        _assertRosterMatchesToken(1);

        vm.prank(timelock);
        verifierElection.adjustVerifierPower(verifier2, 40, REASON_CID);
        _assertRosterMatchesToken(2);
    }

    function testBanUnbanRegrantLifecycle() public {
        _seedSet();
        address[] memory off = new address[](1);
        off[0] = verifier2;
        vm.prank(timelock);
        verifierElection.banVerifiers(off, REASON_CID);
        _assertRosterMatchesToken(1);
        (address[] memory setAddrs,,,,) = verifierElection.getVerifierSet();
        assertFalse(_contains(setAddrs, verifier2));

        vm.prank(timelock);
        verifierElection.unbanVerifier(verifier2, REASON_CID);
        _assertRosterMatchesToken(1); // unban alone does not re-add

        vm.prank(timelock);
        verifierElection.adjustVerifierPower(verifier2, 60, REASON_CID);
        _assertRosterMatchesToken(2);
    }

    function testDirectMintMakesEligibleAndAdjustUsesTokenBalance() public {
        _seedSet();
        vm.prank(timelock);
        vpt.mint(verifier3, 50, REASON_CID);
        _assertRosterMatchesToken(3);

        // adjust must use the token balance as old power (no underflow / drift)
        vm.expectEmit(true, true, false, true);
        emit VerifierPowerAdjusted(COMMUNITY_ID_1, verifier3, 50, 10, REASON_CID);
        vm.prank(timelock);
        verifierElection.adjustVerifierPower(verifier3, 10, REASON_CID);
        _assertRosterMatchesToken(3);
    }

    function testDirectBatchMintMakesEligible() public {
        _seedSet();
        address[] memory to = new address[](2);
        to[0] = verifier3;
        to[1] = verifier4;
        uint256[] memory amts = new uint256[](2);
        amts[0] = 5;
        amts[1] = 6;
        vm.prank(timelock);
        vpt.batchMint(to, amts, REASON_CID);
        _assertRosterMatchesToken(4);
    }

    function testAdminTransferDestinationIsEligible() public {
        _seedSet();
        vm.prank(timelock);
        vpt.adminTransfer(verifier1, verifier3, 100, REASON_CID);
        (address[] memory elig,) = verifierElection.getEligibleVerifiers();
        assertTrue(_contains(elig, verifier3));
        assertFalse(_contains(elig, verifier1));
        _assertRosterMatchesToken(2);
    }

    function testBannedAddressWithDirectMintStaysIneligible() public {
        _seedSet();
        address[] memory off = new address[](1);
        off[0] = verifier3;
        vm.startPrank(timelock);
        verifierElection.banVerifiers(off, REASON_CID);
        vpt.mint(verifier3, 50, REASON_CID);
        vm.stopPrank();
        (address[] memory elig,) = verifierElection.getEligibleVerifiers();
        assertFalse(_contains(elig, verifier3));
        (, , bool isBanned) = verifierElection.getVerifierStatus(verifier3);
        assertTrue(isBanned);
    }

    function testSetVerifierSetBurnsDirectlyMintedHolderNotInNewSet() public {
        _seedSet();
        vm.prank(timelock);
        vpt.mint(verifier3, 50, REASON_CID);

        address[] memory a = new address[](1);
        a[0] = verifier1;
        uint256[] memory w = new uint256[](1);
        w[0] = 80;
        vm.expectEmit(true, false, false, true);
        emit VerifierSetUpdated(COMMUNITY_ID_1, 1, 80, REASON_CID);
        vm.prank(timelock);
        verifierElection.setVerifierSet(a, w, REASON_CID);

        assertEq(vpt.balanceOf(verifier2, COMMUNITY_ID_1), 0);
        assertEq(vpt.balanceOf(verifier3, COMMUNITY_ID_1), 0);
        assertEq(vpt.balanceOf(verifier1, COMMUNITY_ID_1), 80);
        _assertRosterMatchesToken(1);
    }
}
