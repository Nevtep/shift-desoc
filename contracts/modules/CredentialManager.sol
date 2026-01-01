// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Errors} from "../libs/Errors.sol";
import {Types} from "../libs/Types.sol";
import {ValuableActionRegistry} from "./ValuableActionRegistry.sol";
import {ValuableActionSBT} from "./ValuableActionSBT.sol";

/// @title CredentialManager
/// @notice Manages course-scoped credential applications with verifier approval and governance-only revocation
contract CredentialManager {
    /*//////////////////////////////////////////////////////////////
                                    EVENTS
    //////////////////////////////////////////////////////////////*/
    event CourseDefined(bytes32 indexed courseId, uint256 indexed communityId, address indexed verifier, bool active);
    event CourseActivationUpdated(bytes32 indexed courseId, bool active);
    event CredentialApplied(uint256 indexed appId, address indexed applicant, bytes32 indexed courseId, uint256 communityId);
    event CredentialIssued(
        uint256 indexed appId,
        uint256 indexed tokenId,
        address indexed applicant,
        bytes32 courseId,
        uint256 communityId
    );
    event CredentialRevoked(uint256 indexed tokenId, bytes32 indexed courseId, address indexed applicant, bytes metadata);

    /*//////////////////////////////////////////////////////////////
                                   STRUCTS
    //////////////////////////////////////////////////////////////*/
    struct Course {
        uint256 communityId;
        address verifier;
        bool active;
        bool exists;
    }

    struct CredentialApplication {
        address applicant;
        bytes32 courseId;
        uint256 communityId;
        uint8 status; // 1 = pending, 2 = approved, 3 = revoked
        uint256 tokenId;
    }

    /*//////////////////////////////////////////////////////////////
                                   STORAGE
    //////////////////////////////////////////////////////////////*/
    uint8 private constant STATUS_PENDING = 1;
    uint8 private constant STATUS_APPROVED = 2;
    uint8 private constant STATUS_REVOKED = 3;

    address public governance;
    mapping(address => bool) public isModerator;

    ValuableActionRegistry public immutable valuableActionRegistry;
    ValuableActionSBT public immutable sbt;

    mapping(bytes32 => Course) public courses;
    mapping(uint256 => CredentialApplication) public applications;
    mapping(bytes32 => mapping(address => uint256)) public pendingApplicationId;
    mapping(bytes32 => mapping(address => bool)) public hasCredential;
    mapping(uint256 => uint256) public applicationIdByToken;
    mapping(uint256 => bytes) public issuanceMetadata;
    mapping(uint256 => bytes) public revocationMetadata;

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
    constructor(address _governance, address _valuableActionRegistry, address _sbt) {
        if (_governance == address(0)) revert Errors.ZeroAddress();
        if (_valuableActionRegistry == address(0)) revert Errors.ZeroAddress();
        if (_sbt == address(0)) revert Errors.ZeroAddress();

        governance = _governance;
        valuableActionRegistry = ValuableActionRegistry(_valuableActionRegistry);
        sbt = ValuableActionSBT(_sbt);

        isModerator[_governance] = true;
    }

    /*//////////////////////////////////////////////////////////////
                                ADMIN CONTROLS
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
                               COURSE MANAGEMENT
    //////////////////////////////////////////////////////////////*/
    function defineCourse(bytes32 courseId, uint256 communityId, address verifier, bool active)
        external
        onlyGovOrModerator
    {
        if (courseId == bytes32(0)) revert Errors.InvalidInput("Missing courseId");
        if (communityId == 0) revert Errors.InvalidInput("Invalid communityId");
        if (verifier == address(0)) revert Errors.ZeroAddress();
        if (courses[courseId].exists) revert Errors.InvalidInput("Course already exists");

        courses[courseId] = Course({communityId: communityId, verifier: verifier, active: active, exists: true});

        emit CourseDefined(courseId, communityId, verifier, active);
    }

    function setCourseActive(bytes32 courseId, bool active) external onlyGovOrModerator {
        Course storage course = courses[courseId];
        if (!course.exists) revert Errors.InvalidInput("Unknown courseId");
        course.active = active;
        emit CourseActivationUpdated(courseId, active);
    }

    /*//////////////////////////////////////////////////////////////
                              APPLICATION FLOW
    //////////////////////////////////////////////////////////////*/
    function applyForCredential(bytes32 courseId, bytes calldata evidence) external returns (uint256 appId) {
        Course memory course = courses[courseId];
        if (!course.exists) revert Errors.InvalidInput("Unknown courseId");
        if (!course.active) revert Errors.InvalidInput("Course inactive");
        if (hasCredential[courseId][msg.sender]) revert Errors.InvalidInput("Credential already issued");
        if (pendingApplicationId[courseId][msg.sender] != 0) revert Errors.InvalidInput("Application already pending");

        appId = nextAppId++;
        applications[appId] = CredentialApplication({
            applicant: msg.sender,
            courseId: courseId,
            communityId: course.communityId,
            status: STATUS_PENDING,
            tokenId: 0
        });

        pendingApplicationId[courseId][msg.sender] = appId;
        emit CredentialApplied(appId, msg.sender, courseId, course.communityId);
        if (evidence.length == 0) {
            // Evidence is verified off-chain; empty payload is permitted for now
        }
    }

    function approveApplication(uint256 appId) external returns (uint256 tokenId) {
        CredentialApplication storage application = applications[appId];
        if (application.status != STATUS_PENDING) revert Errors.InvalidInput("Application not pending");
        if (application.applicant == address(0)) revert Errors.InvalidInput("Application not found");

        Course memory course = courses[application.courseId];
        if (msg.sender != course.verifier && msg.sender != governance) {
            revert Errors.NotAuthorized(msg.sender);
        }
        if (!course.active) revert Errors.InvalidInput("Course inactive");
        if (hasCredential[application.courseId][application.applicant]) {
            revert Errors.InvalidInput("Credential already issued");
        }

        bytes memory metadata = abi.encode(application.courseId, appId);
        tokenId = valuableActionRegistry.issueEngagement(
            course.communityId,
            application.applicant,
            Types.EngagementSubtype.CREDENTIAL,
            application.courseId,
            metadata
        );

        application.status = STATUS_APPROVED;
        application.tokenId = tokenId;
        hasCredential[application.courseId][application.applicant] = true;
        pendingApplicationId[application.courseId][application.applicant] = 0;
        applicationIdByToken[tokenId] = appId;
        issuanceMetadata[tokenId] = metadata;

        emit CredentialIssued(appId, tokenId, application.applicant, application.courseId, course.communityId);
    }

    /*//////////////////////////////////////////////////////////////
                                 REVOCATION
    //////////////////////////////////////////////////////////////*/
    function revokeCredential(uint256 tokenId, bytes32 courseId, bytes calldata reason) external onlyGovernance {
        ValuableActionSBT.TokenData memory data = sbt.getTokenData(tokenId);
        if (data.kind != ValuableActionSBT.TokenKind.CREDENTIAL) revert Errors.InvalidInput("Not a credential token");
        if (data.actionTypeId != courseId) revert Errors.InvalidInput("Course mismatch");
        if (data.endedAt != 0) revert Errors.InvalidInput("Credential already closed");

        bytes memory metadata = abi.encode(courseId, reason);
        sbt.setEndedAt(tokenId, uint64(block.timestamp));

        revocationMetadata[tokenId] = metadata;

        uint256 appId = applicationIdByToken[tokenId];
        if (appId != 0 && applications[appId].status == STATUS_APPROVED) {
            applications[appId].status = STATUS_REVOKED;
        }

        address owner = sbt.ownerOf(tokenId);
        emit CredentialRevoked(tokenId, courseId, owner, metadata);
    }

    /*//////////////////////////////////////////////////////////////
                                   VIEWS
    //////////////////////////////////////////////////////////////*/
    function getCourse(bytes32 courseId) external view returns (Course memory) {
        return courses[courseId];
    }

    function getApplication(uint256 appId) external view returns (CredentialApplication memory) {
        return applications[appId];
    }
}
