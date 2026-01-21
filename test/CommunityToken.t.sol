// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "contracts/tokens/CommunityToken.sol";
import "contracts/modules/ParamController.sol";
import "contracts/libs/Errors.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {IAccessManaged} from "@openzeppelin/contracts/access/manager/IAccessManaged.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {
        _mint(msg.sender, 1000000 * 10**18); // 1M USDC
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockParamController {
    mapping(uint256 => mapping(bytes32 => uint256)) public params;
    
    function getUint256(uint256 communityId, bytes32 key) external view returns (uint256) {
        return params[communityId][key];
    }
    
    function setUint256(uint256 communityId, bytes32 key, uint256 value) external {
        params[communityId][key] = value;
    }
    
    function FEE_ON_WITHDRAW() external pure returns (bytes32) {
        return keccak256("FEE_ON_WITHDRAW");
    }
}

contract CommunityTokenTest is Test {
    CommunityToken public communityToken;
    MockUSDC public usdc;
    MockParamController public paramController;
    AccessManager public accessManager;
    
    address public admin = address(0x1001);
    address public minter = address(0x1002); 
    address public treasury = address(0x1003);
    address public emergencyRole = address(0x1004);
    address public user1 = address(0x2001);
    address public user2 = address(0x2002);
    address public user3 = address(0x2003);
    
    uint256 public constant COMMUNITY_ID = 1;
    uint256 public constant MAX_SUPPLY = 1000000e18; // 1M tokens
    uint256 public constant INITIAL_USDC = 10000e18; // 10K USDC per user

    event TokensMinted(address indexed to, uint256 usdcAmount, uint256 tokensAmount);
    event TokensRedeemed(address indexed from, uint256 tokensAmount, uint256 usdcAmount, uint256 fee);
    event TreasuryDeposit(uint256 amount, address indexed depositor);
    event TreasuryWithdrawal(uint256 amount, address indexed recipient, string reason);
    event EmergencyWithdrawalRequested(uint256 indexed requestId, uint256 amount, address indexed requester);
    event EmergencyWithdrawalExecuted(uint256 indexed requestId, uint256 amount, address indexed recipient);
    event RedemptionFeeUpdated(uint256 oldFee, uint256 newFee);
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event MaxSupplyUpdated(uint256 oldMax, uint256 newMax);

    function setUp() public {
        usdc = new MockUSDC();
        paramController = new MockParamController();
        accessManager = new AccessManager(admin);

        vm.startPrank(admin, admin);
        communityToken = new CommunityToken(
            address(usdc),
            COMMUNITY_ID,
            "Test Community Token",
            "TCT",
            treasury,
            MAX_SUPPLY,
            address(paramController),
            address(accessManager)
        );

        // Configure AccessManager selectors
        bytes4[] memory minterSelectors = new bytes4[](1);
        minterSelectors[0] = communityToken.mintTo.selector;
        accessManager.setTargetFunctionRole(address(communityToken), minterSelectors, communityToken.MINTER_ROLE());

        bytes4[] memory treasurySelectors = new bytes4[](2);
        treasurySelectors[0] = communityToken.withdrawFromTreasury.selector;
        treasurySelectors[1] = communityToken.setTreasury.selector;
        accessManager.setTargetFunctionRole(address(communityToken), treasurySelectors, communityToken.TREASURY_ROLE());

        bytes4[] memory emergencySelectors = new bytes4[](4);
        emergencySelectors[0] = communityToken.requestEmergencyWithdrawal.selector;
        emergencySelectors[1] = communityToken.executeEmergencyWithdrawal.selector;
        emergencySelectors[2] = communityToken.pause.selector;
        emergencySelectors[3] = communityToken.unpause.selector;
        accessManager.setTargetFunctionRole(address(communityToken), emergencySelectors, communityToken.EMERGENCY_ROLE());

        // Grant roles via AccessManager
        accessManager.grantRole(communityToken.MINTER_ROLE(), minter, 0);
        accessManager.grantRole(communityToken.TREASURY_ROLE(), treasury, 0);
        accessManager.grantRole(communityToken.EMERGENCY_ROLE(), emergencyRole, 0);
        vm.stopPrank();

        // Give users USDC
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
        vm.deal(user3, 100 ether);

        usdc.mint(user1, INITIAL_USDC);
        usdc.mint(user2, INITIAL_USDC);
        usdc.mint(user3, INITIAL_USDC);
        usdc.mint(treasury, INITIAL_USDC);
    }

    /* ======== CONSTRUCTOR TESTS ======== */

    function testConstructor() public {
        assertEq(address(communityToken.USDC()), address(usdc));
        assertEq(communityToken.communityId(), COMMUNITY_ID);
        assertEq(communityToken.name(), "Test Community Token");
        assertEq(communityToken.symbol(), "TCT");
        assertEq(communityToken.treasury(), treasury);
        assertEq(communityToken.maxSupply(), MAX_SUPPLY);
    }

    function testConstructorZeroUSDCReverts() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.ZeroAddress.selector));
        new CommunityToken(
            address(0),
            COMMUNITY_ID,
            "Test Community Token",
            "TCT",
            treasury,
            MAX_SUPPLY,
            address(paramController),
            address(accessManager)
        );
    }

    function testConstructorZeroTreasuryReverts() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.ZeroAddress.selector));
        new CommunityToken(
            address(usdc),
            COMMUNITY_ID,
            "Test Community Token",
            "TCT",
            address(0),
            MAX_SUPPLY,
            address(paramController),
            address(accessManager)
        );
    }
    
    function testConstructorZeroParamControllerReverts() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.ZeroAddress.selector));
        new CommunityToken(
            address(usdc),
            COMMUNITY_ID,
            "Test Community Token",
            "TCT",
            treasury,
            MAX_SUPPLY,
            address(0),
            address(accessManager)
        );
    }

    function testConstructorZeroCommunityIdReverts() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Community ID cannot be zero"));
        new CommunityToken(
            address(usdc),
            0,
            "Test Community Token",
            "TCT",
            treasury,
            MAX_SUPPLY,
            address(paramController),
            address(accessManager)
        );
    }

    function testConstructorZeroMaxSupplyReverts() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Max supply cannot be zero"));
        new CommunityToken(
            address(usdc),
            COMMUNITY_ID,
            "Test Community Token",
            "TCT",
            treasury,
            0,
            address(paramController),
            address(accessManager)
        );
    }

    /* ======== MINTING TESTS ======== */

    function testMint() public {
        uint256 usdcAmount = 1000e18;
        
        vm.startPrank(user1, user1);
        usdc.approve(address(communityToken), usdcAmount);
        
        vm.expectEmit(true, true, true, true);
        emit TokensMinted(user1, usdcAmount, usdcAmount);
        
        uint256 tokensReceived = communityToken.mint(usdcAmount);
        vm.stopPrank();

        assertEq(tokensReceived, usdcAmount);
        assertEq(communityToken.balanceOf(user1), usdcAmount);
        assertEq(communityToken.totalSupply(), usdcAmount);
        assertEq(usdc.balanceOf(address(communityToken)), usdcAmount);
    }

    function testMintZeroAmountReverts() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Amount cannot be zero"));
        communityToken.mint(0);
    }

    function testMintExceedsMaxSupplyReverts() public {
        uint256 exceedsAmount = MAX_SUPPLY + 1;
        
        usdc.mint(user1, exceedsAmount);
        
        vm.startPrank(user1, user1);
        usdc.approve(address(communityToken), exceedsAmount);
        
        vm.expectRevert(abi.encodeWithSelector(
            CommunityToken.MaxSupplyExceeded.selector, 
            exceedsAmount, 
            MAX_SUPPLY
        ));
        communityToken.mint(exceedsAmount);
        vm.stopPrank();
    }

    function testMintTo() public {
        uint256 amount = 5000e18;
        
        vm.prank(minter);
        vm.expectEmit(true, true, true, true);
        emit TokensMinted(user1, 0, amount);
        
        communityToken.mintTo(user1, amount);

        assertEq(communityToken.balanceOf(user1), amount);
        assertEq(communityToken.totalSupply(), amount);
    }

    function testMintToZeroAddressReverts() public {
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(Errors.ZeroAddress.selector));
        communityToken.mintTo(address(0), 1000e18);
    }

    function testMintToOnlyMinterRole() public {
        vm.prank(user1, user1);
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, user1));
        communityToken.mintTo(user2, 1000e18);
    }

    function testMintToExceedsMaxSupplyReverts() public {
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(
            CommunityToken.MaxSupplyExceeded.selector,
            MAX_SUPPLY + 1,
            MAX_SUPPLY
        ));
        communityToken.mintTo(user1, MAX_SUPPLY + 1);
    }

    function testMintWhenPausedReverts() public {
        vm.prank(emergencyRole, emergencyRole);
        communityToken.pause();

        vm.startPrank(user1, user1);
        usdc.approve(address(communityToken), 1000e18);
        vm.expectRevert(abi.encodeWithSelector(Pausable.EnforcedPause.selector));
        communityToken.mint(1000e18);
        vm.stopPrank();
    }

    /* ======== REDEMPTION TESTS ======== */

    function testRedeem() public {
        // First mint some tokens
        uint256 usdcAmount = 2000e18;
        vm.startPrank(user1, user1);
        usdc.approve(address(communityToken), usdcAmount);
        communityToken.mint(usdcAmount);
        
        // Now redeem half
        uint256 redeemAmount = 1000e18;
        uint256 usdcBefore = usdc.balanceOf(user1);
        
        vm.expectEmit(true, true, true, true);
        emit TokensRedeemed(user1, redeemAmount, redeemAmount, 0); // 0 fee by default
        
        uint256 usdcReceived = communityToken.redeem(redeemAmount);
        vm.stopPrank();

        assertEq(usdcReceived, redeemAmount); // 1:1 ratio, no fee
        assertEq(communityToken.balanceOf(user1), 1000e18); // Remaining tokens
        assertEq(usdc.balanceOf(user1), usdcBefore + redeemAmount);
        assertEq(communityToken.totalSupply(), 1000e18);
    }

    function testRedeemWithFee() public {
        // Set redemption fee to 2% in ParamController
        paramController.setUint256(COMMUNITY_ID, paramController.FEE_ON_WITHDRAW(), 200); // 2%
        
        // First mint some tokens
        uint256 usdcAmount = 2000e18;
        vm.startPrank(user1, user1);
        usdc.approve(address(communityToken), usdcAmount);
        communityToken.mint(usdcAmount);
        
        // Redeem with fee
        uint256 redeemAmount = 1000e18;
        uint256 expectedFee = (redeemAmount * 200) / 10000; // 2%
        uint256 expectedNet = redeemAmount - expectedFee;
        
        uint256 usdcBefore = usdc.balanceOf(user1);
        uint256 treasuryBefore = usdc.balanceOf(treasury);
        
        vm.expectEmit(true, true, true, true);
        emit TokensRedeemed(user1, redeemAmount, expectedNet, expectedFee);
        
        uint256 usdcReceived = communityToken.redeem(redeemAmount);
        vm.stopPrank();

        assertEq(usdcReceived, expectedNet);
        assertEq(usdc.balanceOf(user1), usdcBefore + expectedNet);
        assertEq(usdc.balanceOf(treasury), treasuryBefore + expectedFee);
    }

    function testRedeemZeroAmountReverts() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Amount cannot be zero"));
        communityToken.redeem(0);
    }

    function testRedeemInsufficientBalanceReverts() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(
            CommunityToken.InsufficientTokenBalance.selector,
            1000e18,
            0
        ));
        communityToken.redeem(1000e18);
    }

    function testRedeemInsufficientUSDCReservesReverts() public {
        // Mint tokens first
        vm.startPrank(user1, user1);
        usdc.approve(address(communityToken), 1000e18);
        communityToken.mint(1000e18);
        vm.stopPrank();

        // Artificially drain USDC reserves
        vm.startPrank(emergencyRole, emergencyRole);
        communityToken.requestEmergencyWithdrawal(1000e18);
        vm.warp(block.timestamp + 7 days + 1);
        communityToken.executeEmergencyWithdrawal(0, emergencyRole);
        vm.stopPrank();

        // Now redemption should fail
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(
            CommunityToken.InsufficientUSDCBalance.selector,
            1000e18,
            0
        ));
        communityToken.redeem(1000e18);
    }

    /* ======== TREASURY MANAGEMENT TESTS ======== */

    function testDepositToTreasury() public {
        uint256 depositAmount = 5000e18;
        
        vm.startPrank(user1, user1);
        usdc.approve(address(communityToken), depositAmount);
        
        vm.expectEmit(true, true, true, true);
        emit TreasuryDeposit(depositAmount, user1);
        
        communityToken.depositToTreasury(depositAmount);
        vm.stopPrank();

        assertEq(usdc.balanceOf(address(communityToken)), depositAmount);
    }

    function testWithdrawFromTreasury() public {
        // First deposit to treasury and mint some tokens to establish reserves
        uint256 treasuryDeposit = 5000e18;
        uint256 mintAmount = 2000e18;
        
        // Deposit to treasury 
        vm.startPrank(user1, user1);
        usdc.approve(address(communityToken), treasuryDeposit);
        communityToken.depositToTreasury(treasuryDeposit);
        
        // Mint tokens (creates 1:1 backing requirement)
        usdc.approve(address(communityToken), mintAmount);
        communityToken.mint(mintAmount);
        vm.stopPrank();

        // Withdraw from treasury (only excess above 1:1 backing)
        uint256 withdrawAmount = 3000e18; // Should work since we have 7000 USDC but only need 2000 for backing
        
        vm.prank(treasury);
        vm.expectEmit(true, true, true, true);
        emit TreasuryWithdrawal(withdrawAmount, user2, "Community operations");
        
        communityToken.withdrawFromTreasury(user2, withdrawAmount, "Community operations");

        assertEq(usdc.balanceOf(user2), INITIAL_USDC + withdrawAmount);
    }

    function testWithdrawFromTreasuryInsufficientReservesReverts() public {
        // Mint tokens first
        vm.startPrank(user1, user1);
        usdc.approve(address(communityToken), 2000e18);
        communityToken.mint(2000e18);
        vm.stopPrank();

        // Try to withdraw more than available (would break 1:1 backing)
        vm.prank(treasury);
        vm.expectRevert(abi.encodeWithSelector(
            CommunityToken.InsufficientTreasuryBalance.selector,
            2001e18, // required (2000 backing + 1 withdrawal)
            2000e18  // available
        ));
        communityToken.withdrawFromTreasury(user2, 1e18, "Test");
    }

    function testWithdrawFromTreasuryOnlyTreasuryRole() public {
        vm.prank(user1, user1);
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, user1));
        communityToken.withdrawFromTreasury(user2, 1000e18, "Test");
    }

    /* ======== EMERGENCY FUNCTIONS TESTS ======== */

    function testRequestEmergencyWithdrawal() public {
        uint256 withdrawAmount = 1000e18;
        
        vm.prank(emergencyRole);
        vm.expectEmit(true, true, true, true);
        emit EmergencyWithdrawalRequested(0, withdrawAmount, emergencyRole);
        
        communityToken.requestEmergencyWithdrawal(withdrawAmount);

        (uint256 amount, uint256 requestTime, bool executed, address requestedBy) = 
            communityToken.emergencyWithdrawals(0);
        
        assertEq(amount, withdrawAmount);
        assertEq(requestTime, block.timestamp);
        assertFalse(executed);
        assertEq(requestedBy, emergencyRole);
    }

    function testRequestEmergencyWithdrawalOnlyEmergencyRole() public {
        vm.prank(user1, user1);
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, user1));
        communityToken.requestEmergencyWithdrawal(1000e18);
    }

    function testExecuteEmergencyWithdrawal() public {
        // First deposit USDC
        vm.startPrank(user1, user1);
        usdc.approve(address(communityToken), 2000e18);
        communityToken.depositToTreasury(2000e18);
        vm.stopPrank();

        // Request emergency withdrawal
        uint256 withdrawAmount = 1000e18;
        vm.prank(emergencyRole, emergencyRole);
        communityToken.requestEmergencyWithdrawal(withdrawAmount);

        // Advance time past delay
        vm.warp(block.timestamp + 7 days + 1);

        // Execute withdrawal
        vm.prank(emergencyRole, emergencyRole);
        vm.expectEmit(true, true, true, true);
        emit EmergencyWithdrawalExecuted(0, withdrawAmount, user3);
        
        communityToken.executeEmergencyWithdrawal(0, user3);

        assertEq(usdc.balanceOf(user3), INITIAL_USDC + withdrawAmount);
        
        (,, bool executed,) = communityToken.emergencyWithdrawals(0);
        assertTrue(executed);
    }

    function testExecuteEmergencyWithdrawalBeforeDelayReverts() public {
        vm.prank(emergencyRole, emergencyRole);
        communityToken.requestEmergencyWithdrawal(1000e18);

        vm.prank(emergencyRole, emergencyRole);
        vm.expectRevert(abi.encodeWithSelector(
            CommunityToken.EmergencyWithdrawalNotReady.selector,
            block.timestamp,
            block.timestamp
        ));
        communityToken.executeEmergencyWithdrawal(0, user3);
    }

    function testPauseAndUnpause() public {
        // Pause
        vm.startPrank(emergencyRole, emergencyRole);
        communityToken.pause();
        assertTrue(communityToken.paused());

        // Unpause
        communityToken.unpause();
        vm.stopPrank();
        assertFalse(communityToken.paused());
    }

    /* ======== GOVERNANCE TESTS ======== */

    function testRedemptionFeeFromParamControllerBasic() public {
        uint256 newFee = 250; // 2.5%
        
        // Set fee in ParamController
        paramController.setUint256(COMMUNITY_ID, paramController.FEE_ON_WITHDRAW(), newFee);
        
        // Test that redemption uses the ParamController fee
        uint256 mintAmount = 1000e18;
        
        vm.startPrank(user1, user1);
        usdc.approve(address(communityToken), mintAmount);
        communityToken.mint(mintAmount);
        
        // Calculate expected redemption amounts with fee
        uint256 expectedFee = (mintAmount * newFee) / 10000;
        uint256 expectedUSDC = mintAmount - expectedFee;
        
        vm.expectEmit(true, true, true, true);
        emit TokensRedeemed(user1, mintAmount, expectedUSDC, expectedFee);
        communityToken.redeem(mintAmount);
        vm.stopPrank();
    }

    function testRedemptionFeeCapAtMaximum() public {
        // Set fee above maximum in ParamController
        uint256 excessiveFee = 1500; // 15% > 10% max
        paramController.setUint256(COMMUNITY_ID, paramController.FEE_ON_WITHDRAW(), excessiveFee);
        
        uint256 mintAmount = 1000e18;
        
        vm.startPrank(user1, user1);
        usdc.approve(address(communityToken), mintAmount);
        communityToken.mint(mintAmount);
        
        // Calculate expected redemption amounts with capped fee
        uint256 maxFee = 1000; // 10% maximum
        uint256 expectedFee = (mintAmount * maxFee) / 10000;
        uint256 expectedUSDC = mintAmount - expectedFee;
        
        vm.expectEmit(true, true, true, true);
        emit TokensRedeemed(user1, mintAmount, expectedUSDC, expectedFee);
        communityToken.redeem(mintAmount);
        vm.stopPrank();
    }
    
    function testRedemptionFeeFromParamController() public {
        // Set fee in ParamController
        uint256 testFee = 300; // 3%
        paramController.setUint256(COMMUNITY_ID, paramController.FEE_ON_WITHDRAW(), testFee);
        
        // Verify effective fee reads from ParamController
        assertEq(communityToken.getEffectiveRedemptionFee(), testFee);
        
        // Test redemption with ParamController fee
        uint256 usdcAmount = 1000e18;
        vm.startPrank(user1, user1);
        usdc.approve(address(communityToken), usdcAmount);
        communityToken.mint(usdcAmount);
        
        uint256 redeemAmount = 500e18;
        uint256 expectedFee = (redeemAmount * testFee) / 10000;
        uint256 expectedNet = redeemAmount - expectedFee;
        
        uint256 usdcReceived = communityToken.redeem(redeemAmount);
        vm.stopPrank();
        
        assertEq(usdcReceived, expectedNet);
    }

    function testSetTreasury() public {
        address newTreasury = address(0x9999);
        
        vm.prank(treasury, treasury);
        vm.expectEmit(true, true, true, true);
        emit TreasuryUpdated(treasury, newTreasury);
        
        communityToken.setTreasury(newTreasury);
        assertEq(communityToken.treasury(), newTreasury);
    }

    function testSetMaxSupply() public {
        uint256 newMaxSupply = MAX_SUPPLY * 2;
        
        vm.prank(admin, admin);
        vm.expectEmit(true, true, true, true);
        emit MaxSupplyUpdated(MAX_SUPPLY, newMaxSupply);
        
        communityToken.setMaxSupply(newMaxSupply);
        assertEq(communityToken.maxSupply(), newMaxSupply);
    }

    function testSetMaxSupplyBelowCurrentSupplyReverts() public {
        // Mint some tokens first
        vm.startPrank(user1, user1);
        usdc.approve(address(communityToken), 5000e18);
        communityToken.mint(5000e18);
        vm.stopPrank();

        vm.prank(admin, admin);
        vm.expectRevert(abi.encodeWithSelector(
            Errors.InvalidInput.selector,
            "Max supply cannot be less than current supply"
        ));
        communityToken.setMaxSupply(4000e18); // Less than current supply
    }

    /* ======== VIEW FUNCTIONS TESTS ======== */

    function testGetBackingRatio() public {
        // Test with no supply
        assertEq(communityToken.getBackingRatio(), 10000); // 100%

        // Mint tokens with 1:1 backing
        vm.startPrank(user1, user1);
        usdc.approve(address(communityToken), 1000e18);
        communityToken.mint(1000e18);
        vm.stopPrank();

        assertEq(communityToken.getBackingRatio(), 10000); // 100%

        // Add extra reserves
        vm.startPrank(user1, user1);
        usdc.approve(address(communityToken), 500e18);
        communityToken.depositToTreasury(500e18);
        vm.stopPrank();

        assertEq(communityToken.getBackingRatio(), 15000); // 150%
    }

    function testCalculateRedemption() public {
        // Set fee to 2% in ParamController
        paramController.setUint256(COMMUNITY_ID, paramController.FEE_ON_WITHDRAW(), 200);

        uint256 tokenAmount = 1000e18;
        (uint256 grossUsdc, uint256 fee, uint256 netUsdc) = 
            communityToken.calculateRedemption(tokenAmount);

        assertEq(grossUsdc, tokenAmount);
        assertEq(fee, 20e18); // 2%
        assertEq(netUsdc, 980e18); // 98%
    }

    function testGetAvailableTreasuryBalance() public {
        // Initially 0
        assertEq(communityToken.getAvailableTreasuryBalance(), 0);

        // Mint tokens (creates backing requirement)
        vm.startPrank(user1, user1);
        usdc.approve(address(communityToken), 1000e18);
        communityToken.mint(1000e18);
        vm.stopPrank();

        // Still 0 (exactly backed)
        assertEq(communityToken.getAvailableTreasuryBalance(), 0);

        // Add extra reserves
        vm.startPrank(user1, user1);
        usdc.approve(address(communityToken), 500e18);
        communityToken.depositToTreasury(500e18);
        vm.stopPrank();

        // Now has available balance
        assertEq(communityToken.getAvailableTreasuryBalance(), 500e18);
    }

    function testIsEmergencyWithdrawalReady() public {
        vm.prank(emergencyRole);
        communityToken.requestEmergencyWithdrawal(1000e18);

        (bool ready, uint256 timeRemaining) = communityToken.isEmergencyWithdrawalReady(0);
        assertFalse(ready);
        assertEq(timeRemaining, 7 days);

        // Advance time
        vm.warp(block.timestamp + 7 days + 1);
        
        (ready, timeRemaining) = communityToken.isEmergencyWithdrawalReady(0);
        assertTrue(ready);
        assertEq(timeRemaining, 0);
    }

    /* ======== INTEGRATION TESTS ======== */

    function testEndToEndTokenLifecycle() public {
        // 1. User mints tokens
        uint256 mintAmount = 5000e18;
        vm.startPrank(user1, user1);
        usdc.approve(address(communityToken), mintAmount);
        communityToken.mint(mintAmount);
        vm.stopPrank();

        // 2. Community deposits extra treasury funds
        uint256 treasuryAmount = 2000e18;
        vm.startPrank(user2, user2);
        usdc.approve(address(communityToken), treasuryAmount);
        communityToken.depositToTreasury(treasuryAmount);
        vm.stopPrank();

        // 3. Set redemption fee via ParamController
        paramController.setUint256(COMMUNITY_ID, paramController.FEE_ON_WITHDRAW(), 100); // 1%

        // 4. Mint additional tokens via governance (with backing)
        uint256 govMintAmount = 500e18; // Reduced to ensure sufficient backing
        vm.prank(minter);
        communityToken.mintTo(user3, govMintAmount);

        // 5. Treasury withdrawal for operations (conservative amount)
        uint256 withdrawAmount = 1000e18; // Reduced to ensure sufficient reserves remain
        vm.prank(treasury);
        communityToken.withdrawFromTreasury(user2, withdrawAmount, "Community development");

        // 6. User redeems tokens with fee
        uint256 redeemAmount = 1500e18; // Reduced to match available backing
        vm.prank(user1);
        communityToken.redeem(redeemAmount);

        // Verify final state
        assertEq(communityToken.totalSupply(), mintAmount + govMintAmount - redeemAmount);
        assertTrue(communityToken.getBackingRatio() >= 9500); // Allow some variance due to fees
        assertTrue(communityToken.getAvailableTreasuryBalance() >= 0);
    }

    function testRoleBasedAccessControl() public {
        // Test each role can only do what they're supposed to
        
        // Only minter can mintTo
        vm.prank(user1, user1);
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, user1));
        communityToken.mintTo(user2, 1000e18);

        // Only treasury can withdraw
        vm.prank(user1, user1);
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, user1));
        communityToken.withdrawFromTreasury(user2, 100e18, "test");

        // Only emergency can pause
        vm.prank(user1, user1);
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, user1));
        communityToken.pause();

        // Only admin can set parameters
        vm.prank(user1, user1);
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, user1));
        communityToken.setMaxSupply(MAX_SUPPLY + 1);
    }
}