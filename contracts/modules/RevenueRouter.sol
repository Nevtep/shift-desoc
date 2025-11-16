// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../libs/Errors.sol";

/**
 * @title RevenueRouter
 * @notice ROI-based revenue distribution system where investor share automatically decreases 
 *         as their return approaches target ROI, ensuring sustainable returns and community ownership
 * @dev Implements dynamic revenue distribution with investor ROI targeting and automatic transitions
 */
contract RevenueRouter is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /* ======== ROLES ======== */
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    bytes32 public constant INVESTOR_MANAGER_ROLE = keccak256("INVESTOR_MANAGER_ROLE");

    /* ======== CONSTANTS ======== */
    uint256 public constant MAX_BPS = 10000; // 100%
    uint256 public constant MIN_WORKER_SHARE_BPS = 3000; // 30% minimum for workers
    uint256 public constant MAX_INVESTOR_SHARE_BPS = 5000; // 50% maximum for investors
    uint256 public constant DEFAULT_TARGET_ROI_BPS = 15000; // 150% default target ROI

    /* ======== STATE VARIABLES ======== */
    
    /// @notice Community treasury address
    address public treasury;
    
    /// @notice Default revenue split percentages (in basis points)
    uint16 public baseworkersBps = 5000;    // 50% workers
    uint16 public baseTreasuryBps = 3000;   // 30% treasury  
    uint16 public baseInvestorsBps = 2000;  // 20% investors

    /// @notice Supported revenue tokens
    mapping(address => bool) public supportedTokens;
    
    /// @notice Investor tracking
    struct InvestorInfo {
        uint256 totalInvested;        // Total amount invested
        uint256 cumulativeRevenue;    // Total revenue received to date
        uint256 targetROI;            // Target ROI in basis points (e.g., 15000 = 150%)
        uint256 currentShareBps;      // Current revenue share in basis points
        bool isActive;                // Whether investor is active
        uint64 investmentTimestamp;   // When investment was made
    }
    
    mapping(address => InvestorInfo) public investors;
    address[] public investorList;
    
    /// @notice Worker revenue pools per token
    mapping(address => uint256) public workerPools;
    
    /// @notice Treasury reserves per token  
    mapping(address => uint256) public treasuryReserves;

    /// @notice Total revenue received per token
    mapping(address => uint256) public totalRevenue;

    /// @notice Worker claims tracking
    mapping(address => mapping(address => uint256)) public workerClaims; // worker => token => amount

    /* ======== EVENTS ======== */
    
    event RevenueReceived(address indexed token, uint256 amount, address indexed from);
    event RevenueDistributed(
        address indexed token, 
        uint256 amount, 
        uint256 workersShare, 
        uint256 treasuryShare, 
        uint256 investorsShare
    );
    
    event InvestorRegistered(
        address indexed investor, 
        uint256 amount, 
        uint256 targetROI, 
        uint256 initialShare
    );
    
    event InvestorShareUpdated(
        address indexed investor, 
        uint256 oldShare, 
        uint256 newShare, 
        uint256 currentROI
    );
    
    event WorkerRevenueWithdrawn(
        address indexed worker, 
        address indexed token, 
        uint256 amount
    );
    
    event TreasuryRevenueWithdrawn(
        address indexed token, 
        uint256 amount, 
        address indexed recipient
    );
    
    event InvestorRevenueWithdrawn(
        address indexed investor, 
        address indexed token, 
        uint256 amount
    );

    event TokenSupported(address indexed token, bool supported);
    event BaseSharesUpdated(uint16 workers, uint16 treasury, uint16 investors);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    /* ======== CONSTRUCTOR ======== */

    /**
     * @notice Initialize RevenueRouter with default parameters
     * @param _treasury Treasury address for community funds
     * @param _admin Admin role holder (typically governance)
     */
    constructor(
        address _treasury,
        address _admin
    ) {
        if (_treasury == address(0)) revert Errors.ZeroAddress();
        if (_admin == address(0)) revert Errors.ZeroAddress();

        treasury = _treasury;

        // Grant roles
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(TREASURY_ROLE, _treasury);
        _grantRole(DISTRIBUTOR_ROLE, _admin);
        _grantRole(INVESTOR_MANAGER_ROLE, _admin);
    }

    /* ======== REVENUE DISTRIBUTION ======== */

    /**
     * @notice Receive and distribute revenue from community activities
     * @param token Revenue token address
     * @param amount Revenue amount received
     * @dev Called by authorized distributors (e.g., Marketplace)
     */
    function distributeRevenue(
        address token, 
        uint256 amount
    ) external onlyRole(DISTRIBUTOR_ROLE) nonReentrant {
        if (amount == 0) revert Errors.InvalidInput("Zero amount");
        if (!supportedTokens[token]) revert Errors.InvalidInput("Unsupported token");

        // Transfer tokens from sender
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        totalRevenue[token] += amount;

        // Calculate dynamic distribution based on investor ROI status
        (uint256 workersShare, uint256 treasuryShare, uint256 investorsShare) = 
            _calculateDistribution(amount);

        // Update pools
        workerPools[token] += workersShare;
        treasuryReserves[token] += treasuryShare;
        
        // Distribute to investors and update their ROI tracking
        _distributeToInvestors(token, investorsShare);

        emit RevenueReceived(token, amount, msg.sender);
        emit RevenueDistributed(token, amount, workersShare, treasuryShare, investorsShare);
    }

    /**
     * @notice Calculate current revenue distribution based on investor ROI status
     * @param totalAmount Total revenue amount to distribute
     * @return workersShare Amount allocated to workers
     * @return treasuryShare Amount allocated to treasury  
     * @return investorsShare Amount allocated to investors
     */
    function _calculateDistribution(
        uint256 totalAmount
    ) internal view returns (uint256 workersShare, uint256 treasuryShare, uint256 investorsShare) {
        
        uint256 totalInvestorShare = 0;
        
        // Calculate total current investor share based on ROI status
        for (uint256 i = 0; i < investorList.length; i++) {
            address investor = investorList[i];
            InvestorInfo memory info = investors[investor];
            
            if (!info.isActive) continue;
            
            uint256 currentShare = _calculateInvestorShare(investor);
            totalInvestorShare += currentShare;
        }

        // Ensure investor share doesn't exceed maximum
        if (totalInvestorShare > MAX_INVESTOR_SHARE_BPS) {
            totalInvestorShare = MAX_INVESTOR_SHARE_BPS;
        }

        // Calculate actual investor allocation
        investorsShare = (totalAmount * totalInvestorShare) / MAX_BPS;
        
        // Calculate remaining amount after investor allocation
        uint256 remaining = totalAmount - investorsShare;
        
        // Distribute remaining between workers and treasury based on base ratios
        uint256 totalBase = baseworkersBps + baseTreasuryBps;
        workersShare = (remaining * baseworkersBps) / totalBase;
        treasuryShare = remaining - workersShare;

        // Ensure minimum worker share
        uint256 minWorkerAmount = (totalAmount * MIN_WORKER_SHARE_BPS) / MAX_BPS;
        if (workersShare < minWorkerAmount) {
            uint256 deficit = minWorkerAmount - workersShare;
            workersShare = minWorkerAmount;
            
            // Reduce other shares proportionally
            if (treasuryShare >= deficit) {
                treasuryShare -= deficit;
            } else {
                deficit -= treasuryShare;
                treasuryShare = 0;
                investorsShare = investorsShare >= deficit ? investorsShare - deficit : 0;
            }
        }
    }

    /**
     * @notice Calculate current revenue share for an investor based on ROI progress
     * @param investor Investor address
     * @return Current share in basis points
     */
    function _calculateInvestorShare(address investor) internal view returns (uint256) {
        InvestorInfo memory info = investors[investor];
        
        if (!info.isActive || info.totalInvested == 0) return 0;

        // Calculate current ROI achieved (in basis points)
        uint256 currentROI = (info.cumulativeRevenue * MAX_BPS) / info.totalInvested;
        
        // If target ROI reached, no more revenue share
        if (currentROI >= info.targetROI) return 0;
        
        // Linear decay: share decreases as ROI approaches target
        uint256 progress = (currentROI * MAX_BPS) / info.targetROI; // 0 to MAX_BPS
        uint256 remainingShare = info.currentShareBps * (MAX_BPS - progress) / MAX_BPS;
        
        return remainingShare;
    }

    /**
     * @notice Distribute revenue to investors and update their tracking
     * @param token Revenue token
     * @param totalInvestorAmount Total amount to distribute to investors
     */
    function _distributeToInvestors(address token, uint256 totalInvestorAmount) internal {
        if (totalInvestorAmount == 0) return;
        
        uint256 totalActiveShares = 0;
        
        // Calculate total active investor shares
        for (uint256 i = 0; i < investorList.length; i++) {
            address investor = investorList[i];
            if (investors[investor].isActive) {
                totalActiveShares += _calculateInvestorShare(investor);
            }
        }
        
        if (totalActiveShares == 0) {
            // No active investors, redirect to treasury
            treasuryReserves[token] += totalInvestorAmount;
            return;
        }
        
        // Distribute proportionally to active investors
        for (uint256 i = 0; i < investorList.length; i++) {
            address investor = investorList[i];
            InvestorInfo storage info = investors[investor];
            
            if (!info.isActive) continue;
            
            uint256 investorShare = _calculateInvestorShare(investor);
            if (investorShare == 0) continue;
            
            uint256 amount = (totalInvestorAmount * investorShare) / totalActiveShares;
            
            // Update investor revenue tracking
            info.cumulativeRevenue += amount;
            workerClaims[investor][token] += amount; // Reuse for investor tracking
            
            emit InvestorShareUpdated(
                investor, 
                investorShare, 
                _calculateInvestorShare(investor),
                (info.cumulativeRevenue * MAX_BPS) / info.totalInvested
            );
        }
    }

    /* ======== INVESTOR MANAGEMENT ======== */

    /**
     * @notice Register new investor with investment amount and target ROI
     * @param investor Investor address
     * @param investmentAmount Amount invested
     * @param targetROIBps Target ROI in basis points (e.g., 15000 = 150%)
     * @param initialShareBps Initial revenue share percentage
     */
    function registerInvestor(
        address investor,
        uint256 investmentAmount,
        uint256 targetROIBps,
        uint256 initialShareBps
    ) external onlyRole(INVESTOR_MANAGER_ROLE) {
        if (investor == address(0)) revert Errors.ZeroAddress();
        if (investmentAmount == 0) revert Errors.InvalidInput("Zero investment");
        if (targetROIBps < MAX_BPS) revert Errors.InvalidInput("Target ROI must be >= 100%");
        if (initialShareBps > MAX_INVESTOR_SHARE_BPS) revert Errors.InvalidInput("Share too high");

        InvestorInfo storage info = investors[investor];
        
        if (info.isActive) {
            // Update existing investor
            info.totalInvested += investmentAmount;
            info.targetROI = targetROIBps;
            info.currentShareBps = initialShareBps;
        } else {
            // New investor
            info.totalInvested = investmentAmount;
            info.targetROI = targetROIBps;
            info.currentShareBps = initialShareBps;
            info.isActive = true;
            info.investmentTimestamp = uint64(block.timestamp);
            
            investorList.push(investor);
        }

        emit InvestorRegistered(investor, investmentAmount, targetROIBps, initialShareBps);
    }

    /**
     * @notice Deactivate investor (they keep their earned revenue)
     * @param investor Investor to deactivate
     */
    function deactivateInvestor(address investor) external onlyRole(INVESTOR_MANAGER_ROLE) {
        investors[investor].isActive = false;
    }

    /* ======== WITHDRAWAL FUNCTIONS ======== */

    /**
     * @notice Withdraw accumulated revenue for a worker
     * @param token Revenue token to withdraw
     * @param amount Amount to withdraw
     */
    function withdrawWorkerRevenue(
        address token, 
        uint256 amount
    ) external nonReentrant {
        if (amount == 0) revert Errors.InvalidInput("Zero amount");
        if (workerClaims[msg.sender][token] < amount) {
            revert Errors.InsufficientBalance(msg.sender, amount, workerClaims[msg.sender][token]);
        }

        workerClaims[msg.sender][token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);

        emit WorkerRevenueWithdrawn(msg.sender, token, amount);
    }

    /**
     * @notice Withdraw treasury reserves
     * @param token Revenue token
     * @param amount Amount to withdraw
     * @param recipient Recipient address
     */
    function withdrawTreasuryRevenue(
        address token,
        uint256 amount,
        address recipient
    ) external onlyRole(TREASURY_ROLE) nonReentrant {
        if (amount == 0) revert Errors.InvalidInput("Zero amount");
        if (recipient == address(0)) revert Errors.ZeroAddress();
        if (treasuryReserves[token] < amount) {
            revert Errors.InsufficientBalance(address(this), amount, treasuryReserves[token]);
        }

        treasuryReserves[token] -= amount;
        IERC20(token).safeTransfer(recipient, amount);

        emit TreasuryRevenueWithdrawn(token, amount, recipient);
    }

    /**
     * @notice Withdraw investor revenue
     * @param token Revenue token
     * @param amount Amount to withdraw
     */
    function withdrawInvestorRevenue(
        address token,
        uint256 amount
    ) external nonReentrant {
        if (amount == 0) revert Errors.InvalidInput("Zero amount");
        if (!investors[msg.sender].isActive && investors[msg.sender].totalInvested == 0) {
            revert Errors.NotAuthorized(msg.sender);
        }
        if (workerClaims[msg.sender][token] < amount) {
            revert Errors.InsufficientBalance(msg.sender, amount, workerClaims[msg.sender][token]);
        }

        workerClaims[msg.sender][token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);

        emit InvestorRevenueWithdrawn(msg.sender, token, amount);
    }

    /* ======== CONFIGURATION ======== */

    /**
     * @notice Add or remove supported revenue tokens
     * @param token Token address
     * @param supported Whether token is supported
     */
    function setSupportedToken(
        address token, 
        bool supported
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        supportedTokens[token] = supported;
        emit TokenSupported(token, supported);
    }

    /**
     * @notice Update base revenue split percentages
     * @param _workersBps Workers share in basis points
     * @param _treasuryBps Treasury share in basis points  
     * @param _investorsBps Investors share in basis points
     */
    function updateBaseShares(
        uint16 _workersBps,
        uint16 _treasuryBps,
        uint16 _investorsBps
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_workersBps + _treasuryBps + _investorsBps != MAX_BPS) {
            revert Errors.InvalidInput("Shares must sum to 100%");
        }
        if (_workersBps < MIN_WORKER_SHARE_BPS) {
            revert Errors.InvalidInput("Worker share too low");
        }

        baseworkersBps = _workersBps;
        baseTreasuryBps = _treasuryBps;
        baseInvestorsBps = _investorsBps;

        emit BaseSharesUpdated(_workersBps, _treasuryBps, _investorsBps);
    }

    /**
     * @notice Update treasury address
     * @param _newTreasury New treasury address
     */
    function setTreasury(address _newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_newTreasury == address(0)) revert Errors.ZeroAddress();
        
        address oldTreasury = treasury;
        treasury = _newTreasury;
        
        // Update treasury role
        _revokeRole(TREASURY_ROLE, oldTreasury);
        _grantRole(TREASURY_ROLE, _newTreasury);

        emit TreasuryUpdated(oldTreasury, _newTreasury);
    }

    /* ======== VIEW FUNCTIONS ======== */

    /**
     * @notice Get investor information
     * @param investor Investor address
     * @return Investment info struct
     */
    function getInvestorInfo(address investor) external view returns (InvestorInfo memory) {
        return investors[investor];
    }

    /**
     * @notice Get current ROI for an investor
     * @param investor Investor address
     * @return Current ROI in basis points
     */
    function getInvestorROI(address investor) external view returns (uint256) {
        InvestorInfo memory info = investors[investor];
        if (info.totalInvested == 0) return 0;
        return (info.cumulativeRevenue * MAX_BPS) / info.totalInvested;
    }

    /**
     * @notice Get investor's current revenue share
     * @param investor Investor address
     * @return Current share in basis points
     */
    function getInvestorCurrentShare(address investor) external view returns (uint256) {
        return _calculateInvestorShare(investor);
    }

    /**
     * @notice Get available balance for worker
     * @param worker Worker address
     * @param token Token address
     * @return Available amount
     */
    function getWorkerBalance(address worker, address token) external view returns (uint256) {
        return workerClaims[worker][token];
    }

    /**
     * @notice Get treasury reserves for a token
     * @param token Token address
     * @return Reserve amount
     */
    function getTreasuryReserves(address token) external view returns (uint256) {
        return treasuryReserves[token];
    }

    /**
     * @notice Get worker pool size for a token
     * @param token Token address
     * @return Pool amount
     */
    function getWorkerPool(address token) external view returns (uint256) {
        return workerPools[token];
    }

    /**
     * @notice Get all active investors
     * @return Array of investor addresses
     */
    function getActiveInvestors() external view returns (address[] memory) {
        address[] memory active = new address[](investorList.length);
        uint256 count = 0;
        
        for (uint256 i = 0; i < investorList.length; i++) {
            if (investors[investorList[i]].isActive) {
                active[count] = investorList[i];
                count++;
            }
        }
        
        // Resize array to actual count
        assembly {
            mstore(active, count)
        }
        
        return active;
    }

    /**
     * @notice Preview revenue distribution for a given amount
     * @param amount Amount to distribute
     * @return workersShare Workers allocation
     * @return treasuryShare Treasury allocation
     * @return investorsShare Investors allocation
     */
    function previewDistribution(
        uint256 amount
    ) external view returns (uint256 workersShare, uint256 treasuryShare, uint256 investorsShare) {
        return _calculateDistribution(amount);
    }
}
