// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {Errors} from "../libs/Errors.sol";
import {ValuableActionRegistry} from "./ValuableActionRegistry.sol";
import {IValuableActionSBT} from "../core/interfaces/IValuableActionSBT.sol";
interface IRevenueRouter {
    function registerPosition(uint256 tokenId) external;
    function unregisterPosition(uint256 tokenId) external;
}

/// @title PositionManager
/// @notice Manages position definitions, applications, assignments, and closures with ROLE minting on SUCCESS
contract PositionManager is AccessManaged {
    /*//////////////////////////////////////////////////////////////
                                    EVENTS
    //////////////////////////////////////////////////////////////*/
    event PositionTypeDefined(bytes32 indexed roleTypeId, uint256 indexed communityId, uint32 points, bool active);
    event PositionApplied(uint256 indexed appId, address indexed applicant, bytes32 indexed roleTypeId, uint256 communityId);
    event PositionAssigned(uint256 indexed appId, address indexed applicant, uint256 indexed positionTokenId);
    event PositionClosed(
        uint256 indexed positionTokenId,
        address indexed holder,
        CloseOutcome outcome,
        uint64 endedAt,
        uint256 roleTokenId
    );
    event RevenueRouterUpdated(address indexed router);

    /*//////////////////////////////////////////////////////////////
                                   STRUCTS
    //////////////////////////////////////////////////////////////*/
    struct PositionType {
        bytes32 roleTypeId;
        uint256 communityId;
        uint32 points;
        bool active;
    }

    struct PositionApplication {
        address applicant;
        bytes32 roleTypeId;
        uint256 communityId;
        bytes evidence;
        uint8 status; // 1 = pending, 2 = approved, 3 = rejected (reserved)
        uint256 positionTokenId;
    }

    enum CloseOutcome {
        SUCCESS,
        NEUTRAL,
        NEGATIVE
    }

    /*//////////////////////////////////////////////////////////////
                                   STORAGE
    //////////////////////////////////////////////////////////////*/
    uint8 private constant STATUS_PENDING = 1;
    uint8 private constant STATUS_APPROVED = 2;

    ValuableActionRegistry public immutable valuableActionRegistry;
    IValuableActionSBT public immutable valuableActionSBT;
    IRevenueRouter public revenueRouter;

    mapping(bytes32 => PositionType) public positionTypes;
    mapping(uint256 => PositionApplication) public applications;
    uint256 public nextAppId = 1;

    /*//////////////////////////////////////////////////////////////
                                 CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    constructor(address manager, address _valuableActionRegistry, address _valuableActionSBT) AccessManaged(manager) {
        if (manager == address(0)) revert Errors.ZeroAddress();
        if (_valuableActionRegistry == address(0)) revert Errors.ZeroAddress();
        if (_valuableActionSBT == address(0)) revert Errors.ZeroAddress();

        valuableActionRegistry = ValuableActionRegistry(_valuableActionRegistry);
        valuableActionSBT = IValuableActionSBT(_valuableActionSBT);
    }

    /*//////////////////////////////////////////////////////////////
                            WIRING CONTROLS
    //////////////////////////////////////////////////////////////*/
    function setRevenueRouter(address router) external restricted {
        if (router == address(0)) revert Errors.ZeroAddress();
        revenueRouter = IRevenueRouter(router);
        emit RevenueRouterUpdated(router);
    }

    /*//////////////////////////////////////////////////////////////
                            POSITION TYPE MGMT
    //////////////////////////////////////////////////////////////*/
    function definePositionType(bytes32 roleTypeId, uint256 communityId, uint32 points, bool active)
        external
        restricted
    {
        if (roleTypeId == bytes32(0)) revert Errors.InvalidInput("Missing roleTypeId");
        if (communityId == 0) revert Errors.InvalidInput("Invalid communityId");
        if (points == 0) revert Errors.InvalidInput("Points cannot be zero");

        positionTypes[roleTypeId] = PositionType({
            roleTypeId: roleTypeId,
            communityId: communityId,
            points: points,
            active: active
        });

        emit PositionTypeDefined(roleTypeId, communityId, points, active);
    }

    /*//////////////////////////////////////////////////////////////
                              APPLICATION FLOW
    //////////////////////////////////////////////////////////////*/
    function applyForPosition(bytes32 roleTypeId, bytes calldata evidence) external returns (uint256 appId) {
        PositionType memory positionType = positionTypes[roleTypeId];
        if (positionType.roleTypeId == bytes32(0)) revert Errors.InvalidInput("Unknown roleTypeId");
        if (!positionType.active) revert Errors.InvalidInput("Position type inactive");

        appId = nextAppId++;
        applications[appId] = PositionApplication({
            applicant: msg.sender,
            roleTypeId: roleTypeId,
            communityId: positionType.communityId,
            evidence: evidence,
            status: STATUS_PENDING,
            positionTokenId: 0
        });

        emit PositionApplied(appId, msg.sender, roleTypeId, positionType.communityId);
    }

    function approveApplication(uint256 appId, bytes calldata metadata)
        external
        restricted
        returns (uint256 positionTokenId)
    {
        PositionApplication storage application = applications[appId];
        if (application.status != STATUS_PENDING) revert Errors.InvalidInput("Application not pending");
        if (application.applicant == address(0)) revert Errors.InvalidInput("Application not found");

        PositionType memory positionType = positionTypes[application.roleTypeId];
        if (positionType.roleTypeId == bytes32(0)) revert Errors.InvalidInput("Unknown roleTypeId");
        if (!positionType.active) revert Errors.InvalidInput("Position type inactive");

        positionTokenId = valuableActionRegistry.issuePosition(
            positionType.communityId,
            application.applicant,
            application.roleTypeId,
            positionType.points,
            metadata
        );

        if (address(revenueRouter) == address(0)) revert Errors.InvalidInput("RevenueRouter not set");
        revenueRouter.registerPosition(positionTokenId);

        application.status = STATUS_APPROVED;
        application.positionTokenId = positionTokenId;

        emit PositionAssigned(appId, application.applicant, positionTokenId);
    }

    /*//////////////////////////////////////////////////////////////
                                POSITION CLOSE
    //////////////////////////////////////////////////////////////*/
    function closePosition(uint256 positionTokenId, CloseOutcome outcome, bytes calldata evidenceOrMetadata)
        external
        restricted
        returns (uint256 roleTokenId)
    {
        IValuableActionSBT.TokenData memory data = valuableActionSBT.getTokenData(positionTokenId);
        if (data.kind != IValuableActionSBT.TokenKind.POSITION) revert Errors.InvalidInput("Not a position token");
        if (data.endedAt != 0) revert Errors.InvalidInput("Position already closed");

        address holder = IERC721(address(valuableActionSBT)).ownerOf(positionTokenId);
        uint64 endedAt = uint64(block.timestamp);

        valuableActionRegistry.closePositionToken(data.communityId, positionTokenId, uint8(outcome));

        if (address(revenueRouter) == address(0)) revert Errors.InvalidInput("RevenueRouter not set");
        revenueRouter.unregisterPosition(positionTokenId);

        if (outcome == CloseOutcome.SUCCESS) {
            roleTokenId = valuableActionRegistry.issueRoleFromPosition(
                data.communityId,
                holder,
                data.roleTypeId,
                data.points,
                data.issuedAt,
                endedAt,
                uint8(outcome),
                evidenceOrMetadata
            );
        }

        emit PositionClosed(positionTokenId, holder, outcome, endedAt, roleTokenId);
    }
}
