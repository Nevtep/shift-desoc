// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Errors} from "../libs/Errors.sol";
import {CohortRegistry} from "./CohortRegistry.sol";
import {ValuableActionRegistry} from "./ValuableActionRegistry.sol";
import {ValuableActionSBT} from "./ValuableActionSBT.sol";

/// @title InvestmentCohortManager
/// @notice Coordinates cohort lifecycle and investment issuance scoped to cohorts
contract InvestmentCohortManager {
    /*//////////////////////////////////////////////////////////////
                                    EVENTS
    //////////////////////////////////////////////////////////////*/
    event CohortCreated(uint256 indexed cohortId, uint256 indexed communityId, bool active);
    event CohortActivationUpdated(uint256 indexed cohortId, bool active);
    event InvestmentIssued(
        address indexed investor,
        uint256 indexed tokenId,
        uint256 indexed cohortId,
        uint256 communityId,
        uint32 weight
    );

    /*//////////////////////////////////////////////////////////////
                                   STORAGE
    //////////////////////////////////////////////////////////////*/
    address public governance;
    mapping(address => bool) public isModerator;

    CohortRegistry public immutable cohortRegistry;
    ValuableActionRegistry public immutable valuableActionRegistry;
    ValuableActionSBT public immutable sbt;

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
    constructor(address _governance, address _cohortRegistry, address _valuableActionRegistry, address _sbt) {
        if (_governance == address(0)) revert Errors.ZeroAddress();
        if (_cohortRegistry == address(0)) revert Errors.ZeroAddress();
        if (_valuableActionRegistry == address(0)) revert Errors.ZeroAddress();
        if (_sbt == address(0)) revert Errors.ZeroAddress();

        governance = _governance;
        cohortRegistry = CohortRegistry(_cohortRegistry);
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
                               COHORT LIFECYCLE
    //////////////////////////////////////////////////////////////*/
    function createCohort(
        uint256 communityId,
        uint16 targetRoiBps,
        uint32 priorityWeight,
        bytes32 termsHash,
        uint64 startAt,
        uint64 endAt,
        bool active
    ) external onlyGovOrModerator returns (uint256 cohortId) {
        cohortId = cohortRegistry.createCohort(communityId, targetRoiBps, priorityWeight, termsHash, startAt, endAt, active);
        emit CohortCreated(cohortId, communityId, active);
    }

    function setCohortActive(uint256 cohortId, bool active) external onlyGovOrModerator {
        cohortRegistry.setCohortActive(cohortId, active);
        emit CohortActivationUpdated(cohortId, active);
    }

    /*//////////////////////////////////////////////////////////////
                               INVESTMENT ISSUANCE
    //////////////////////////////////////////////////////////////*/
    function issueInvestment(
        address to,
        uint256 cohortId,
        uint32 weight,
        bytes calldata metadata
    ) external onlyGovOrModerator returns (uint256 tokenId) {
        CohortRegistry.Cohort memory cohort = cohortRegistry.getCohort(cohortId);
        if (!cohort.active) revert Errors.InvalidInput("Cohort inactive");
        if (cohort.endAt != 0 && block.timestamp > cohort.endAt) {
            revert Errors.InvalidInput("Cohort expired");
        }

        tokenId = valuableActionRegistry.issueInvestment(cohort.communityId, to, cohortId, weight, metadata);

        // Record investment amount/weight in registry for downstream eligibility
        cohortRegistry.addInvestment(cohortId, to, weight, tokenId);

        emit InvestmentIssued(to, tokenId, cohortId, cohort.communityId, weight);
    }

    /*//////////////////////////////////////////////////////////////
                                  VIEWS
    //////////////////////////////////////////////////////////////*/
    function isCohortActive(uint256 cohortId) external view returns (bool) {
        return cohortRegistry.isCohortActive(cohortId);
    }

    function getCohortCommunity(uint256 cohortId) external view returns (uint256) {
        return cohortRegistry.getCohortCommunity(cohortId);
    }

    function getInvestmentWeightByToken(uint256 tokenId) external view returns (uint256) {
        return cohortRegistry.getInvestmentAmountByToken(tokenId);
    }

    function getInvestmentWeight(uint256 cohortId, address investor) external view returns (uint256) {
        return cohortRegistry.getInvestmentAmount(cohortId, investor);
    }
}
