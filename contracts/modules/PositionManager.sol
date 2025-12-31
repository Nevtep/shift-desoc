// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {Errors} from "../libs/Errors.sol";
import {ValuableActionRegistry} from "./ValuableActionRegistry.sol";
import {IValuableActionSBT} from "../core/interfaces/IValuableActionSBT.sol";

/// @title PositionManager
/// @notice Manages position definitions, applications, assignments, and closures with ROLE minting on SUCCESS
contract PositionManager {
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

    address public governance;
    mapping(address => bool) public isModerator;

    ValuableActionRegistry public immutable valuableActionRegistry;
    IValuableActionSBT public immutable valuableActionSBT;

    mapping(bytes32 => PositionType) public positionTypes;
    mapping(uint256 => PositionApplication) public applications;
    uint256 public nextAppId = 1;

    /*//////////////////////////////////////////////////////////////
                                  MODIFIERS
    //////////////////////////////////////////////////////////////*/
    modifier onlyGovernance() {
        if (msg.sender != governance) revert Errors.NotAuthorized(msg.sender);
        _;
    }

    modifier onlyGovOrModerator() {
        if (msg.sender != governance && !isModerator[msg.sender]) revert Errors.NotAuthorized(msg.sender);
        _;
    }

    /*//////////////////////////////////////////////////////////////
                                 CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    constructor(address _governance, address _valuableActionRegistry, address _valuableActionSBT) {
        if (_governance == address(0)) revert Errors.ZeroAddress();
        if (_valuableActionRegistry == address(0)) revert Errors.ZeroAddress();
        if (_valuableActionSBT == address(0)) revert Errors.ZeroAddress();

        governance = _governance;
        valuableActionRegistry = ValuableActionRegistry(_valuableActionRegistry);
        valuableActionSBT = IValuableActionSBT(_valuableActionSBT);

        // Governance starts as moderator for convenience
        isModerator[_governance] = true;
    }

    /*//////////////////////////////////////////////////////////////
                                GOVERNANCE
    //////////////////////////////////////////////////////////////*/
    function setModerator(address account, bool status) external onlyGovernance {
        if (account == address(0)) revert Errors.ZeroAddress();
        isModerator[account] = status;
    }

    function updateGovernance(address newGovernance) external onlyGovernance {
        if (newGovernance == address(0)) revert Errors.ZeroAddress();
        governance = newGovernance;
        isModerator[newGovernance] = true;
    }

    /*//////////////////////////////////////////////////////////////
                            POSITION TYPE MGMT
    //////////////////////////////////////////////////////////////*/
    function definePositionType(bytes32 roleTypeId, uint256 communityId, uint32 points, bool active)
        external
        onlyGovOrModerator
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
        onlyGovOrModerator
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

        application.status = STATUS_APPROVED;
        application.positionTokenId = positionTokenId;

        emit PositionAssigned(appId, application.applicant, positionTokenId);
    }

    /*//////////////////////////////////////////////////////////////
                                POSITION CLOSE
    //////////////////////////////////////////////////////////////*/
    function closePosition(uint256 positionTokenId, CloseOutcome outcome, bytes calldata evidenceOrMetadata)
        external
        onlyGovOrModerator
        returns (uint256 roleTokenId)
    {
        IValuableActionSBT.TokenData memory data = valuableActionSBT.getTokenData(positionTokenId);
        if (data.kind != IValuableActionSBT.TokenKind.POSITION) revert Errors.InvalidInput("Not a position token");
        if (data.endedAt != 0) revert Errors.InvalidInput("Position already closed");

        address holder = IERC721(address(valuableActionSBT)).ownerOf(positionTokenId);
        uint64 endedAt = uint64(block.timestamp);

        valuableActionRegistry.closePositionToken(data.communityId, positionTokenId, uint8(outcome));

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
