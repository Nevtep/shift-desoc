// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Errors} from "contracts/libs/Errors.sol";

/// @title CohortRegistry
/// @notice Manages investment cohorts with immutable terms and Target ROI tracking
/// @dev Investment cohorts guarantee Target ROI returns with priority weighting and spillover mechanics
contract CohortRegistry {
    /// @notice Cohort data structure with immutable terms
    struct Cohort {
        uint256 id;                 // Unique cohort identifier
        uint256 communityId;        // Associated community
        uint16 targetRoiBps;        // Target ROI in basis points (e.g., 15000 = 150%)
        uint64 createdAt;           // Creation timestamp
        uint64 startAt;             // Optional start time (0 = immediate)
        uint64 endAt;               // Optional end/expiry time (0 = none)
        uint32 priorityWeight;      // Priority weight for distribution (default: 1)
        uint256 investedTotal;      // Total amount invested in this cohort
        uint256 recoveredTotal;     // Total revenue paid to this cohort
        bool active;                // Active until Target ROI reached or deactivated
        bytes32 termsHash;          // Immutable hash of cohort terms
    }
    
    /// @notice Access control addresses
    address public timelock;           // Timelock for cohort creation and config
    address public revenueRouter;      // Only RevenueRouter can mark recovery
    address public valuableActionSBT;  // SBT contract for investment recording
    address public investmentManager;  // Optional manager (e.g., InvestmentCohortManager) allowed to create/update/record
    
    /// @notice Cohort storage
    mapping(uint256 => Cohort) public cohorts;
    mapping(uint256 => mapping(address => uint256)) public investedBy; // [cohortId][investor] = amount
    mapping(uint256 => uint256) public investmentByToken; // tokenId => amount
    mapping(uint256 => uint256) public tokenCohort;       // tokenId => cohortId
    mapping(uint256 => uint256[]) public activeCohortsByCommunity;
    mapping(uint256 => address[]) public cohortInvestors; // [cohortId] = investor addresses
    
    /// @notice Global state
    uint256 public nextCohortId = 1;
    
    /// @notice Events
    event CohortCreated(
        uint256 indexed communityId,
        uint256 indexed cohortId,
        uint16 targetRoiBps,
        uint32 priorityWeight,
        bytes32 termsHash
    );
    event InvestmentAdded(
        uint256 indexed cohortId,
        address indexed investor,
        uint256 amount
    );
    event CohortPaid(
        uint256 indexed cohortId,
        uint256 amount,
        uint256 newRecoveredTotal
    );
    event CohortCompleted(
        uint256 indexed cohortId,
        uint256 finalRecoveredTotal
    );
    event TimelockUpdated(address oldTimelock, address newTimelock);
    event RevenueRouterUpdated(address oldRouter, address newRouter);
    event ValuableActionSBTUpdated(address oldSBT, address newSBT);
    
    /// @notice Access control modifiers
    modifier onlyTimelock() {
        if (msg.sender != timelock) revert Errors.NotAuthorized(msg.sender);
        _;
    }
    
    modifier onlyRevenueRouter() {
        if (msg.sender != revenueRouter) revert Errors.NotAuthorized(msg.sender);
        _;
    }
    
    modifier onlyInvestmentRecorder() {
        if (msg.sender != valuableActionSBT && msg.sender != investmentManager) {
            revert Errors.NotAuthorized(msg.sender);
        }
        _;
    }
    
    /// @notice Constructor
    /// @param _timelock Timelock contract address
    constructor(address _timelock) {
        if (_timelock == address(0)) revert Errors.ZeroAddress();
        timelock = _timelock;
        emit TimelockUpdated(address(0), _timelock);
    }
    
    /// @notice Create a new investment cohort with immutable terms
    /// @param communityId Community identifier
    /// @param targetRoiBps Target ROI in basis points (e.g., 15000 = 150%)
    /// @param priorityWeight Priority weight for distribution (higher = faster recovery)
    /// @param termsHash Immutable hash of cohort terms
    /// @return cohortId Unique cohort identifier
    function createCohort(
        uint256 communityId,
        uint16 targetRoiBps,
        uint32 priorityWeight,
        bytes32 termsHash,
        uint64 startAt,
        uint64 endAt,
        bool active
    ) external returns (uint256 cohortId) {
        if (msg.sender != timelock && msg.sender != investmentManager) revert Errors.NotAuthorized(msg.sender);
        if (communityId == 0) revert Errors.InvalidInput("Community ID cannot be zero");
        if (targetRoiBps < 10000) revert Errors.InvalidInput("Target ROI must be >= 100%");
        if (priorityWeight == 0) revert Errors.InvalidInput("Priority weight must be > 0");
        if (termsHash == bytes32(0)) revert Errors.InvalidInput("Terms hash cannot be empty");
        if (endAt != 0 && endAt <= startAt) revert Errors.InvalidInput("Invalid schedule");
        
        cohortId = nextCohortId++;
        
        cohorts[cohortId] = Cohort({
            id: cohortId,
            communityId: communityId,
            targetRoiBps: targetRoiBps,
            createdAt: uint64(block.timestamp),
            startAt: startAt,
            endAt: endAt,
            priorityWeight: priorityWeight,
            investedTotal: 0,
            recoveredTotal: 0,
            active: active,
            termsHash: termsHash
        });
        if (active) {
            activeCohortsByCommunity[communityId].push(cohortId);
        }
        
        emit CohortCreated(communityId, cohortId, targetRoiBps, priorityWeight, termsHash);
    }
    
    /// @notice Add investment to a cohort (called by ValuableActionSBT)
    /// @param cohortId Cohort identifier
    /// @param investor Investor address
    /// @param amount Investment amount
    /// @param tokenId Investment SBT identifier
    function addInvestment(
        uint256 cohortId,
        address investor,
        uint256 amount,
        uint256 tokenId
    ) external onlyInvestmentRecorder {
        if (cohortId == 0 || cohortId >= nextCohortId) revert Errors.InvalidInput("Invalid cohort ID");
        if (investor == address(0)) revert Errors.ZeroAddress();
        if (amount == 0) revert Errors.InvalidInput("Investment amount must be > 0");
        if (!cohorts[cohortId].active) revert Errors.InvalidInput("Cohort is not active");
        if (tokenId == 0) revert Errors.InvalidInput("Invalid tokenId");
        
        // Add to investor's total in this cohort
        if (investedBy[cohortId][investor] == 0) {
            // First investment by this investor in this cohort
            cohortInvestors[cohortId].push(investor);
        }
        investedBy[cohortId][investor] += amount;
        cohorts[cohortId].investedTotal += amount;

        investmentByToken[tokenId] = amount;
        tokenCohort[tokenId] = cohortId;
        
        emit InvestmentAdded(cohortId, investor, amount);
    }
    
    /// @notice Mark revenue as recovered by a cohort (called by RevenueRouter)
    /// @param cohortId Cohort identifier
    /// @param amount Amount recovered
    function markRecovered(uint256 cohortId, uint256 amount) external onlyRevenueRouter {
        if (cohortId == 0 || cohortId >= nextCohortId) revert Errors.InvalidInput("Invalid cohort ID");
        if (amount == 0) return; // No-op if no amount
        
        Cohort storage cohort = cohorts[cohortId];
        if (!cohort.active) revert Errors.InvalidInput("Cohort is not active");
        
        cohort.recoveredTotal += amount;
        
        // Check if Target ROI reached
        uint256 targetTotal = cohort.investedTotal * cohort.targetRoiBps / 10000;
        if (cohort.recoveredTotal >= targetTotal) {
            cohort.active = false;
            _removeFromActiveCohorts(cohort.communityId, cohortId);
            emit CohortCompleted(cohortId, cohort.recoveredTotal);
        }
        
        emit CohortPaid(cohortId, amount, cohort.recoveredTotal);
    }

    /// @notice Manually toggle cohort active status
    /// @param cohortId Cohort identifier
    /// @param active New active status
    function setCohortActive(uint256 cohortId, bool active) external {
        if (msg.sender != timelock && msg.sender != investmentManager) revert Errors.NotAuthorized(msg.sender);
        if (cohortId == 0 || cohortId >= nextCohortId) revert Errors.InvalidInput("Invalid cohort ID");
        Cohort storage cohort = cohorts[cohortId];
        if (cohort.active == active) return;

        cohort.active = active;
        if (active) {
            activeCohortsByCommunity[cohort.communityId].push(cohortId);
        } else {
            _removeFromActiveCohorts(cohort.communityId, cohortId);
        }
    }
    
    /// @notice Get cohort information
    /// @param cohortId Cohort identifier
    /// @return Cohort struct
    function getCohort(uint256 cohortId) external view returns (Cohort memory) {
        if (cohortId == 0 || cohortId >= nextCohortId) revert Errors.InvalidInput("Invalid cohort ID");
        return cohorts[cohortId];
    }

    /// @notice Check if cohort is active
    function isCohortActive(uint256 cohortId) external view returns (bool) {
        if (cohortId == 0 || cohortId >= nextCohortId) revert Errors.InvalidInput("Invalid cohort ID");
        return cohorts[cohortId].active;
    }

    /// @notice Get community for cohort
    function getCohortCommunity(uint256 cohortId) external view returns (uint256) {
        if (cohortId == 0 || cohortId >= nextCohortId) revert Errors.InvalidInput("Invalid cohort ID");
        return cohorts[cohortId].communityId;
    }
    
    /// @notice Get active cohorts for a community
    /// @param communityId Community identifier
    /// @return Array of active cohort IDs
    function getActiveCohorts(uint256 communityId) external view returns (uint256[] memory) {
        return activeCohortsByCommunity[communityId];
    }
    
    /// @notice Get investors in a cohort
    /// @param cohortId Cohort identifier
    /// @return Array of investor addresses
    function getCohortInvestors(uint256 cohortId) external view returns (address[] memory) {
        return cohortInvestors[cohortId];
    }
    
    /// @notice Get investment amount by investor in cohort
    /// @param cohortId Cohort identifier
    /// @param investor Investor address
    /// @return Investment amount
    function getInvestmentAmount(uint256 cohortId, address investor) external view returns (uint256) {
        return investedBy[cohortId][investor];
    }

    /// @notice Get investment amount by tokenId
    function getInvestmentAmountByToken(uint256 tokenId) external view returns (uint256) {
        return investmentByToken[tokenId];
    }
    
    /// @notice Calculate unrecovered amount for a cohort
    /// @param cohortId Cohort identifier
    /// @return Unrecovered amount needed to reach Target ROI
    function getUnrecoveredAmount(uint256 cohortId) external view returns (uint256) {
        Cohort memory cohort = cohorts[cohortId];
        if (!cohort.active) return 0;
        
        uint256 targetTotal = cohort.investedTotal * cohort.targetRoiBps / 10000;
        return targetTotal > cohort.recoveredTotal ? targetTotal - cohort.recoveredTotal : 0;
    }
    
    /// @notice Calculate cohort weight for distribution
    /// @param cohortId Cohort identifier
    /// @param useWeights Whether to apply priority weights
    /// @return Distribution weight
    function getCohortWeight(uint256 cohortId, bool useWeights) external view returns (uint256) {
        uint256 unrecovered = this.getUnrecoveredAmount(cohortId);
        if (unrecovered == 0) return 0;
        
        if (useWeights) {
            return unrecovered * cohorts[cohortId].priorityWeight;
        } else {
            return unrecovered;
        }
    }
    
    /// @notice Check if cohort has reached Target ROI
    /// @param cohortId Cohort identifier
    /// @return Whether Target ROI is reached
    function hasReachedTargetROI(uint256 cohortId) external view returns (bool) {
        Cohort memory cohort = cohorts[cohortId];
        uint256 targetTotal = cohort.investedTotal * cohort.targetRoiBps / 10000;
        return cohort.recoveredTotal >= targetTotal;
    }
    
    /// @notice Get cohort ROI progress as percentage (basis points)
    /// @param cohortId Cohort identifier
    /// @return ROI progress in basis points (10000 = 100% of target)
    function getCohortROIProgress(uint256 cohortId) external view returns (uint256) {
        Cohort memory cohort = cohorts[cohortId];
        if (cohort.investedTotal == 0) return 0;
        
        uint256 targetTotal = cohort.investedTotal * cohort.targetRoiBps / 10000;
        if (targetTotal == 0) return 0;
        
        return (cohort.recoveredTotal * 10000) / targetTotal;
    }
    
    /// @notice Set RevenueRouter address
    /// @param _revenueRouter New RevenueRouter address
    function setRevenueRouter(address _revenueRouter) external onlyTimelock {
        if (_revenueRouter == address(0)) revert Errors.ZeroAddress();
        address oldRouter = revenueRouter;
        revenueRouter = _revenueRouter;
        emit RevenueRouterUpdated(oldRouter, _revenueRouter);
    }
    
    /// @notice Set ValuableActionSBT address
    /// @param _valuableActionSBT New ValuableActionSBT address
    function setValuableActionSBT(address _valuableActionSBT) external onlyTimelock {
        if (_valuableActionSBT == address(0)) revert Errors.ZeroAddress();
        address oldSBT = valuableActionSBT;
        valuableActionSBT = _valuableActionSBT;
        emit ValuableActionSBTUpdated(oldSBT, _valuableActionSBT);
    }

    /// @notice Set investment manager address (e.g., InvestmentCohortManager)
    function setInvestmentManager(address _investmentManager) external onlyTimelock {
        if (_investmentManager == address(0)) revert Errors.ZeroAddress();
        investmentManager = _investmentManager;
    }
    
    /// @notice Update timelock address
    /// @param _timelock New timelock address
    function updateTimelock(address _timelock) external onlyTimelock {
        if (_timelock == address(0)) revert Errors.ZeroAddress();
        address oldTimelock = timelock;
        timelock = _timelock;
        emit TimelockUpdated(oldTimelock, _timelock);
    }
    
    /// @notice Remove cohort from active list (internal helper)
    /// @param communityId Community identifier
    /// @param cohortId Cohort identifier to remove
    function _removeFromActiveCohorts(uint256 communityId, uint256 cohortId) internal {
        uint256[] storage activeCohorts = activeCohortsByCommunity[communityId];
        
        for (uint256 i = 0; i < activeCohorts.length; i++) {
            if (activeCohorts[i] == cohortId) {
                // Move last element to position i and pop
                activeCohorts[i] = activeCohorts[activeCohorts.length - 1];
                activeCohorts.pop();
                break;
            }
        }
    }
}