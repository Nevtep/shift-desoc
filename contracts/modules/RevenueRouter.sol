// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../libs/Errors.sol";

/// @notice Interface for ParamController integration
interface IParamController {
    function getRevenuePolicy(uint256 communityId) external view returns (
        uint256 minWorkersBps,
        uint256 treasuryBps,
        uint256 investorsBps,
        uint8 spilloverTarget
    );
}

/// @notice Interface for CohortRegistry integration
interface ICohortRegistry {
    struct Cohort {
        uint256 id;
        uint256 communityId;
        uint16 targetRoiBps;
        uint64 createdAt;
        uint64 startAt;
        uint64 endAt;
        uint32 priorityWeight;
        uint256 investedTotal;
        uint256 recoveredTotal;
        bool active;
        bytes32 termsHash;
    }
    
    function getActiveCohorts(uint256 communityId) external view returns (uint256[] memory);
    function getCohort(uint256 cohortId) external view returns (Cohort memory);
    function getCohortInvestors(uint256 cohortId) external view returns (address[] memory);
    function getInvestmentAmount(uint256 cohortId, address investor) external view returns (uint256);
    function markRecovered(uint256 cohortId, uint256 amount) external;
    function getUnrecoveredAmount(uint256 cohortId) external view returns (uint256);
    function getCohortWeight(uint256 cohortId, bool useWeights) external view returns (uint256);
}

/**
 * @title RevenueRouter
 * @notice Cohort-based revenue distribution system with waterfall allocation ensuring
 *         guaranteed Target ROI while transitioning revenue to workers as cohorts complete
 * @dev Pure executor that reads policy from ParamController and distributes via CohortRegistry
 */
