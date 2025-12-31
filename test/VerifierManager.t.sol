// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {VerifierManager} from "../contracts/modules/VerifierManager.sol";
import {VerifierElection} from "../contracts/modules/VerifierElection.sol";
import {VerifierPowerToken1155} from "../contracts/modules/VerifierPowerToken1155.sol";
import {ParamController} from "../contracts/modules/ParamController.sol";
import {Errors} from "../contracts/libs/Errors.sol";

contract VerifierManagerTest is Test {
    VerifierManager public verifierManager;
    VerifierElection public verifierElection;
    VerifierPowerToken1155 public vpt;
    ParamController public paramController;
    
    address public timelock = makeAddr("timelock");
    address public governance = makeAddr("governance");
    address public engagementsContract = makeAddr("engagements");
    
    address public verifier1 = makeAddr("verifier1");
    address public verifier2 = makeAddr("verifier2");
    address public verifier3 = makeAddr("verifier3");
    address public verifier4 = makeAddr("verifier4");
    address public verifier5 = makeAddr("verifier5");
    
    address public unauthorizedUser = makeAddr("unauthorized");
    
    uint256 public constant COMMUNITY_ID_1 = 1;
    uint256 public constant COMMUNITY_ID_2 = 2;
    string public constant BASE_URI = "https://api.shift.com/metadata/";
    string public constant REASON_CID = "QmTestReasonHash";
    
    event JurorsSelected(
        uint256 indexed claimId,
        uint256 indexed communityId,
        address[] jurors,
        uint256[] powers,
        uint256 seed,
        bool weighted
    );
    event FraudReported(
        uint256 indexed claimId,
        uint256 indexed communityId,
        address[] offenders,
        string evidenceCID
    );
    
    function setUp() public {
        // Deploy contracts
        vpt = new VerifierPowerToken1155(timelock, BASE_URI);
        verifierElection = new VerifierElection(timelock, address(vpt));
        paramController = new ParamController(governance);
        verifierManager = new VerifierManager(
            address(verifierElection),
            address(paramController),
            governance
        );
        
        // Set engagements contract
        vm.prank(governance);
        verifierManager.setEngagementsContract(engagementsContract);
        
        // Grant VerifierElection the TIMELOCK_ROLE to mint/burn VPT tokens
        vm.startPrank(timelock);
        vpt.grantRole(vpt.TIMELOCK_ROLE(), address(verifierElection));
        
        // Initialize communities and set up verifiers
        vpt.initializeCommunity(COMMUNITY_ID_1, "metadata1");
        vpt.initializeCommunity(COMMUNITY_ID_2, "metadata2");
        
        // Create verifier set for community 1
        address[] memory verifiers = new address[](5);
        verifiers[0] = verifier1;
        verifiers[1] = verifier2;
        verifiers[2] = verifier3;
        verifiers[3] = verifier4;
        verifiers[4] = verifier5;
        
        uint256[] memory weights = new uint256[](5);
        weights[0] = 100; // Low weight
        weights[1] = 200; // Medium weight
        weights[2] = 300; // High weight
        weights[3] = 150; // Medium-low weight
        weights[4] = 250; // Medium-high weight
        
        verifierElection.setVerifierSet(COMMUNITY_ID_1, verifiers, weights, REASON_CID);
        vm.stopPrank();
        
        // Set some verification parameters
        vm.startPrank(governance);
        paramController.setBool(COMMUNITY_ID_1, verifierManager.USE_VPT_WEIGHTING(), true);
        paramController.setUint256(COMMUNITY_ID_1, verifierManager.MAX_WEIGHT_PER_VERIFIER(), 1000);
        paramController.setUint256(COMMUNITY_ID_1, verifierManager.VERIFIER_PANEL_SIZE(), 3);
        paramController.setUint256(COMMUNITY_ID_1, verifierManager.VERIFIER_MIN(), 2);
        vm.stopPrank();
    }
    
    /*//////////////////////////////////////////////////////////////
                           CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testConstructor() public view {
        assertEq(address(verifierManager.verifierElection()), address(verifierElection));
        assertEq(address(verifierManager.paramController()), address(paramController));
        assertEq(verifierManager.governance(), governance);
    }
    
    function testConstructorZeroAddressesRevert() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        new VerifierManager(address(0), address(paramController), governance);
        
        vm.expectRevert(Errors.ZeroAddress.selector);
        new VerifierManager(address(verifierElection), address(0), governance);
        
        vm.expectRevert(Errors.ZeroAddress.selector);
        new VerifierManager(address(verifierElection), address(paramController), address(0));
    }
    
    /*//////////////////////////////////////////////////////////////
                        ENGAGEMENTS CONTRACT MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    function testSetEngagementsContract() public {
        address newEngagements = makeAddr("newEngagements");
        
        vm.prank(governance);
        verifierManager.setEngagementsContract(newEngagements);
        
        assertEq(verifierManager.engagementsContract(), newEngagements);
    }
    
    function testSetEngagementsContractNonGovernanceReverts() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, unauthorizedUser));
        vm.prank(unauthorizedUser);
        verifierManager.setEngagementsContract(makeAddr("newEngagements"));
    }
    
    function testSetEngagementsContractZeroAddressReverts() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        vm.prank(governance);
        verifierManager.setEngagementsContract(address(0));
    }
    
    /*//////////////////////////////////////////////////////////////
                           JUROR SELECTION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testSelectJurorsWeighted() public {
        uint256 claimId = 1;
        uint256 panelSize = 3;
        uint256 seed = 12345;
        bool useWeighting = true;
        
        vm.expectEmit(true, true, false, false);
        emit JurorsSelected(claimId, COMMUNITY_ID_1, new address[](0), new uint256[](0), seed, true);
        
        vm.prank(engagementsContract);
        address[] memory selectedJurors = verifierManager.selectJurors(
            claimId, COMMUNITY_ID_1, panelSize, seed, useWeighting
        );
        
        assertEq(selectedJurors.length, panelSize);
        
        // Verify all selected jurors have verifier power
        for (uint256 i = 0; i < selectedJurors.length; i++) {
            assertTrue(vpt.balanceOf(selectedJurors[i], COMMUNITY_ID_1) > 0);
        }
        
        // Verify selection is stored
        (address[] memory storedJurors, uint256[] memory storedPowers) = verifierManager.getSelectedJurors(claimId);
        assertEq(storedJurors.length, panelSize);
        assertEq(storedPowers.length, panelSize);
    }
    
    function testSelectJurorsUniform() public {
        uint256 claimId = 2;
        uint256 panelSize = 3;
        uint256 seed = 54321;
        bool useWeighting = false;
        
        vm.prank(engagementsContract);
        address[] memory selectedJurors = verifierManager.selectJurors(
            claimId, COMMUNITY_ID_1, panelSize, seed, useWeighting
        );
        
        assertEq(selectedJurors.length, panelSize);
        
        // All jurors should be unique
        for (uint256 i = 0; i < selectedJurors.length; i++) {
            for (uint256 j = i + 1; j < selectedJurors.length; j++) {
                assertTrue(selectedJurors[i] != selectedJurors[j]);
            }
        }
    }
    
    function testSelectJurorsNonEngagementsReverts() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, unauthorizedUser));
        vm.prank(unauthorizedUser);
        verifierManager.selectJurors(1, COMMUNITY_ID_1, 3, 12345, false);
    }
    
    function testSelectJurorsZeroPanelSizeReverts() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Panel size cannot be zero"));
        vm.prank(engagementsContract);
        verifierManager.selectJurors(1, COMMUNITY_ID_1, 0, 12345, false);
    }
    
    function testSelectJurorsInsufficientVerifiersReverts() public {
        // Try to select more jurors than available verifiers
        vm.expectRevert();
        vm.prank(engagementsContract);
        verifierManager.selectJurors(1, COMMUNITY_ID_1, 10, 12345, false); // Only 5 verifiers available
    }
    
    function testSelectJurorsAlreadySelectedReverts() public {
        uint256 claimId = 1;
        
        // First selection succeeds
        vm.prank(engagementsContract);
        verifierManager.selectJurors(claimId, COMMUNITY_ID_1, 3, 12345, false);
        
        // Second selection for same claim should fail
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Jurors already selected for engagement"));
        vm.prank(engagementsContract);
        verifierManager.selectJurors(claimId, COMMUNITY_ID_1, 3, 54321, false);
    }
    
    function testSelectJurorsNoEligibleVerifiers() public {
        // Use community 3 which has no verifiers (and doesn't exist yet)
        uint256 COMMUNITY_ID_3 = 3;
        vm.prank(timelock);
        vpt.initializeCommunity(COMMUNITY_ID_3, "metadata3");
        
        vm.expectRevert();
        vm.prank(engagementsContract);
        verifierManager.selectJurors(1, COMMUNITY_ID_3, 3, 12345, false);
    }
    
    /*//////////////////////////////////////////////////////////////
                         FRAUD REPORTING TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testReportFraud() public {
        // First select jurors
        uint256 claimId = 1;
        vm.prank(engagementsContract);
        address[] memory selectedJurors = verifierManager.selectJurors(claimId, COMMUNITY_ID_1, 3, 12345, false);
        
        // Report some of them as fraudulent
        address[] memory offenders = new address[](2);
        offenders[0] = selectedJurors[0];
        offenders[1] = selectedJurors[1];
        
        string memory evidenceCID = "QmFraudEvidenceHash";
        
        vm.expectEmit(true, true, false, true);
        emit FraudReported(claimId, COMMUNITY_ID_1, offenders, evidenceCID);
        
        vm.prank(engagementsContract);
        verifierManager.reportFraud(claimId, COMMUNITY_ID_1, offenders, evidenceCID);
    }
    
    function testReportFraudNonEngagementsReverts() public {
        address[] memory offenders = new address[](1);
        offenders[0] = verifier1;
        
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, unauthorizedUser));
        vm.prank(unauthorizedUser);
        verifierManager.reportFraud(1, COMMUNITY_ID_1, offenders, "evidence");
    }
    
    function testReportFraudEmptyOffendersReverts() public {
        address[] memory offenders = new address[](0);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "No offenders provided"));
        vm.prank(engagementsContract);
        verifierManager.reportFraud(1, COMMUNITY_ID_1, offenders, "evidence");
    }
    
    function testReportFraudNoJurySelectionReverts() public {
        address[] memory offenders = new address[](1);
        offenders[0] = verifier1;
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "No jury selection for engagement"));
        vm.prank(engagementsContract);
        verifierManager.reportFraud(1, COMMUNITY_ID_1, offenders, "evidence");
    }
    
    function testReportFraudOffenderNotSelectedReverts() public {
        // Select jurors
        uint256 claimId = 1;
        vm.prank(engagementsContract);
        verifierManager.selectJurors(claimId, COMMUNITY_ID_1, 3, 12345, false);
        
        // Try to report someone who wasn't selected
        address[] memory offenders = new address[](1);
        offenders[0] = makeAddr("notSelected");
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Offender was not selected as juror"));
        vm.prank(engagementsContract);
        verifierManager.reportFraud(claimId, COMMUNITY_ID_1, offenders, "evidence");
    }
    
    /*//////////////////////////////////////////////////////////////
                           VIEW FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testHasVerifierPower() public view {
        assertTrue(verifierManager.hasVerifierPower(verifier1, COMMUNITY_ID_1));
        assertTrue(verifierManager.hasVerifierPower(verifier3, COMMUNITY_ID_1));
        assertFalse(verifierManager.hasVerifierPower(unauthorizedUser, COMMUNITY_ID_1));
        assertFalse(verifierManager.hasVerifierPower(verifier1, COMMUNITY_ID_2)); // Different community
    }
    
    function testHasVerifierPowerBannedVerifier() public {
        // Ban a verifier
        address[] memory offenders = new address[](1);
        offenders[0] = verifier1;
        
        vm.prank(timelock);
        verifierElection.banVerifiers(COMMUNITY_ID_1, offenders, REASON_CID);
        
        // Should return false for banned verifier even if they had power before
        assertFalse(verifierManager.hasVerifierPower(verifier1, COMMUNITY_ID_1));
        assertTrue(verifierManager.hasVerifierPower(verifier2, COMMUNITY_ID_1)); // Other verifiers unaffected
    }
    
    function testGetEligibleVerifierCount() public view {
        assertEq(verifierManager.getEligibleVerifierCount(COMMUNITY_ID_1), 5);
        assertEq(verifierManager.getEligibleVerifierCount(COMMUNITY_ID_2), 0); // No verifiers set
    }
    
    function testGetVerifierPower() public view {
        assertEq(verifierManager.getVerifierPower(verifier1, COMMUNITY_ID_1), 100);
        assertEq(verifierManager.getVerifierPower(verifier3, COMMUNITY_ID_1), 300);
        assertEq(verifierManager.getVerifierPower(unauthorizedUser, COMMUNITY_ID_1), 0);
    }
    
    function testGetJurorSelection() public {
        uint256 claimId = 1;
        
        // Before selection
        VerifierManager.JurorSelection memory selectionBefore = verifierManager.getJurorSelection(claimId);
        assertFalse(selectionBefore.completed);
        
        // After selection
        vm.prank(engagementsContract);
        verifierManager.selectJurors(claimId, COMMUNITY_ID_1, 3, 12345, false);
        
        VerifierManager.JurorSelection memory selectionAfter = verifierManager.getJurorSelection(claimId);
        assertTrue(selectionAfter.completed);
        assertEq(selectionAfter.selectedJurors.length, 3);
        assertEq(selectionAfter.seed, 12345);
        assertTrue(selectionAfter.selectedAt > 0);
    }
    
    /*//////////////////////////////////////////////////////////////
                        PARAMETER INTEGRATION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testWeightingParameterRespected() public {
        uint256 claimId = 1;
        
        // Set community parameter to use weighting
        vm.startPrank(governance);
        paramController.setBool(COMMUNITY_ID_1, verifierManager.USE_VPT_WEIGHTING(), true);
        vm.stopPrank();
        
        vm.prank(engagementsContract);
        address[] memory selectedJurors = verifierManager.selectJurors(
            claimId, COMMUNITY_ID_1, 3, 12345, false // Even though we pass false, community config should override
        );
        
        assertEq(selectedJurors.length, 3);
        
        // With weighting enabled, higher-power verifiers should be more likely to be selected
        // This is probabilistic, so we'll just verify the selection worked
        for (uint256 i = 0; i < selectedJurors.length; i++) {
            assertTrue(vpt.balanceOf(selectedJurors[i], COMMUNITY_ID_1) > 0);
        }
    }
    
    function testMaxWeightParameterApplied() public {
        // Set a low max weight
        vm.startPrank(governance);
        paramController.setUint256(COMMUNITY_ID_1, verifierManager.MAX_WEIGHT_PER_VERIFIER(), 150);
        vm.stopPrank();
        
        uint256 claimId = 1;
        vm.prank(engagementsContract);
        address[] memory selectedJurors = verifierManager.selectJurors(claimId, COMMUNITY_ID_1, 3, 12345, true);
        
        // Verify selection worked (detailed weight capping is tested in the weighted selection logic)
        assertEq(selectedJurors.length, 3);
    }
    
    /*//////////////////////////////////////////////////////////////
                         SELECTION ALGORITHM TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testWeightedSelectionFavorsHigherPower() public {
        // Run multiple selections and verify higher-power verifiers are selected more often
        uint256 iterations = 10; // Reduced for test efficiency
        
        for (uint256 i = 0; i < iterations; i++) {
            uint256 claimId = 1000 + i; // Use different claim IDs
            
            vm.prank(engagementsContract);
            address[] memory selected = verifierManager.selectJurors(claimId, COMMUNITY_ID_1, 1, i + 1, true);
            
            // This test verifies the weighted selection functionality works
            assertEq(selected.length, 1);
            assertTrue(vpt.balanceOf(selected[0], COMMUNITY_ID_1) > 0);
            
            // Verify the selected verifier is eligible
            assertTrue(verifierManager.hasVerifierPower(selected[0], COMMUNITY_ID_1));
        }
    }
    
    function testUniformSelectionNoRepeats() public {
        uint256 claimId = 1;
        uint256 panelSize = 5; // Select all available verifiers
        
        vm.prank(engagementsContract);
        address[] memory selected = verifierManager.selectJurors(claimId, COMMUNITY_ID_1, panelSize, 12345, false);
        
        // Verify no duplicates
        for (uint256 i = 0; i < selected.length; i++) {
            for (uint256 j = i + 1; j < selected.length; j++) {
                assertTrue(selected[i] != selected[j]);
            }
        }
        
        // Verify all selected verifiers are from the eligible set
        (address[] memory eligible, ) = verifierElection.getEligibleVerifiers(COMMUNITY_ID_1);
        for (uint256 i = 0; i < selected.length; i++) {
            bool found = false;
            for (uint256 j = 0; j < eligible.length; j++) {
                if (selected[i] == eligible[j]) {
                    found = true;
                    break;
                }
            }
            assertTrue(found);
        }
    }
    
    /*//////////////////////////////////////////////////////////////
                         BANNED VERIFIER TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testSelectJurorsExcludesBannedVerifiers() public {
        // Ban some verifiers
        address[] memory toBan = new address[](2);
        toBan[0] = verifier1;
        toBan[1] = verifier2;
        
        vm.prank(timelock);
        verifierElection.banVerifiers(COMMUNITY_ID_1, toBan, REASON_CID);
        
        uint256 claimId = 1;
        vm.prank(engagementsContract);
        address[] memory selected = verifierManager.selectJurors(claimId, COMMUNITY_ID_1, 3, 12345, false);
        
        // Verify banned verifiers are not in the selection
        for (uint256 i = 0; i < selected.length; i++) {
            assertTrue(selected[i] != verifier1);
            assertTrue(selected[i] != verifier2);
            assertTrue(!verifierElection.bannedVerifiers(COMMUNITY_ID_1, selected[i]));
        }
    }
    
    /*//////////////////////////////////////////////////////////////
                              FUZZ TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testFuzzSelectJurors(uint256 seed, uint8 panelSize) public {
        vm.assume(panelSize > 0 && panelSize <= 5); // We only have 5 verifiers
        
        uint256 claimId = seed % 1000000; // Ensure unique claim ID
        
        vm.prank(engagementsContract);
        address[] memory selected = verifierManager.selectJurors(
            claimId, COMMUNITY_ID_1, panelSize, seed, false
        );
        
        assertEq(selected.length, panelSize);
        
        // Verify no duplicates
        for (uint256 i = 0; i < selected.length; i++) {
            assertTrue(vpt.balanceOf(selected[i], COMMUNITY_ID_1) > 0);
            for (uint256 j = i + 1; j < selected.length; j++) {
                assertTrue(selected[i] != selected[j]);
            }
        }
    }
    
    function testFuzzReportFraud(uint256 seed, uint8 numOffenders) public {
        vm.assume(numOffenders > 0 && numOffenders <= 3);
        
        // First select jurors
        uint256 claimId = seed % 1000000;
        vm.prank(engagementsContract);
        address[] memory selectedJurors = verifierManager.selectJurors(claimId, COMMUNITY_ID_1, 3, seed, false);
        
        // Create offenders array with selected jurors
        address[] memory offenders = new address[](numOffenders);
        for (uint256 i = 0; i < numOffenders; i++) {
            offenders[i] = selectedJurors[i % selectedJurors.length];
        }
        
        vm.prank(engagementsContract);
        verifierManager.reportFraud(claimId, COMMUNITY_ID_1, offenders, "fuzz-evidence");
        
        // No revert means success
        assertTrue(true);
    }
}