// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {VerifierPool} from "../contracts/modules/VerifierPool.sol";

contract VerifierPoolTest is Test {
    VerifierPool public verifierPool;
    
    address public governance = makeAddr("governance");
    address public claimsContract = makeAddr("claimsContract");
    address public verifier1 = makeAddr("verifier1");
    address public verifier2 = makeAddr("verifier2");
    address public verifier3 = makeAddr("verifier3");
    address public verifier4 = makeAddr("verifier4");
    
    uint256 public constant MIN_BOND = 100e18;
    
    function setUp() public {
        verifierPool = new VerifierPool(governance);
        
        // Set claims contract
        vm.prank(governance);
        verifierPool.setClaimsContract(claimsContract);
        
        // Give some ETH to verifiers for bonding
        deal(verifier1, 1000 ether);
        deal(verifier2, 1000 ether);
        deal(verifier3, 1000 ether);
        deal(verifier4, 1000 ether);
    }
    
    /*//////////////////////////////////////////////////////////////
                           CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testConstructor() public view {
        assertEq(verifierPool.governance(), governance);
        assertEq(verifierPool.minimumBond(), MIN_BOND);
        assertEq(verifierPool.baseReputation(), 5000); // 50%
        assertEq(verifierPool.getActiveVerifierCount(), 0);
    }
    
    function testConstructorZeroAddressReverts() public {
        vm.expectRevert();
        new VerifierPool(address(0));
    }
    
    /*//////////////////////////////////////////////////////////////
                      VERIFIER REGISTRATION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testRegisterVerifier() public {
        vm.expectEmit(true, true, true, true);
        emit VerifierPool.VerifierRegistered(verifier1, MIN_BOND);
        
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        // Check verifier state
        assertTrue(verifierPool.isVerifier(verifier1));
        assertEq(verifierPool.getActiveVerifierCount(), 1);
        
        VerifierPool.Verifier memory verifier = verifierPool.getVerifier(verifier1);
        assertTrue(verifier.active);
        assertEq(verifier.bondAmount, MIN_BOND);
        assertEq(verifier.reputation, 5000); // base reputation
        assertEq(verifier.totalVerifications, 0);
        assertEq(verifier.successfulVerifications, 0);
        assertEq(verifier.registeredAt, block.timestamp);
        assertEq(verifier.lastActiveAt, block.timestamp);
    }
    
    function testRegisterVerifierInsufficientBond() public {
        vm.prank(verifier1);
        vm.expectRevert();
        verifierPool.registerVerifier{value: MIN_BOND - 1}();
    }
    
    function testRegisterVerifierAlreadyRegistered() public {
        // First registration
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        // Second registration should fail
        vm.prank(verifier1);
        vm.expectRevert();
        verifierPool.registerVerifier{value: MIN_BOND}();
    }
    
    function testRegisterMultipleVerifiers() public {
        // Register verifier1
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        // Register verifier2 with higher bond
        vm.prank(verifier2);
        verifierPool.registerVerifier{value: MIN_BOND * 2}();
        
        // Register verifier3
        vm.prank(verifier3);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        assertEq(verifierPool.getActiveVerifierCount(), 3);
        assertTrue(verifierPool.isVerifier(verifier1));
        assertTrue(verifierPool.isVerifier(verifier2));
        assertTrue(verifierPool.isVerifier(verifier3));
        
        // Check bond amounts
        assertEq(verifierPool.getVerifier(verifier1).bondAmount, MIN_BOND);
        assertEq(verifierPool.getVerifier(verifier2).bondAmount, MIN_BOND * 2);
        assertEq(verifierPool.getVerifier(verifier3).bondAmount, MIN_BOND);
    }
    
    /*//////////////////////////////////////////////////////////////
                           BOND MANAGEMENT TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testIncreaseBond() public {
        // Register verifier
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        uint256 additionalBond = 50e18;
        
        vm.expectEmit(true, true, true, true);
        emit VerifierPool.BondIncreased(verifier1, MIN_BOND, MIN_BOND + additionalBond);
        
        vm.prank(verifier1);
        verifierPool.increaseBond{value: additionalBond}();
        
        VerifierPool.Verifier memory verifier = verifierPool.getVerifier(verifier1);
        assertEq(verifier.bondAmount, MIN_BOND + additionalBond);
    }
    
    function testIncreaseBondNotRegistered() public {
        vm.prank(verifier1);
        vm.expectRevert();
        verifierPool.increaseBond{value: 50e18}();
    }
    
    function testIncreaseBondZeroValue() public {
        // Register verifier
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        vm.prank(verifier1);
        vm.expectRevert();
        verifierPool.increaseBond{value: 0}();
    }
    
    /*//////////////////////////////////////////////////////////////
                        VERIFIER DEACTIVATION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testDeactivateVerifierSelf() public {
        // Register verifier
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        uint256 balanceBefore = verifier1.balance;
        
        vm.expectEmit(true, true, true, true);
        emit VerifierPool.VerifierDeactivated(verifier1, "Self deactivation");
        
        vm.prank(verifier1);
        verifierPool.deactivateVerifier(verifier1, "Self deactivation");
        
        // Check state
        assertFalse(verifierPool.isVerifier(verifier1));
        assertEq(verifierPool.getActiveVerifierCount(), 0);
        assertFalse(verifierPool.getVerifier(verifier1).active);
        assertEq(verifierPool.getVerifier(verifier1).bondAmount, 0);
        
        // Check bond returned
        assertEq(verifier1.balance, balanceBefore + MIN_BOND);
    }
    
    function testDeactivateVerifierByGovernance() public {
        // Register verifier
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        uint256 balanceBefore = verifier1.balance;
        
        vm.expectEmit(true, true, true, true);
        emit VerifierPool.VerifierDeactivated(verifier1, "Governance action");
        
        vm.prank(governance);
        verifierPool.deactivateVerifier(verifier1, "Governance action");
        
        // Check state
        assertFalse(verifierPool.isVerifier(verifier1));
        assertEq(verifier1.balance, balanceBefore + MIN_BOND);
    }
    
    function testDeactivateVerifierUnauthorized() public {
        // Register verifier
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        // Try to deactivate from different address
        vm.prank(verifier2);
        vm.expectRevert();
        verifierPool.deactivateVerifier(verifier1, "Unauthorized");
    }
    
    function testDeactivateVerifierArrayManagement() public {
        // Register 3 verifiers
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        vm.prank(verifier2);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        vm.prank(verifier3);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        assertEq(verifierPool.getActiveVerifierCount(), 3);
        
        // Deactivate middle verifier
        vm.prank(verifier2);
        verifierPool.deactivateVerifier(verifier2, "Test");
        
        assertEq(verifierPool.getActiveVerifierCount(), 2);
        assertFalse(verifierPool.isVerifier(verifier2));
        assertTrue(verifierPool.isVerifier(verifier1));
        assertTrue(verifierPool.isVerifier(verifier3));
    }
    
    /*//////////////////////////////////////////////////////////////
                         JUROR SELECTION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testSelectJurors() public {
        // Register 5 verifiers
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        vm.prank(verifier2);
        verifierPool.registerVerifier{value: MIN_BOND * 2}(); // Higher bond
        
        vm.prank(verifier3);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        vm.prank(verifier4);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        address verifier5 = makeAddr("verifier5");
        deal(verifier5, 1000 ether);
        vm.prank(verifier5);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        uint256 claimId = 1;
        uint256 panelSize = 3;
        uint256 seed = 12345;
        
        vm.expectEmit(true, false, false, false);
        emit VerifierPool.JurorsSelected(claimId, new address[](0), seed);
        
        vm.prank(claimsContract);
        address[] memory selectedJurors = verifierPool.selectJurors(claimId, panelSize, seed);
        
        assertEq(selectedJurors.length, panelSize);
        
        // Check selection was stored
        VerifierPool.JurorSelection memory selection = verifierPool.getJurorSelection(claimId);
        assertTrue(selection.completed);
        assertEq(selection.selectedJurors.length, panelSize);
        assertEq(selection.seed, seed);
        assertEq(selection.selectedAt, block.timestamp);
    }
    
    function testSelectJurorsInsufficientVerifiers() public {
        // Register only 2 verifiers
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        vm.prank(verifier2);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        // Try to select 3 jurors
        vm.prank(claimsContract);
        vm.expectRevert();
        verifierPool.selectJurors(1, 3, 12345);
    }
    
    function testSelectJurorsZeroPanelSize() public {
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        vm.prank(claimsContract);
        vm.expectRevert();
        verifierPool.selectJurors(1, 0, 12345);
    }
    
    function testSelectJurorsAlreadySelected() public {
        // Register verifiers
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        vm.prank(verifier2);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        // Select jurors first time
        vm.prank(claimsContract);
        verifierPool.selectJurors(1, 2, 12345);
        
        // Try to select again for same claim
        vm.prank(claimsContract);
        vm.expectRevert();
        verifierPool.selectJurors(1, 2, 54321);
    }
    
    function testSelectJurorsOnlyClaimsContract() public {
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        vm.expectRevert();
        verifierPool.selectJurors(1, 1, 12345);
    }
    
    /*//////////////////////////////////////////////////////////////
                      REPUTATION UPDATE TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testUpdateReputationsSuccess() public {
        // Register verifiers
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        vm.prank(verifier2);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        // Select jurors
        vm.prank(claimsContract);
        address[] memory selectedJurors = verifierPool.selectJurors(1, 2, 12345);
        
        // Update reputations - both successful
        bool[] memory successful = new bool[](2);
        successful[0] = true;
        successful[1] = true;
        
        vm.expectEmit(true, true, true, true);
        emit VerifierPool.ReputationUpdated(selectedJurors[0], 5000, 5025);
        
        vm.prank(claimsContract);
        verifierPool.updateReputations(1, selectedJurors, successful);
        
        // Check reputation increased
        assertEq(verifierPool.getVerifier(selectedJurors[0]).reputation, 5025);
        assertEq(verifierPool.getVerifier(selectedJurors[0]).successfulVerifications, 1);
        assertEq(verifierPool.getVerifier(selectedJurors[0]).totalVerifications, 1);
    }
    
    function testUpdateReputationsFailure() public {
        // Register verifiers  
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        vm.prank(verifier2);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        // Select jurors
        vm.prank(claimsContract);
        address[] memory selectedJurors = verifierPool.selectJurors(1, 2, 12345);
        
        // Update reputations - both failed
        bool[] memory successful = new bool[](2);
        successful[0] = false;
        successful[1] = false;
        
        vm.expectEmit(true, true, true, true);
        emit VerifierPool.ReputationUpdated(selectedJurors[0], 5000, 4950);
        
        vm.prank(claimsContract);
        verifierPool.updateReputations(1, selectedJurors, successful);
        
        // Check reputation decreased
        assertEq(verifierPool.getVerifier(selectedJurors[0]).reputation, 4950);
        assertEq(verifierPool.getVerifier(selectedJurors[0]).successfulVerifications, 0);
        assertEq(verifierPool.getVerifier(selectedJurors[0]).totalVerifications, 1);
    }
    
    function testUpdateReputationsMismatchedArrays() public {
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        vm.prank(claimsContract);
        address[] memory selectedJurors = verifierPool.selectJurors(1, 1, 12345);
        
        address[] memory jurors = new address[](1);
        jurors[0] = selectedJurors[0];
        
        bool[] memory successful = new bool[](2); // Different length
        
        vm.prank(claimsContract);
        vm.expectRevert();
        verifierPool.updateReputations(1, jurors, successful);
    }
    
    /*//////////////////////////////////////////////////////////////
                         GOVERNANCE TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testUpdateParameters() public {
        uint256 newMinBond = 200e18;
        uint256 newBaseRep = 6000;
        uint256 newDecay = 100;
        uint256 newReward = 50;
        
        vm.expectEmit(true, true, true, true);
        emit VerifierPool.ParametersUpdated(newMinBond, newBaseRep);
        
        vm.prank(governance);
        verifierPool.updateParameters(newMinBond, newBaseRep, newDecay, newReward);
        
        assertEq(verifierPool.minimumBond(), newMinBond);
        assertEq(verifierPool.baseReputation(), newBaseRep);
        assertEq(verifierPool.reputationDecay(), newDecay);
        assertEq(verifierPool.reputationReward(), newReward);
    }
    
    function testUpdateParametersInvalidBaseReputation() public {
        vm.prank(governance);
        vm.expectRevert();
        verifierPool.updateParameters(MIN_BOND, 11000, 50, 25); // Over max reputation
    }
    
    function testUpdateParametersOnlyGovernance() public {
        vm.expectRevert();
        verifierPool.updateParameters(200e18, 6000, 50, 25);
    }
    
    function testUpdateGovernance() public {
        address newGov = makeAddr("newGov");
        
        vm.expectEmit(true, true, true, true);
        emit VerifierPool.GovernanceUpdated(governance, newGov);
        
        vm.prank(governance);
        verifierPool.updateGovernance(newGov);
        
        assertEq(verifierPool.governance(), newGov);
    }
    
    function testUpdateGovernanceZeroAddress() public {
        vm.prank(governance);
        vm.expectRevert();
        verifierPool.updateGovernance(address(0));
    }
    
    function testSetClaimsContract() public {
        address newClaims = makeAddr("newClaims");
        
        vm.expectEmit(true, true, true, true);
        emit VerifierPool.ClaimsContractUpdated(claimsContract, newClaims);
        
        vm.prank(governance);
        verifierPool.setClaimsContract(newClaims);
        
        assertEq(verifierPool.claimsContract(), newClaims);
    }
    
    /*//////////////////////////////////////////////////////////////
                           VIEW FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testGetVerifierWeight() public {
        // Register verifier with base reputation and minimum bond
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        uint256 weight = verifierPool.getVerifierWeight(verifier1);
        
        // Weight = (reputation / 100) * sqrt(bondAmount / minimumBond)
        // = (5000 / 100) * sqrt(MIN_BOND / MIN_BOND) = 50 * 1 = 50
        assertEq(weight, 50);
    }
    
    function testGetVerifierWeightHigherBond() public {
        // Register verifier with 4x minimum bond
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND * 4}();
        
        uint256 weight = verifierPool.getVerifierWeight(verifier1);
        
        // Weight = (5000 / 100) * sqrt(4 * MIN_BOND / MIN_BOND) = 50 * 2 = 100
        assertEq(weight, 100);
    }
    
    function testGetVerifierStats() public {
        // Register verifier
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        (uint256 successRate, bool isActive) = verifierPool.getVerifierStats(verifier1);
        
        assertTrue(isActive);
        assertEq(successRate, 5000); // Should return base reputation when no history
    }
    
    function testGetActiveVerifiers() public {
        // Register multiple verifiers
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        vm.prank(verifier2);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        address[] memory activeVerifiers = verifierPool.getActiveVerifiers();
        assertEq(activeVerifiers.length, 2);
    }
    
    /*//////////////////////////////////////////////////////////////
                        INTEGRATION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testEndToEndVerificationFlow() public {
        // Register 3 verifiers
        vm.prank(verifier1);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        vm.prank(verifier2);
        verifierPool.registerVerifier{value: MIN_BOND * 2}();
        
        vm.prank(verifier3);
        verifierPool.registerVerifier{value: MIN_BOND}();
        
        // Select jurors
        vm.prank(claimsContract);
        address[] memory selectedJurors = verifierPool.selectJurors(1, 3, 12345);
        
        assertEq(selectedJurors.length, 3);
        
        // Simulate verification outcome (2 success, 1 failure)
        bool[] memory successful = new bool[](3);
        successful[0] = true;
        successful[1] = true; 
        successful[2] = false;
        
        // Update reputations
        vm.prank(claimsContract);
        verifierPool.updateReputations(1, selectedJurors, successful);
        
        // Check reputation changes
        for (uint256 i = 0; i < selectedJurors.length; i++) {
            VerifierPool.Verifier memory verifier = verifierPool.getVerifier(selectedJurors[i]);
            assertEq(verifier.totalVerifications, 1);
            
            if (successful[i]) {
                assertEq(verifier.successfulVerifications, 1);
                assertEq(verifier.reputation, 5025); // 5000 + 25
            } else {
                assertEq(verifier.successfulVerifications, 0);
                assertEq(verifier.reputation, 4950); // 5000 - 50
            }
        }
    }
    
    function testEmergencyWithdraw() public {
        // Send some ETH to contract
        deal(address(verifierPool), 10 ether);
        
        address payable recipient = payable(makeAddr("recipient"));
        uint256 amount = 5 ether;
        
        vm.prank(governance);
        verifierPool.emergencyWithdraw(recipient, amount);
        
        assertEq(recipient.balance, amount);
        assertEq(address(verifierPool).balance, 5 ether);
    }
    
    function testEmergencyWithdrawOnlyGovernance() public {
        deal(address(verifierPool), 10 ether);
        
        vm.expectRevert();
        verifierPool.emergencyWithdraw(payable(makeAddr("recipient")), 1 ether);
    }
}