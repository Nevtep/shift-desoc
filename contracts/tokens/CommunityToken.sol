// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {Errors} from "contracts/libs/Errors.sol";
import {ParamController} from "contracts/modules/ParamController.sol";

/**
 * @title CommunityToken
 * @author Shift Team
 * @notice 1:1 USDC-backed stablecoin for transparent community payments and treasury management
 * 
 * @dev Key Features:
 * - 1:1 USDC backing with full collateralization
 * - Governance-controlled minting for community rewards
 * - Instant redemption for underlying USDC
 * - Emergency controls and pausing mechanisms
 * - Treasury management with withdrawal controls
 * - Integration with community governance and revenue routing
 */
contract CommunityToken is ERC20, AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /* ======== ROLES ======== */
    
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

    /* ======== STATE VARIABLES ======== */

    /// @notice The underlying USDC token used for 1:1 backing
    IERC20 public immutable USDC;
    
    /// @notice Community ID this token belongs to
    uint256 public immutable communityId;
    
    /// @notice Maximum supply cap to prevent infinite minting
    uint256 public maxSupply;
    
    /// @notice Emergency withdrawal delay for governance security
    uint256 public constant EMERGENCY_DELAY = 7 days;
    
    /// @notice Pending emergency withdrawal info
    struct EmergencyWithdrawal {
        uint256 amount;
        uint256 requestTime;
        bool executed;
        address requestedBy;
    }
    
    mapping(uint256 => EmergencyWithdrawal) public emergencyWithdrawals;
    uint256 public emergencyWithdrawalCount;
    
    /// @notice Maximum redemption fee (10% in basis points)
    uint256 public constant MAX_REDEMPTION_FEE = 1000; // 10%
    
    /// @notice Community treasury for fee collection
    address public treasury;
    
    /// @notice ParamController for reading withdrawal fees
    ParamController public paramController;

    /* ======== EVENTS ======== */

    event TokensMinted(address indexed to, uint256 usdcAmount, uint256 tokensAmount);
    event TokensRedeemed(address indexed from, uint256 tokensAmount, uint256 usdcAmount, uint256 fee);
    event TreasuryDeposit(uint256 amount, address indexed depositor);
    event TreasuryWithdrawal(uint256 amount, address indexed recipient, string reason);
    event EmergencyWithdrawalRequested(uint256 indexed requestId, uint256 amount, address indexed requester);
    event EmergencyWithdrawalExecuted(uint256 indexed requestId, uint256 amount, address indexed recipient);
    event RedemptionFeeUpdated(uint256 oldFee, uint256 newFee);
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event MaxSupplyUpdated(uint256 oldMax, uint256 newMax);

    /* ======== ERRORS ======== */

    error InsufficientUSDCBalance(uint256 required, uint256 available);
    error InsufficientTokenBalance(uint256 required, uint256 available);
    error MaxSupplyExceeded(uint256 requested, uint256 maxAllowed);
    error InvalidRedemptionFee(uint256 fee, uint256 maxAllowed);
    error EmergencyWithdrawalNotReady(uint256 requestTime, uint256 currentTime);
    error EmergencyWithdrawalAlreadyExecuted(uint256 requestId);
    error InvalidWithdrawalAmount(uint256 amount);
    error InsufficientTreasuryBalance(uint256 required, uint256 available);

    /* ======== MODIFIERS ======== */

    modifier onlyValidRole(bytes32 role) {
        if (!hasRole(role, msg.sender)) revert Errors.NotAuthorized(msg.sender);
        _;
    }

    /* ======== CONSTRUCTOR ======== */

    /**
     * @notice Initialize CommunityToken with USDC backing
     * @param _usdc USDC token contract address
     * @param _communityId ID of the community this token serves
     * @param _name Token name (e.g., "Shift Community Token")
     * @param _symbol Token symbol (e.g., "SCT")
     * @param _treasury Initial treasury address for fee collection
     * @param _maxSupply Maximum token supply cap
     * @param _paramController ParamController address for reading withdrawal fees
     */
    constructor(
        address _usdc,
        uint256 _communityId,
        string memory _name,
        string memory _symbol,
        address _treasury,
        uint256 _maxSupply,
        address _paramController
    ) ERC20(_name, _symbol) {
        if (_usdc == address(0)) revert Errors.ZeroAddress();
        if (_treasury == address(0)) revert Errors.ZeroAddress();
        if (_paramController == address(0)) revert Errors.ZeroAddress();
        if (_communityId == 0) revert Errors.InvalidInput("Community ID cannot be zero");
        if (_maxSupply == 0) revert Errors.InvalidInput("Max supply cannot be zero");

        USDC = IERC20(_usdc);
        communityId = _communityId;
        treasury = _treasury;
        maxSupply = _maxSupply;
        paramController = ParamController(_paramController);
        
        // Grant admin role to deployer
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(TREASURY_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);
    }

    /* ======== CORE TOKEN FUNCTIONS ======== */

    /**
     * @notice Mint community tokens by depositing USDC (1:1 ratio)
     * @param usdcAmount Amount of USDC to deposit
     * @return tokensAmount Amount of community tokens minted
     */
    function mint(uint256 usdcAmount) external whenNotPaused nonReentrant returns (uint256 tokensAmount) {
        if (usdcAmount == 0) revert Errors.InvalidInput("Amount cannot be zero");
        
        // Check max supply
        tokensAmount = usdcAmount; // 1:1 ratio
        if (totalSupply() + tokensAmount > maxSupply) {
            revert MaxSupplyExceeded(totalSupply() + tokensAmount, maxSupply);
        }

        // Transfer USDC from user
        uint256 balanceBefore = USDC.balanceOf(address(this));
        USDC.safeTransferFrom(msg.sender, address(this), usdcAmount);
        uint256 balanceAfter = USDC.balanceOf(address(this));
        
        // Verify actual transfer amount (handles fee-on-transfer tokens)
        uint256 actualReceived = balanceAfter - balanceBefore;
        if (actualReceived < usdcAmount) {
            tokensAmount = actualReceived; // Adjust for actual received amount
        }

        // Mint tokens to user
        _mint(msg.sender, tokensAmount);

        emit TokensMinted(msg.sender, usdcAmount, tokensAmount);
    }

    /**
     * @notice Redeem community tokens for USDC (1:1 ratio minus fee)
     * @param tokenAmount Amount of community tokens to redeem
     * @return usdcAmount Amount of USDC received (after fee)
     */
    function redeem(uint256 tokenAmount) external whenNotPaused nonReentrant returns (uint256 usdcAmount) {
        if (tokenAmount == 0) revert Errors.InvalidInput("Amount cannot be zero");
        if (balanceOf(msg.sender) < tokenAmount) {
            revert InsufficientTokenBalance(tokenAmount, balanceOf(msg.sender));
        }

        // Calculate USDC amount and fee (read from ParamController)
        uint256 grossUsdcAmount = tokenAmount; // 1:1 base ratio
        uint256 feeBps = _getRedemptionFeeBps();
        uint256 fee = (grossUsdcAmount * feeBps) / 10000;
        usdcAmount = grossUsdcAmount - fee;

        // Check USDC reserves
        uint256 usdcBalance = USDC.balanceOf(address(this));
        if (usdcBalance < grossUsdcAmount) {
            revert InsufficientUSDCBalance(grossUsdcAmount, usdcBalance);
        }

        // Burn tokens
        _burn(msg.sender, tokenAmount);

        // Transfer USDC to user
        if (usdcAmount > 0) {
            USDC.safeTransfer(msg.sender, usdcAmount);
        }

        // Transfer fee to treasury
        if (fee > 0) {
            USDC.safeTransfer(treasury, fee);
        }

        emit TokensRedeemed(msg.sender, tokenAmount, usdcAmount, fee);
    }

    /**
     * @notice Mint tokens to specific address (governance/rewards)
     * @param to Recipient address
     * @param amount Amount of tokens to mint
     */
    function mintTo(address to, uint256 amount) external onlyValidRole(MINTER_ROLE) whenNotPaused {
        if (to == address(0)) revert Errors.ZeroAddress();
        if (amount == 0) revert Errors.InvalidInput("Amount cannot be zero");
        
        // Check max supply
        if (totalSupply() + amount > maxSupply) {
            revert MaxSupplyExceeded(totalSupply() + amount, maxSupply);
        }

        _mint(to, amount);
        emit TokensMinted(to, 0, amount); // 0 USDC as this is minted directly
    }

    /* ======== TREASURY MANAGEMENT ======== */

    /**
     * @notice Deposit USDC to strengthen reserves
     * @param amount Amount of USDC to deposit
     */
    function depositToTreasury(uint256 amount) external nonReentrant {
        if (amount == 0) revert Errors.InvalidInput("Amount cannot be zero");

        USDC.safeTransferFrom(msg.sender, address(this), amount);
        emit TreasuryDeposit(amount, msg.sender);
    }

    /**
     * @notice Withdraw USDC from treasury for community operations
     * @param recipient Address to receive USDC
     * @param amount Amount of USDC to withdraw
     * @param reason Reason for withdrawal
     */
    function withdrawFromTreasury(
        address recipient,
        uint256 amount,
        string calldata reason
    ) external onlyValidRole(TREASURY_ROLE) whenNotPaused nonReentrant {
        if (recipient == address(0)) revert Errors.ZeroAddress();
        if (amount == 0) revert Errors.InvalidInput("Amount cannot be zero");
        
        // Ensure withdrawal doesn't break 1:1 backing
        uint256 usdcBalance = USDC.balanceOf(address(this));
        uint256 reserveRequired = totalSupply(); // 1:1 backing requirement
        
        if (usdcBalance < reserveRequired + amount) {
            revert InsufficientTreasuryBalance(reserveRequired + amount, usdcBalance);
        }

        USDC.safeTransfer(recipient, amount);
        emit TreasuryWithdrawal(amount, recipient, reason);
    }

    /* ======== EMERGENCY FUNCTIONS ======== */

    /**
     * @notice Request emergency withdrawal (requires delay)
     * @param amount Amount to withdraw
     */
    function requestEmergencyWithdrawal(uint256 amount) external onlyValidRole(EMERGENCY_ROLE) {
        if (amount == 0) revert InvalidWithdrawalAmount(amount);
        
        uint256 requestId = emergencyWithdrawalCount++;
        emergencyWithdrawals[requestId] = EmergencyWithdrawal({
            amount: amount,
            requestTime: block.timestamp,
            executed: false,
            requestedBy: msg.sender
        });

        emit EmergencyWithdrawalRequested(requestId, amount, msg.sender);
    }

    /**
     * @notice Execute emergency withdrawal after delay
     * @param requestId ID of the withdrawal request
     * @param recipient Address to receive funds
     */
    function executeEmergencyWithdrawal(
        uint256 requestId,
        address recipient
    ) external onlyValidRole(EMERGENCY_ROLE) {
        if (recipient == address(0)) revert Errors.ZeroAddress();
        
        EmergencyWithdrawal storage withdrawal = emergencyWithdrawals[requestId];
        
        if (withdrawal.executed) {
            revert EmergencyWithdrawalAlreadyExecuted(requestId);
        }
        
        if (block.timestamp < withdrawal.requestTime + EMERGENCY_DELAY) {
            revert EmergencyWithdrawalNotReady(withdrawal.requestTime, block.timestamp);
        }

        uint256 usdcBalance = USDC.balanceOf(address(this));
        if (usdcBalance < withdrawal.amount) {
            revert InsufficientUSDCBalance(withdrawal.amount, usdcBalance);
        }

        withdrawal.executed = true;
        USDC.safeTransfer(recipient, withdrawal.amount);

        emit EmergencyWithdrawalExecuted(requestId, withdrawal.amount, recipient);
    }

    /**
     * @notice Pause contract in emergency
     */
    function pause() external onlyValidRole(EMERGENCY_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause contract
     */
    function unpause() external onlyValidRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /* ======== GOVERNANCE FUNCTIONS ======== */



    /**
     * @notice Update treasury address
     * @param newTreasury New treasury address
     */
    function setTreasury(address newTreasury) external onlyValidRole(DEFAULT_ADMIN_ROLE) {
        if (newTreasury == address(0)) revert Errors.ZeroAddress();
        
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }
    
    /**
     * @notice Update ParamController address
     * @param newParamController New ParamController address
     */
    function setParamController(address newParamController) external onlyValidRole(DEFAULT_ADMIN_ROLE) {
        if (newParamController == address(0)) revert Errors.ZeroAddress();
        paramController = ParamController(newParamController);
    }
    
    /**
     * @notice Get current effective redemption fee (reads from ParamController)
     * @return feeBps Current redemption fee in basis points
     */
    function getEffectiveRedemptionFee() external view returns (uint256 feeBps) {
        return _getRedemptionFeeBps();
    }    /**
     * @notice Update maximum supply
     * @param newMaxSupply New maximum supply
     */
    function setMaxSupply(uint256 newMaxSupply) external onlyValidRole(DEFAULT_ADMIN_ROLE) {
        if (newMaxSupply < totalSupply()) {
            revert Errors.InvalidInput("Max supply cannot be less than current supply");
        }

        uint256 oldMax = maxSupply;
        maxSupply = newMaxSupply;
        emit MaxSupplyUpdated(oldMax, newMaxSupply);
    }

    /* ======== VIEW FUNCTIONS ======== */

    /**
     * @notice Get backing ratio (should always be >= 100% for healthy operation)
     * @return ratio Backing ratio in basis points (10000 = 100%)
     */
    function getBackingRatio() external view returns (uint256 ratio) {
        uint256 supply = totalSupply();
        if (supply == 0) return 10000; // 100% if no tokens minted
        
        uint256 usdcBalance = USDC.balanceOf(address(this));
        ratio = (usdcBalance * 10000) / supply;
    }

    /**
     * @notice Calculate redemption amounts
     * @param tokenAmount Amount of tokens to redeem
     * @return grossUsdc Gross USDC amount before fee
     * @return fee Fee amount in USDC
     * @return netUsdc Net USDC amount after fee
     */
    function calculateRedemption(uint256 tokenAmount) external view returns (
        uint256 grossUsdc,
        uint256 fee,
        uint256 netUsdc
    ) {
        grossUsdc = tokenAmount; // 1:1 ratio
        fee = (grossUsdc * _getRedemptionFeeBps()) / 10000;
        netUsdc = grossUsdc - fee;
    }

    /**
     * @notice Get available treasury balance (above 1:1 backing requirement)
     * @return available Available USDC for treasury operations
     */
    function getAvailableTreasuryBalance() external view returns (uint256 available) {
        uint256 usdcBalance = USDC.balanceOf(address(this));
        uint256 requiredReserve = totalSupply();
        
        if (usdcBalance > requiredReserve) {
            available = usdcBalance - requiredReserve;
        } else {
            available = 0;
        }
    }

    /**
     * @notice Check if emergency withdrawal is ready for execution
     * @param requestId Withdrawal request ID
     * @return ready Whether withdrawal can be executed
     * @return timeRemaining Seconds remaining if not ready
     */
    function isEmergencyWithdrawalReady(uint256 requestId) external view returns (
        bool ready,
        uint256 timeRemaining
    ) {
        EmergencyWithdrawal memory withdrawal = emergencyWithdrawals[requestId];
        
        if (withdrawal.executed || withdrawal.requestTime == 0) {
            return (false, 0);
        }

        uint256 readyTime = withdrawal.requestTime + EMERGENCY_DELAY;
        if (block.timestamp >= readyTime) {
            ready = true;
            timeRemaining = 0;
        } else {
            ready = false;
            timeRemaining = readyTime - block.timestamp;
        }
    }
    
    /**
     * @notice Get redemption fee from ParamController
     * @return feeBps Fee in basis points
     */
    function _getRedemptionFeeBps() internal view returns (uint256 feeBps) {
        feeBps = paramController.getUint256(communityId, paramController.FEE_ON_WITHDRAW());
        // Cap at maximum allowed fee
        if (feeBps > MAX_REDEMPTION_FEE) {
            feeBps = MAX_REDEMPTION_FEE;
        }
    }
}
