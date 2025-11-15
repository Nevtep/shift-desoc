// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "forge-std/console.sol";

import {VerifierPool} from "contracts/modules/VerifierPool.sol";
import {Errors} from "contracts/libs/Errors.sol";

contract VerifierPoolTest is Test {
    VerifierPool public verifierPool;
    
    address public governance = address(0x1111);
    address public claimsContract = address(0x2222);
    address public verifier1 = address(0x3333);
    address public verifier2 = address(0x4444);
    address public verifier3 = address(0x5555);
    address public nonVerifier = address(0x6666);
    
    uint256 public constant MIN_BOND = 100e18;
    uint256 public constant BASE_REPUTATION = 5000;
    uint256 public constant MAX_REPUTATION = 10000;
    
    event VerifierRegistered(address indexed verifier, uint256 bondAmount);
    event VerifierDeactivated(address indexed verifier, string reason);
    event BondIncreased(address indexed verifier, uint256 oldAmount, uint256 newAmount);
    event BondWithdrawn(address indexed verifier, uint256 amount);
    event JurorsSelected(uint256 indexed claimId, address[] jurors, uint256 seed);
    event ReputationUpdated(address indexed verifier, uint256 oldReputation, uint256 newReputation);
    event GovernanceUpdated(address indexed oldGov, address indexed newGov);
    event ClaimsContractUpdated(address indexed oldClaims, address indexed newClaims);
    
    function setUp() public {
        verifierPool = new VerifierPool(governance);
        
        // Fund test accounts
        vm.deal(verifier1, 1000 ether);
        vm.deal(verifier2, 1000 ether);
        vm.deal(verifier3, 1000 ether);
        vm.deal(governance, 1000 ether);
        
        // Set claims contract
        vm.prank(governance);
        verifierPool.setClaimsContract(claimsContract);
    }

    /// @notice Test deployment and initial state
    function test_deployment() public {
        assertEq(verifierPool.governance(), governance);
        assertEq(verifierPool.claimsContract(), claimsContract);
        assertEq(verifierPool.minimumBond(), MIN_BOND);
        assertEq(verifierPool.baseReputation(), BASE_REPUTATION);
        assertEq(verifierPool.maxReputation(), MAX_REPUTATION);
        assertEq(verifierPool.getActiveVerifierCount(), 0);
    }

    /// @notice Test deployment with zero address governance
    function test_deployment_zeroGovernance() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        new VerifierPool(address(0));
    }

    /// @notice Test successful verifier registration
    function test_registerVerifier_success() public {
        vm.expectEmit(true, false, false, true);
        emit VerifierRegistered(verifier1, MIN_BOND);
        
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        // Verify state
        assertTrue(verifierPool.isVerifier(verifier1));
        assertEq(verifierPool.getActiveVerifierCount(), 1);
        
        VerifierPool.Verifier memory verifier = verifierPool.getVerifier(verifier1);
        assertTrue(verifier.active);
        assertEq(verifier.bondAmount, MIN_BOND);
        assertEq(verifier.reputation, BASE_REPUTATION);
        assertEq(verifier.totalVerifications, 0);
        assertEq(verifier.successfulVerifications, 0);
        assertGt(verifier.registeredAt, 0);
        assertGt(verifier.lastActiveAt, 0);
    }

    /// @notice Test registration with insufficient bond
    function test_registerVerifier_insufficientBond() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Insufficient bond amount"));
        
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND - 1}();
    }

    /// @notice Test registration when already registered
    function test_registerVerifier_alreadyRegistered() public {
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Already registered"));
        
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
    }

    /// @notice Test bond increase
    function test_increaseBond_success() public {
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        uint256 additionalBond = 50e18;
        
        vm.expectEmit(true, false, false, true);
        emit BondIncreased(verifier1, MIN_BOND, MIN_BOND + additionalBond);
        
        vm.prank(verifier1);
        verifierPool.increaseBond{value: additionalBond}();
        
        VerifierPool.Verifier memory verifier = verifierPool.getVerifier(verifier1);
        assertEq(verifier.bondAmount, MIN_BOND + additionalBond);
    }

    /// @notice Test bond increase for non-verifier
    function test_increaseBond_notRegistered() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Not a registered verifier"));
        
        vm.prank(verifier1);
        verifierPool.increaseBond{value: 50e18}();
    }

    /// @notice Test bond increase with zero amount
    function test_increaseBond_zeroAmount() public {
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "No bond provided"));
        
        vm.prank(verifier1);
        verifierPool.increaseBond{value: 0}();
    }

    /// @notice Test self-deactivation
    function test_deactivateVerifier_self() public {
        uint256 initialBalance = verifier1.balance;
        
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        vm.expectEmit(true, false, false, false);
        emit VerifierDeactivated(verifier1, "Self deactivation");
        
        vm.expectEmit(true, false, false, true);
        emit BondWithdrawn(verifier1, MIN_BOND);
        
        vm.prank(verifier1);
        verifierPool.deactivateVerifier(verifier1, "Self deactivation");
        
        // Verify state
        assertFalse(verifierPool.isVerifier(verifier1));
        assertEq(verifierPool.getActiveVerifierCount(), 0);
        assertEq(verifier1.balance, initialBalance); // Bond returned
        
        VerifierPool.Verifier memory verifier = verifierPool.getVerifier(verifier1);
        assertFalse(verifier.active);
        assertEq(verifier.bondAmount, 0);
    }

    /// @notice Test governance deactivation
    function test_deactivateVerifier_governance() public {
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        vm.expectEmit(true, false, false, false);
        emit VerifierDeactivated(verifier1, "Governance action");
        
        vm.prank(governance);
        verifierPool.deactivateVerifier(verifier1, "Governance action");
        
        assertFalse(verifierPool.isVerifier(verifier1));
    }

    /// @notice Test unauthorized deactivation
    function test_deactivateVerifier_unauthorized() public {
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, nonVerifier));
        
        vm.prank(nonVerifier);
        verifierPool.deactivateVerifier(verifier1, "Unauthorized");
    }

    /// @notice Test deactivation of non-registered verifier
    function test_deactivateVerifier_notRegistered() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Not a registered verifier"));
        
        vm.prank(verifier1);
        verifierPool.deactivateVerifier(verifier1, "Test");
    }

    /// @notice Test double deactivation
    function test_deactivateVerifier_alreadyDeactivated() public {
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        vm.prank(verifier1);
        verifierPool.deactivateVerifier(verifier1, "First deactivation");
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Not a registered verifier"));
        
        vm.prank(governance);
        verifierPool.deactivateVerifier(verifier1, "Second deactivation");
    }

    /// @notice Test juror selection with sufficient verifiers
    function test_selectJurors_success() public {
        // Register multiple verifiers
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        vm.prank(verifier2);
        verifierPool.registerVerifier{value: MIN_BOND * 2}(); // Higher bond
        
        vm.prank(verifier3);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        uint256 claimId = 1;
        uint256 panelSize = 2;
        uint256 seed = 12345;
        
        vm.expectEmit(true, false, false, false);
        emit JurorsSelected(claimId, new address[](0), seed);
        
        vm.prank(claimsContract);
        address[] memory selectedJurors = verifierPool.selectJurors(claimId, panelSize, seed);
        
        assertEq(selectedJurors.length, panelSize);
        
        // Verify selection was recorded
        VerifierPool.JurorSelection memory selection = verifierPool.getJurorSelection(claimId);
        assertTrue(selection.completed);
        assertEq(selection.seed, seed);
        assertEq(selection.selectedJurors.length, panelSize);
    }

    /// @notice Test juror selection with insufficient verifiers
    function test_selectJurors_insufficientVerifiers() public {
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InsufficientVerifiers.selector, 1, 3));
        
        vm.prank(claimsContract);
        verifierPool.selectJurors(1, 3, 12345);
    }

    /// @notice Test juror selection with zero panel size
    function test_selectJurors_zeroPanelSize() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Panel size cannot be zero"));
        
        vm.prank(claimsContract);
        verifierPool.selectJurors(1, 0, 12345);
    }

    /// @notice Test juror selection unauthorized call
    function test_selectJurors_unauthorized() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, nonVerifier));
        
        vm.prank(nonVerifier);
        verifierPool.selectJurors(1, 2, 12345);
    }

    /// @notice Test duplicate juror selection
    function test_selectJurors_duplicate() public {
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        vm.prank(claimsContract);
        verifierPool.selectJurors(1, 1, 12345);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Jurors already selected for claim"));
        
        vm.prank(claimsContract);
        verifierPool.selectJurors(1, 1, 54321);
    }

    /// @notice Test reputation update for successful verification
    function test_updateReputations_success() public {
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        vm.prank(verifier2);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        // Select jurors first
        vm.prank(claimsContract);
        verifierPool.selectJurors(1, 2, 12345);
        
        address[] memory jurors = new address[](2);
        jurors[0] = verifier1;
        jurors[1] = verifier2;
        
        bool[] memory successful = new bool[](2);
        successful[0] = true;
        successful[1] = false;
        
        vm.expectEmit(true, false, false, true);
        emit ReputationUpdated(verifier1, BASE_REPUTATION, BASE_REPUTATION + 25);
        
        vm.expectEmit(true, false, false, true);
        emit ReputationUpdated(verifier2, BASE_REPUTATION, BASE_REPUTATION - 50);
        
        vm.prank(claimsContract);
        verifierPool.updateReputations(1, jurors, successful);
        
        // Verify reputation changes
        VerifierPool.Verifier memory v1 = verifierPool.getVerifier(verifier1);
        assertEq(v1.reputation, BASE_REPUTATION + 25);
        assertEq(v1.totalVerifications, 1);
        assertEq(v1.successfulVerifications, 1);
        
        VerifierPool.Verifier memory v2 = verifierPool.getVerifier(verifier2);
        assertEq(v2.reputation, BASE_REPUTATION - 50);
        assertEq(v2.totalVerifications, 1);
        assertEq(v2.successfulVerifications, 0);
    }

    /// @notice Test reputation update with mismatched arrays
    function test_updateReputations_mismatchedArrays() public {
        address[] memory jurors = new address[](2);
        bool[] memory successful = new bool[](1);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Arrays length mismatch"));
        
        vm.prank(claimsContract);
        verifierPool.updateReputations(1, jurors, successful);
    }

    /// @notice Test reputation update without juror selection
    function test_updateReputations_noSelection() public {
        address[] memory jurors = new address[](1);
        bool[] memory successful = new bool[](1);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "No juror selection for claim"));
        
        vm.prank(claimsContract);
        verifierPool.updateReputations(1, jurors, successful);
    }

    /// @notice Test parameter updates
    function test_updateParameters_success() public {
        uint256 newMinBond = 200e18;
        uint256 newBaseRep = 6000;
        uint256 newDecay = 100;
        uint256 newReward = 50;
        
        vm.prank(governance);
        verifierPool.updateParameters(newMinBond, newBaseRep, newDecay, newReward);
        
        assertEq(verifierPool.minimumBond(), newMinBond);
        assertEq(verifierPool.baseReputation(), newBaseRep);
        assertEq(verifierPool.reputationDecay(), newDecay);
        assertEq(verifierPool.reputationReward(), newReward);
    }

    /// @notice Test parameter updates with invalid values
    function test_updateParameters_invalidBaseReputation() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Base reputation too high"));
        
        vm.prank(governance);
        verifierPool.updateParameters(100e18, MAX_REPUTATION + 1, 50, 25);
    }

    /// @notice Test parameter updates unauthorized
    function test_updateParameters_unauthorized() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, nonVerifier));
        
        vm.prank(nonVerifier);
        verifierPool.updateParameters(200e18, 6000, 100, 50);
    }

    /// @notice Test governance update
    function test_updateGovernance_success() public {
        address newGov = address(0x7777);
        
        vm.expectEmit(true, true, false, true);
        emit GovernanceUpdated(governance, newGov);
        
        vm.prank(governance);
        verifierPool.updateGovernance(newGov);
        
        assertEq(verifierPool.governance(), newGov);
    }

    /// @notice Test governance update with zero address
    function test_updateGovernance_zeroAddress() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        
        vm.prank(governance);
        verifierPool.updateGovernance(address(0));
    }

    /// @notice Test claims contract update
    function test_setClaimsContract_success() public {
        address newClaims = address(0x8888);
        
        vm.expectEmit(true, true, false, true);
        emit ClaimsContractUpdated(claimsContract, newClaims);
        
        vm.prank(governance);
        verifierPool.setClaimsContract(newClaims);
        
        assertEq(verifierPool.claimsContract(), newClaims);
    }

    /// @notice Test view functions
    function test_viewFunctions() public {
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND * 2}();
        
        // Test getVerifierWeight
        uint256 weight = verifierPool.getVerifierWeight(verifier1);
        assertGt(weight, 0);
        
        // Test getVerifierStats
        (uint256 successRate, bool isActive) = verifierPool.getVerifierStats(verifier1);
        assertEq(successRate, BASE_REPUTATION);
        assertTrue(isActive);
        
        // Test getActiveVerifiers
        address[] memory activeVerifiers = verifierPool.getActiveVerifiers();
        assertEq(activeVerifiers.length, 1);
        assertEq(activeVerifiers[0], verifier1);
    }

    /// @notice Test verifier weight calculation
    function test_getVerifierWeight_calculation() public {
        // Register verifier with higher bond
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND * 4}(); // 4x minimum bond
        
        uint256 weight1 = verifierPool.getVerifierWeight(verifier1);
        
        // Register verifier with minimum bond
        vm.prank(verifier2);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        uint256 weight2 = verifierPool.getVerifierWeight(verifier2);
        
        // Higher bond should give higher weight
        assertGt(weight1, weight2);
    }

    /// @notice Test emergency withdraw
    function test_emergencyWithdraw_success() public {
        // Register verifier to have some ETH in contract
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        address payable recipient = payable(address(0x9999));
        uint256 amount = MIN_BOND / 2;
        
        vm.prank(governance);
        verifierPool.emergencyWithdraw(recipient, amount);
        
        assertEq(recipient.balance, amount);
    }

    /// @notice Test emergency withdraw unauthorized
    function test_emergencyWithdraw_unauthorized() public {
        address payable recipient = payable(address(0x9999));
        
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, nonVerifier));
        
        vm.prank(nonVerifier);
        verifierPool.emergencyWithdraw(recipient, 1 ether);
    }

    /// @notice Test emergency withdraw zero address
    function test_emergencyWithdraw_zeroAddress() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        
        vm.prank(governance);
        verifierPool.emergencyWithdraw(payable(address(0)), 1 ether);
    }

    /// @notice Test edge cases for reputation updates
    function test_reputationLimits() public {
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        address[] memory jurors = new address[](1);
        jurors[0] = verifier1;
        bool[] memory successful = new bool[](1);
        successful[0] = true;
        
        // Multiple successful verifications to test max reputation cap
        for (uint256 i = 0; i < 500; i++) {
            // Each reputation update needs a separate claim ID with juror selection
            vm.prank(claimsContract);
            verifierPool.selectJurors(i + 1, 1, 12345 + i);
            
            vm.prank(claimsContract);
            verifierPool.updateReputations(i + 1, jurors, successful);
        }
        
        VerifierPool.Verifier memory verifier = verifierPool.getVerifier(verifier1);
        assertEq(verifier.reputation, MAX_REPUTATION); // Should cap at maximum
    }

    /// @notice Test multiple verifier registration and array management
    function test_multipleVerifiersArrayManagement() public {
        address[] memory testVerifiers = new address[](5);
        testVerifiers[0] = address(0xA001);
        testVerifiers[1] = address(0xA002);
        testVerifiers[2] = address(0xA003);
        testVerifiers[3] = address(0xA004);
        testVerifiers[4] = address(0xA005);
        
        // Fund and register all verifiers
        for (uint256 i = 0; i < testVerifiers.length; i++) {
            vm.deal(testVerifiers[i], 1000 ether);
            vm.prank(testVerifiers[i]);
            verifierPool.registerVerifier{value: MIN_BOND}();
        }
        
        assertEq(verifierPool.getActiveVerifierCount(), 5);
        
        // Deactivate middle verifier to test array management
        vm.prank(testVerifiers[2]);
        verifierPool.deactivateVerifier(testVerifiers[2], "Test deactivation");
        
        assertEq(verifierPool.getActiveVerifierCount(), 4);
        assertFalse(verifierPool.isVerifier(testVerifiers[2]));
        
        // Verify remaining verifiers are still active
        assertTrue(verifierPool.isVerifier(testVerifiers[0]));
        assertTrue(verifierPool.isVerifier(testVerifiers[1]));
        assertTrue(verifierPool.isVerifier(testVerifiers[3]));
        assertTrue(verifierPool.isVerifier(testVerifiers[4]));
    }

    /// @notice Test receive function
    function test_receiveETH() public {
        uint256 amount = 1 ether;
        
        vm.deal(address(this), amount);
        (bool success, ) = address(verifierPool).call{value: amount}("");
        
        assertTrue(success);
        assertEq(address(verifierPool).balance, amount);
    }

    /// @notice Test weighted random selection determinism
    function test_weightedSelectionDeterminism() public {
        // Register verifiers
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        vm.prank(verifier2);
        verifierPool.registerVerifier{value: MIN_BOND * 2}();
        
        vm.prank(verifier3);
        verifierPool.registerVerifier{value: MIN_BOND * 3}();
        
        uint256 claimId1 = 1;
        uint256 claimId2 = 2;
        uint256 seed = 12345;
        
        // Same seed should produce same results
        vm.prank(claimsContract);
        address[] memory selection1 = verifierPool.selectJurors(claimId1, 2, seed);
        
        vm.prank(claimsContract);
        address[] memory selection2 = verifierPool.selectJurors(claimId2, 2, seed);
        
        // Results should be identical for same seed
        assertEq(selection1.length, selection2.length);
        for (uint256 i = 0; i < selection1.length; i++) {
            assertEq(selection1[i], selection2[i]);
        }
    }
}