contract RevenueRouter is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /* ======== ROLES ======== */
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");

    /* ======== CONSTANTS ======== */
    uint256 public constant MAX_BPS = 10000; // 100%
    uint256 public constant MIN_WORKER_SHARE_BPS = 3000; // 30% minimum for workers
    
    /* ======== STATE VARIABLES ======== */
    
    /// @notice ParamController for reading community policies
    IParamController public paramController;
    
    /// @notice CohortRegistry for managing investment cohorts
    ICohortRegistry public cohortRegistry;
    
    /// @notice Community treasury addresses
    mapping(uint256 => address) public communityTreasuries;
    
    /// @notice Supported revenue tokens per community
    mapping(uint256 => mapping(address => bool)) public supportedTokens;
    
    /// @notice Worker revenue pools per community and token
    mapping(uint256 => mapping(address => uint256)) public workerPools;
    
    /// @notice Treasury reserves per community and token
    mapping(uint256 => mapping(address => uint256)) public treasuryReserves;
    
    /// @notice Total revenue received per community and token
    mapping(uint256 => mapping(address => uint256)) public totalRevenue;
    
    /// @notice Worker claims tracking per community
    mapping(uint256 => mapping(address => mapping(address => uint256))) public workerClaims; // [community][worker][token] = amount
    
    /// @notice Investor claims tracking per cohort
    mapping(uint256 => mapping(address => mapping(address => uint256))) public investorClaims; // [cohort][investor][token] = amount

    /* ======== EVENTS ======== */
    
    event RevenueReceived(
        uint256 indexed communityId,
        address indexed token, 
        uint256 amount, 
        address indexed from
    );
    
    event RevenueRouted(
        uint256 indexed communityId,
        address indexed token,
        uint256 totalAmount,
        uint256 workersMin,
        uint256 treasuryBase,
        uint256 investorPool,
        uint256 spillover,
        uint8 spilloverTarget
    );
    
    event CohortPaid(
        uint256 indexed cohortId,
        address indexed token,
        uint256 amount,
        uint256 investorsCount
    );
    
    event WorkerRevenueWithdrawn(
        uint256 indexed communityId,
        address indexed worker, 
        address indexed token, 
        uint256 amount
    );
    
    event TreasuryRevenueWithdrawn(
        uint256 indexed communityId,
        address indexed token, 
        uint256 amount, 
        address indexed recipient
    );
    
    event InvestorRevenueWithdrawn(
        uint256 indexed cohortId,
        address indexed investor, 
        address indexed token, 
        uint256 amount
    );

    event ParamControllerUpdated(address oldController, address newController);
    event CohortRegistryUpdated(address oldRegistry, address newRegistry);
    event CommunityTreasuryUpdated(uint256 indexed communityId, address oldTreasury, address newTreasury);
    event TokenSupportUpdated(uint256 indexed communityId, address indexed token, bool supported);

    /* ======== CONSTRUCTOR ======== */

    /**
     * @notice Initialize RevenueRouter with controller dependencies
     * @param _paramController ParamController address for policy reading
     * @param _cohortRegistry CohortRegistry address for cohort management
     * @param _admin Admin role holder (typically governance)
     */
    constructor(
        address _paramController,
        address _cohortRegistry,
        address _admin
    ) {
        if (_paramController == address(0)) revert Errors.ZeroAddress();
        if (_cohortRegistry == address(0)) revert Errors.ZeroAddress();
        if (_admin == address(0)) revert Errors.ZeroAddress();

        paramController = IParamController(_paramController);
        cohortRegistry = ICohortRegistry(_cohortRegistry);

        // Grant roles
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(DISTRIBUTOR_ROLE, _admin);
    }

    /* ======== REVENUE DISTRIBUTION ======== */

    /**
     * @notice Route revenue through waterfall distribution model
     * @param communityId Community identifier
     * @param token Revenue token address
     * @param amount Revenue amount received
     * @dev Implements: Workers Min → Treasury Base → Investor Pool → Spillover → Workers Remainder
     */
    function routeRevenue(
        uint256 communityId,
        address token,
        uint256 amount
    ) external onlyRole(DISTRIBUTOR_ROLE) nonReentrant {
        if (amount == 0) revert Errors.InvalidInput("Zero amount");
        if (!supportedTokens[communityId][token]) revert Errors.InvalidInput("Unsupported token");

        // Transfer tokens from sender
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        totalRevenue[communityId][token] += amount;

        // 1. Read community policy from ParamController
        (uint256 minWorkersBps, uint256 treasuryBps, uint256 investorsBps, 
         uint8 spilloverTarget) = paramController.getRevenuePolicy(communityId);

        // 2. Pay workers minimum guarantee
        uint256 workersMin = amount * minWorkersBps / MAX_BPS;
        workerPools[communityId][token] += workersMin;
        uint256 remaining = amount - workersMin;

        // 3. Pay treasury base allocation from remaining
        uint256 treasuryBase = remaining * treasuryBps / (treasuryBps + investorsBps);
        treasuryReserves[communityId][token] += treasuryBase;
        remaining -= treasuryBase;

        // 4. Calculate investor pool from remaining (remaining IS the investor pool after treasury allocation)
        uint256 investorPool = remaining;
        
        // 5. Distribute to active cohorts by unrecovered amounts and priority weights
        uint256 spillover = _distributeToActiveCohorts(communityId, token, investorPool);
        
        // 6. Handle spillover from inactive/completed cohorts
        if (spillover > 0) {
            if (spilloverTarget == 0) {
                workerPools[communityId][token] += spillover; // Spillover to workers (default)
            } else {
                treasuryReserves[communityId][token] += spillover; // Spillover to treasury
            }
        }
        
        // 7. Pay workers remainder
        uint256 workersRemainder = remaining - investorPool;
        workerPools[communityId][token] += workersRemainder;

        emit RevenueReceived(communityId, token, amount, msg.sender);
        emit RevenueRouted(
            communityId, 
            token, 
            amount, 
            workersMin, 
            treasuryBase, 
            investorPool, 
            spillover,
            spilloverTarget
        );
    }

    /**
     * @notice Distribute investor pool to active cohorts based on unrecovered amounts and priority weights
     * @param communityId Community identifier
     * @param token Revenue token
     * @param investorPool Total amount to distribute to investors
     * @return spillover Amount that couldn't be distributed (from inactive cohorts)
     */
    function _distributeToActiveCohorts(
        uint256 communityId,
        address token,
        uint256 investorPool
    ) internal returns (uint256 spillover) {
        if (investorPool == 0) return 0;
        
        uint256[] memory activeCohorts = cohortRegistry.getActiveCohorts(communityId);
        if (activeCohorts.length == 0) {
            return investorPool; // All spillover if no active cohorts
        }
        
        // Calculate total weight for distribution
        uint256 totalWeight = 0;
        uint256[] memory weights = new uint256[](activeCohorts.length);
        
        for (uint256 i = 0; i < activeCohorts.length; i++) {
            weights[i] = cohortRegistry.getCohortWeight(activeCohorts[i], true); // Use priority weights
            totalWeight += weights[i];
        }
        
        if (totalWeight == 0) {
            return investorPool; // All spillover if no weight
        }
        
        spillover = investorPool;
        
        // Distribute to cohorts proportionally
        for (uint256 i = 0; i < activeCohorts.length; i++) {
            if (weights[i] == 0) continue;
            
            uint256 cohortId = activeCohorts[i];
            uint256 cohortPayment = investorPool * weights[i] / totalWeight;
            
            if (cohortPayment > 0) {
                _distributeToCohortInvestors(cohortId, token, cohortPayment);
                cohortRegistry.markRecovered(cohortId, cohortPayment);
                spillover -= cohortPayment;
                
                // Get investor count for event
                address[] memory investors = cohortRegistry.getCohortInvestors(cohortId);
                emit CohortPaid(cohortId, token, cohortPayment, investors.length);
            }
        }
    }

    /**
     * @notice Distribute cohort payment to individual investors pro-rata by investment amount
     * @param cohortId Cohort identifier
     * @param token Revenue token
     * @param totalPayment Total payment for this cohort
     */
    function _distributeToCohortInvestors(
        uint256 cohortId,
        address token,
        uint256 totalPayment
    ) internal {
        address[] memory investors = cohortRegistry.getCohortInvestors(cohortId);
        if (investors.length == 0) return;
        
        ICohortRegistry.Cohort memory cohort = cohortRegistry.getCohort(cohortId);
        if (cohort.investedTotal == 0) return;
        
        // Distribute pro-rata by investment amount
        for (uint256 i = 0; i < investors.length; i++) {
            address investor = investors[i];
            uint256 investmentAmount = cohortRegistry.getInvestmentAmount(cohortId, investor);
            
            if (investmentAmount > 0) {
                uint256 investorPayment = totalPayment * investmentAmount / cohort.investedTotal;
                if (investorPayment > 0) {
                    investorClaims[cohortId][investor][token] += investorPayment;
                }
            }
        }
    }

    /* ======== WITHDRAWAL FUNCTIONS ======== */

    /**
     * @notice Withdraw accumulated revenue for a worker
     * @param communityId Community identifier
     * @param token Revenue token to withdraw
     * @param amount Amount to withdraw
     */
    function withdrawWorkerRevenue(
        uint256 communityId,
        address token, 
        uint256 amount
    ) external nonReentrant {
        if (amount == 0) revert Errors.InvalidInput("Zero amount");
        if (workerClaims[communityId][msg.sender][token] < amount) {
            revert Errors.InsufficientBalance(
                msg.sender, 
                amount, 
                workerClaims[communityId][msg.sender][token]
            );
        }

        workerClaims[communityId][msg.sender][token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);

        emit WorkerRevenueWithdrawn(communityId, msg.sender, token, amount);
    }

    /**
     * @notice Withdraw treasury reserves
     * @param communityId Community identifier
     * @param token Revenue token
     * @param amount Amount to withdraw
     * @param recipient Recipient address
     */
    function withdrawTreasuryRevenue(
        uint256 communityId,
        address token,
        uint256 amount,
        address recipient
    ) external nonReentrant {
        address treasury = communityTreasuries[communityId];
        if (treasury == address(0)) revert Errors.ZeroAddress();
        if (msg.sender != treasury && !hasRole(TREASURY_ROLE, msg.sender)) {
            revert Errors.NotAuthorized(msg.sender);
        }
        
        if (amount == 0) revert Errors.InvalidInput("Zero amount");
        if (recipient == address(0)) revert Errors.ZeroAddress();
        if (treasuryReserves[communityId][token] < amount) {
            revert Errors.InsufficientBalance(
                address(this), 
                amount, 
                treasuryReserves[communityId][token]
            );
        }

        treasuryReserves[communityId][token] -= amount;
        IERC20(token).safeTransfer(recipient, amount);

        emit TreasuryRevenueWithdrawn(communityId, token, amount, recipient);
    }

    /**
     * @notice Withdraw investor revenue from cohort
     * @param cohortId Cohort identifier
     * @param token Revenue token
     * @param amount Amount to withdraw
     */
    function withdrawInvestorRevenue(
        uint256 cohortId,
        address token,
        uint256 amount
    ) external nonReentrant {
        if (amount == 0) revert Errors.InvalidInput("Zero amount");
        if (investorClaims[cohortId][msg.sender][token] < amount) {
            revert Errors.InsufficientBalance(
                msg.sender, 
                amount, 
                investorClaims[cohortId][msg.sender][token]
            );
        }

        investorClaims[cohortId][msg.sender][token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);

        emit InvestorRevenueWithdrawn(cohortId, msg.sender, token, amount);
    }

    /**
     * @notice Allocate worker revenue based on WorkerSBT verification
     * @param communityId Community identifier
     * @param worker Worker address
     * @param token Revenue token
     * @param amount Amount to allocate
     * @dev Called by authorized distributors (e.g., Claims contract)
     */
    function allocateWorkerRevenue(
        uint256 communityId,
        address worker,
        address token,
        uint256 amount
    ) external onlyRole(DISTRIBUTOR_ROLE) {
        if (worker == address(0)) revert Errors.ZeroAddress();
        if (amount == 0) return;
        if (workerPools[communityId][token] < amount) {
            revert Errors.InsufficientBalance(
                address(this), 
                amount, 
                workerPools[communityId][token]
            );
        }

        workerPools[communityId][token] -= amount;
        workerClaims[communityId][worker][token] += amount;
    }

    /* ======== CONFIGURATION ======== */

    /**
     * @notice Set supported token for a community
     * @param communityId Community identifier
     * @param token Token address
     * @param supported Whether token is supported
     */
    function setSupportedToken(
        uint256 communityId,
        address token, 
        bool supported
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        supportedTokens[communityId][token] = supported;
        emit TokenSupportUpdated(communityId, token, supported);
    }

    /**
     * @notice Set community treasury address
     * @param communityId Community identifier
     * @param treasury Treasury address
     */
    function setCommunityTreasury(
        uint256 communityId,
        address treasury
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (treasury == address(0)) revert Errors.ZeroAddress();
        
        address oldTreasury = communityTreasuries[communityId];
        communityTreasuries[communityId] = treasury;
        
        // Grant treasury role to new address
        _grantRole(TREASURY_ROLE, treasury);
        
        // Revoke treasury role from old address if it exists
        if (oldTreasury != address(0)) {
            _revokeRole(TREASURY_ROLE, oldTreasury);
        }

        emit CommunityTreasuryUpdated(communityId, oldTreasury, treasury);
    }

    /**
     * @notice Update ParamController address
     * @param _paramController New ParamController address
     */
    function setParamController(address _paramController) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_paramController == address(0)) revert Errors.ZeroAddress();
        address oldController = address(paramController);
        paramController = IParamController(_paramController);
        emit ParamControllerUpdated(oldController, _paramController);
    }

    /**
     * @notice Update CohortRegistry address
     * @param _cohortRegistry New CohortRegistry address
     */
    function setCohortRegistry(address _cohortRegistry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_cohortRegistry == address(0)) revert Errors.ZeroAddress();
        address oldRegistry = address(cohortRegistry);
        cohortRegistry = ICohortRegistry(_cohortRegistry);
        emit CohortRegistryUpdated(oldRegistry, _cohortRegistry);
    }

    /* ======== VIEW FUNCTIONS ======== */

    /**
     * @notice Get available balance for worker
     * @param communityId Community identifier
     * @param worker Worker address
     * @param token Token address
     * @return Available amount
     */
    function getWorkerBalance(
        uint256 communityId,
        address worker, 
        address token
    ) external view returns (uint256) {
        return workerClaims[communityId][worker][token];
    }

    /**
     * @notice Get available balance for investor in cohort
     * @param cohortId Cohort identifier
     * @param investor Investor address
     * @param token Token address
     * @return Available amount
     */
    function getInvestorBalance(
        uint256 cohortId,
        address investor,
        address token
    ) external view returns (uint256) {
        return investorClaims[cohortId][investor][token];
    }

    /**
     * @notice Get treasury reserves for a community and token
     * @param communityId Community identifier
     * @param token Token address
     * @return Reserve amount
     */
    function getTreasuryReserves(uint256 communityId, address token) external view returns (uint256) {
        return treasuryReserves[communityId][token];
    }

    /**
     * @notice Get worker pool size for a community and token
     * @param communityId Community identifier
     * @param token Token address
     * @return Pool amount
     */
    function getWorkerPool(uint256 communityId, address token) external view returns (uint256) {
        return workerPools[communityId][token];
    }

    /**
     * @notice Preview revenue distribution for a given amount
     * @param communityId Community identifier
     * @param amount Amount to distribute
     * @return workersMin Workers minimum allocation
     * @return treasuryBase Treasury base allocation
     * @return investorPool Investors pool allocation
     * @return spilloverTarget Where spillover goes (0 = workers, 1 = treasury)
     */
    function previewDistribution(
        uint256 communityId,
        uint256 amount
    ) external view returns (
        uint256 workersMin, 
        uint256 treasuryBase, 
        uint256 investorPool,
        uint8 spilloverTarget
    ) {
        (uint256 minWorkersBps, uint256 treasuryBps, uint256 investorsBps, 
         uint8 target) = paramController.getRevenuePolicy(communityId);

        workersMin = amount * minWorkersBps / MAX_BPS;
        uint256 remaining = amount - workersMin;
        
        treasuryBase = remaining * treasuryBps / (treasuryBps + investorsBps);
        investorPool = remaining * investorsBps / (treasuryBps + investorsBps);
        spilloverTarget = target;
    }

    /**
     * @notice Get cohort distribution preview
     * @param communityId Community identifier
     * @param investorPool Total investor pool amount
     * @return cohortIds Array of active cohort IDs
     * @return cohortPayments Array of payments for each cohort
     * @return totalDistributed Total amount that will be distributed
     */
    function previewCohortDistribution(
        uint256 communityId,
        uint256 investorPool
    ) external view returns (
        uint256[] memory cohortIds,
        uint256[] memory cohortPayments,
        uint256 totalDistributed
    ) {
        cohortIds = cohortRegistry.getActiveCohorts(communityId);
        cohortPayments = new uint256[](cohortIds.length);
        
        if (investorPool == 0 || cohortIds.length == 0) {
            return (cohortIds, cohortPayments, 0);
        }
        
        // Calculate weights
        uint256 totalWeight = 0;
        uint256[] memory weights = new uint256[](cohortIds.length);
        
        for (uint256 i = 0; i < cohortIds.length; i++) {
            weights[i] = cohortRegistry.getCohortWeight(cohortIds[i], true);
            totalWeight += weights[i];
        }
        
        if (totalWeight == 0) {
            return (cohortIds, cohortPayments, 0);
        }
        
        // Calculate payments
        for (uint256 i = 0; i < cohortIds.length; i++) {
            cohortPayments[i] = investorPool * weights[i] / totalWeight;
            totalDistributed += cohortPayments[i];
        }
    }
}