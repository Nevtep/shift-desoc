// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Errors} from "../libs/Errors.sol";
import {Roles} from "../libs/Roles.sol";
import {IValuableActionSBT} from "../core/interfaces/IValuableActionSBT.sol";
import {IParamController} from "./interfaces/IParamController.sol";
import {ICohortRegistry} from "./interfaces/ICohortRegistry.sol";

/// @title RevenueRouter
/// @notice Deterministic revenue splitter with minimum guarantees and spillover, using pull-based indices
/// @dev No minting or lifecycle management; relies on external managers to register active positions
contract RevenueRouter is AccessManaged, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_BPS = 10_000;
    uint256 private constant INDEX_SCALE = 1e18;


    IParamController public paramController;
    ICohortRegistry public cohortRegistry;
    IValuableActionSBT public valuableActionSBT;

    mapping(uint256 => address) public communityTreasuries;
    mapping(uint256 => mapping(address => bool)) public supportedTokens;
    mapping(uint256 => mapping(address => uint256)) public treasuryAccrual; // community => token => amount

    // Position accounting
    mapping(uint256 => bool) public positionRegistered; // tokenId => registered
    mapping(uint256 => uint256) public positionCommunity; // tokenId => communityId
    mapping(uint256 => uint32) public positionPoints; // tokenId => points
    mapping(uint256 => uint256) public activePositionPoints; // communityId => total points
    mapping(uint256 => mapping(address => uint256)) public positionsIndex; // communityId => token => index
    mapping(uint256 => mapping(address => uint256)) public positionIndexPaid; // tokenId => token => index snapshot

    // Cohort (investment) accounting
    mapping(uint256 => mapping(address => uint256)) public cohortIndex; // cohortId => token => index
    mapping(uint256 => mapping(address => uint256)) public cohortIndexPaid; // tokenId => token => index snapshot

    event RevenueDistributed(uint256 indexed communityId, address indexed token, uint256 amount);
    event TreasuryAllocated(uint256 indexed communityId, address indexed token, uint256 amount);
    event PositionsAllocated(uint256 indexed communityId, address indexed token, uint256 amount, uint256 indexAfter);
    event CohortsAllocated(uint256 indexed communityId, address indexed token, uint256 amount);
    event SpilloverAllocated(uint256 indexed communityId, address indexed token, uint256 amount, uint8 target);

    event CommunityTreasuryUpdated(uint256 indexed communityId, address oldTreasury, address newTreasury);
    event TokenSupportUpdated(uint256 indexed communityId, address indexed token, bool supported);
    event ParamControllerUpdated(address oldController, address newController);
    event CohortRegistryUpdated(address oldRegistry, address newRegistry);
    event PositionRegistered(uint256 indexed tokenId, uint256 indexed communityId, uint32 points);
    event PositionUnregistered(uint256 indexed tokenId, uint256 indexed communityId, uint32 points);

    constructor(address manager, address _paramController, address _cohortRegistry, address _sbt) AccessManaged(manager) {
        if (_paramController == address(0) || _cohortRegistry == address(0) || _sbt == address(0) || manager == address(0)) {
            revert Errors.ZeroAddress();
        }
        paramController = IParamController(_paramController);
        cohortRegistry = ICohortRegistry(_cohortRegistry);
        valuableActionSBT = IValuableActionSBT(_sbt);
    }

    /*//////////////////////////////////////////////////////////////
                                    ADMIN ACTIONS
    //////////////////////////////////////////////////////////////*/
    function setCommunityTreasury(uint256 communityId, address treasury) external restricted {
        if (treasury == address(0)) revert Errors.ZeroAddress();
        address old = communityTreasuries[communityId];
        communityTreasuries[communityId] = treasury;
        emit CommunityTreasuryUpdated(communityId, old, treasury);
    }

    function setSupportedToken(uint256 communityId, address token, bool supported) external restricted {
        if (token == address(0)) revert Errors.ZeroAddress();
        supportedTokens[communityId][token] = supported;
        emit TokenSupportUpdated(communityId, token, supported);
    }

    function setParamController(address newController) external restricted {
        if (newController == address(0)) revert Errors.ZeroAddress();
        address old = address(paramController);
        paramController = IParamController(newController);
        emit ParamControllerUpdated(old, newController);
    }

    function setCohortRegistry(address newRegistry) external restricted {
        if (newRegistry == address(0)) revert Errors.ZeroAddress();
        address old = address(cohortRegistry);
        cohortRegistry = ICohortRegistry(newRegistry);
        emit CohortRegistryUpdated(old, newRegistry);
    }

    /*//////////////////////////////////////////////////////////////
                                POSITION REGISTRATION
    //////////////////////////////////////////////////////////////*/
    function registerPosition(uint256 tokenId) external restricted {
        if (positionRegistered[tokenId]) revert Errors.InvalidInput("Already registered");
        IValuableActionSBT.TokenData memory data = valuableActionSBT.getTokenData(tokenId);
        if (data.kind != IValuableActionSBT.TokenKind.POSITION) revert Errors.InvalidInput("Not position token");
        if (data.endedAt != 0) revert Errors.InvalidInput("Position ended");
        if (data.points == 0) revert Errors.InvalidInput("Zero points");
        if (data.communityId == 0) revert Errors.InvalidInput("Invalid community");

        positionRegistered[tokenId] = true;
        positionCommunity[tokenId] = data.communityId;
        positionPoints[tokenId] = data.points;
        activePositionPoints[data.communityId] += data.points;

        emit PositionRegistered(tokenId, data.communityId, data.points);
    }

    function unregisterPosition(uint256 tokenId) external restricted {
        if (!positionRegistered[tokenId]) revert Errors.InvalidInput("Not registered");
        uint256 communityId = positionCommunity[tokenId];
        uint32 points = positionPoints[tokenId];

        positionRegistered[tokenId] = false;
        positionCommunity[tokenId] = 0;
        positionPoints[tokenId] = 0;
        if (points > 0 && activePositionPoints[communityId] >= points) {
            activePositionPoints[communityId] -= points;
        }

        emit PositionUnregistered(tokenId, communityId, points);
    }

    /*//////////////////////////////////////////////////////////////
                                  REVENUE ROUTING
    //////////////////////////////////////////////////////////////*/
    function routeRevenue(uint256 communityId, address token, uint256 amount)
        external
        restricted
        nonReentrant
    {
        if (amount == 0) revert Errors.InvalidInput("Zero amount");
        if (!supportedTokens[communityId][token]) revert Errors.InvalidInput("Unsupported token");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        (uint16 minTreasuryBps, uint16 minPositionsBps, uint8 spilloverTarget, uint16 splitBps) =
            paramController.getRevenuePolicy(communityId);
        if (spilloverTarget == 2 && splitBps == 0) {
            splitBps = 5000; // default 50/50 if split target not configured
        }

        uint256 treasuryShare = (amount * minTreasuryBps) / MAX_BPS;
        uint256 positionsPool = (amount * minPositionsBps) / MAX_BPS;
        uint256 remaining = amount - treasuryShare - positionsPool;

        (uint256 positionsUsed, uint256 positionsUnallocated) = _accruePositions(communityId, token, positionsPool);

        uint256 cohortDistributed = _distributeToCohorts(communityId, token, remaining);

        uint256 spilloverPool = remaining - cohortDistributed + positionsUnallocated;
        (uint256 spillToTreasury, uint256 spillToPositionsUsed, uint256 spillPositionsUnallocated) =
            _handleSpillover(communityId, token, spilloverTarget, splitBps, spilloverPool);

        uint256 treasuryAllocated = treasuryShare + spillToTreasury;
        uint256 positionsAllocated = positionsUsed + spillToPositionsUsed;

        if (spillPositionsUnallocated > 0) {
            treasuryAllocated += spillPositionsUnallocated;
            emit SpilloverAllocated(communityId, token, spillPositionsUnallocated, 1);
        }

        uint256 sumAllocated = treasuryAllocated + positionsAllocated + cohortDistributed;
        uint256 remainder = amount > sumAllocated ? amount - sumAllocated : 0;
        treasuryAccrual[communityId][token] += treasuryAllocated + remainder;

        emit TreasuryAllocated(communityId, token, treasuryAllocated + remainder);
        emit PositionsAllocated(communityId, token, positionsAllocated, positionsIndex[communityId][token]);
        emit CohortsAllocated(communityId, token, cohortDistributed);
        emit RevenueDistributed(communityId, token, amount);
    }

    function _accruePositions(uint256 communityId, address token, uint256 amount)
        internal
        returns (uint256 used, uint256 unused)
    {
        uint256 totalPoints = activePositionPoints[communityId];
        if (amount == 0) return (0, 0);
        if (totalPoints == 0) return (0, amount);

        uint256 deltaIndex = (amount * INDEX_SCALE) / totalPoints;
        positionsIndex[communityId][token] += deltaIndex;
        return (amount, 0);
    }

    function _distributeToCohorts(uint256 communityId, address token, uint256 pool)
        internal
        returns (uint256 distributed)
    {
        if (pool == 0) return 0;
        uint256[] memory active = cohortRegistry.getActiveCohorts(communityId);
        if (active.length == 0) return 0;

        uint256 totalWeight = 0;
        uint256[] memory weights = new uint256[](active.length);

        for (uint256 i = 0; i < active.length; i++) {
            ICohortRegistry.Cohort memory cohort = cohortRegistry.getCohort(active[i]);
            if (!cohort.active || cohort.communityId != communityId) continue;
            weights[i] = cohort.investedTotal;
            totalWeight += weights[i];
        }

        if (totalWeight == 0) return 0;

        for (uint256 i = 0; i < active.length; i++) {
            uint256 weight = weights[i];
            if (weight == 0) continue;
            uint256 cohortId = active[i];
            uint256 cohortPayment = (pool * weight) / totalWeight;
            if (cohortPayment == 0) continue;

            uint256 deltaIndex = (cohortPayment * INDEX_SCALE) / weight;
            cohortIndex[cohortId][token] += deltaIndex;
            distributed += cohortPayment;
        }
    }

    function _handleSpillover(
        uint256 communityId,
        address token,
        uint8 spilloverTarget,
        uint16 splitBps,
        uint256 amount
    ) internal returns (uint256 toTreasury, uint256 toPositionsUsed, uint256 positionsUnallocated) {
        if (amount == 0) return (0, 0, 0);

        if (spilloverTarget == 0) {
            (uint256 usedPositions, uint256 unusedPositions) = _accruePositions(communityId, token, amount);
            emit SpilloverAllocated(communityId, token, amount - unusedPositions, 0);
            return (0, usedPositions, unusedPositions);
        }
        if (spilloverTarget == 1) {
            emit SpilloverAllocated(communityId, token, amount, 1);
            return (amount, 0, 0);
        }

        // Split
        uint256 toTreasurySplit = (amount * splitBps) / MAX_BPS;
        uint256 toPositionsSplit = amount - toTreasurySplit;

        (uint256 splitUsed, uint256 splitUnused) = _accruePositions(communityId, token, toPositionsSplit);
        emit SpilloverAllocated(communityId, token, toTreasurySplit + splitUsed, 2);
        return (toTreasurySplit, splitUsed, splitUnused);
    }

    /*//////////////////////////////////////////////////////////////
                                  CLAIMS
    //////////////////////////////////////////////////////////////*/
    function claimPosition(uint256 tokenId, address token, address to) external nonReentrant {
        if (to == address(0)) revert Errors.ZeroAddress();
        IValuableActionSBT.TokenData memory data = valuableActionSBT.getTokenData(tokenId);
        if (data.kind != IValuableActionSBT.TokenKind.POSITION) revert Errors.InvalidInput("Not position token");
        address tokenOwner = _ownerOf(tokenId);
        if (msg.sender != tokenOwner) revert Errors.NotAuthorized(msg.sender);

        uint256 communityId = data.communityId;
        uint32 points = data.points;
        uint256 accruedIndex = positionsIndex[communityId][token];
        uint256 paidIndex = positionIndexPaid[tokenId][token];
        uint256 deltaIndex = accruedIndex - paidIndex;
        uint256 claimable = (uint256(points) * deltaIndex) / INDEX_SCALE;

        positionIndexPaid[tokenId][token] = accruedIndex;
        if (claimable == 0) return;

        IERC20(token).safeTransfer(to, claimable);
    }

    function claimInvestment(uint256 tokenId, address token, address to) external nonReentrant {
        if (to == address(0)) revert Errors.ZeroAddress();
        IValuableActionSBT.TokenData memory data = valuableActionSBT.getTokenData(tokenId);
        if (data.kind != IValuableActionSBT.TokenKind.INVESTMENT) revert Errors.InvalidInput("Not investment token");
        uint256 cohortId = data.cohortId;
        if (cohortId == 0) revert Errors.InvalidInput("Missing cohort");

        address tokenOwner = _ownerOf(tokenId);
        if (msg.sender != tokenOwner) revert Errors.NotAuthorized(msg.sender);

        uint256 weight = cohortRegistry.getInvestmentAmountByToken(tokenId);
        if (weight == 0) revert Errors.InvalidInput("No investment weight");

        uint256 accruedIndex = cohortIndex[cohortId][token];
        uint256 paidIndex = cohortIndexPaid[tokenId][token];
        uint256 deltaIndex = accruedIndex - paidIndex;
        uint256 claimable = (weight * deltaIndex) / INDEX_SCALE;

        cohortIndexPaid[tokenId][token] = accruedIndex;
        if (claimable == 0) return;

        IERC20(token).safeTransfer(to, claimable);
    }

    function withdrawTreasury(uint256 communityId, address token, uint256 amount, address to) external nonReentrant {
        if (to == address(0)) revert Errors.ZeroAddress();
        address treasury = communityTreasuries[communityId];
        if (treasury == address(0)) revert Errors.ZeroAddress();
        if (msg.sender != treasury) revert Errors.NotAuthorized(msg.sender);
        if (amount == 0) revert Errors.InvalidInput("Zero amount");
        if (treasuryAccrual[communityId][token] < amount) {
            revert Errors.InsufficientBalance(address(this), amount, treasuryAccrual[communityId][token]);
        }

        treasuryAccrual[communityId][token] -= amount;
        IERC20(token).safeTransfer(to, amount);
        emit TreasuryAllocated(communityId, token, amount);
    }

    /*//////////////////////////////////////////////////////////////
                                    VIEWS
    //////////////////////////////////////////////////////////////*/
    function getClaimablePosition(uint256 tokenId, address token) external view returns (uint256) {
        IValuableActionSBT.TokenData memory data = valuableActionSBT.getTokenData(tokenId);
        if (data.kind != IValuableActionSBT.TokenKind.POSITION) return 0;
        uint256 communityId = data.communityId;
        uint32 points = data.points;
        uint256 deltaIndex = positionsIndex[communityId][token] - positionIndexPaid[tokenId][token];
        return (uint256(points) * deltaIndex) / INDEX_SCALE;
    }

    function getClaimableInvestment(uint256 tokenId, address token) external view returns (uint256) {
        IValuableActionSBT.TokenData memory data = valuableActionSBT.getTokenData(tokenId);
        if (data.kind != IValuableActionSBT.TokenKind.INVESTMENT) return 0;
        uint256 cohortId = data.cohortId;
        uint256 weight = cohortRegistry.getInvestmentAmountByToken(tokenId);
        if (weight == 0) return 0;
        uint256 deltaIndex = cohortIndex[cohortId][token] - cohortIndexPaid[tokenId][token];
        return (weight * deltaIndex) / INDEX_SCALE;
    }

    /*//////////////////////////////////////////////////////////////
                                 INTERNALS
    //////////////////////////////////////////////////////////////*/
    function _ownerOf(uint256 tokenId) internal view returns (address owner) {
        (bool ok, bytes memory res) = address(valuableActionSBT).staticcall(abi.encodeWithSignature("ownerOf(uint256)", tokenId));
        if (!ok || res.length == 0) revert Errors.InvalidInput("ownerOf failed");
        owner = abi.decode(res, (address));
    }
}