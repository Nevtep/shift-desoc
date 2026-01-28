// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {Errors} from "../libs/Errors.sol";
import {CohortRegistry} from "./CohortRegistry.sol";
import {ValuableActionRegistry} from "./ValuableActionRegistry.sol";
import {ValuableActionSBT} from "./ValuableActionSBT.sol";

/// @title InvestmentCohortManager
/// @notice Coordinates cohort lifecycle and investment issuance scoped to cohorts
contract InvestmentCohortManager is AccessManaged {
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
    CohortRegistry public immutable cohortRegistry;
    ValuableActionRegistry public immutable valuableActionRegistry;
    ValuableActionSBT public immutable sbt;

    /*//////////////////////////////////////////////////////////////
                                 CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    constructor(address manager, address _cohortRegistry, address _valuableActionRegistry, address _sbt)
        AccessManaged(manager)
    {
        if (manager == address(0)) revert Errors.ZeroAddress();
        if (_cohortRegistry == address(0)) revert Errors.ZeroAddress();
        if (_valuableActionRegistry == address(0)) revert Errors.ZeroAddress();
        if (_sbt == address(0)) revert Errors.ZeroAddress();

        cohortRegistry = CohortRegistry(_cohortRegistry);
        valuableActionRegistry = ValuableActionRegistry(_valuableActionRegistry);
        sbt = ValuableActionSBT(_sbt);
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
    ) external restricted returns (uint256 cohortId) {
        cohortId = cohortRegistry.createCohort(communityId, targetRoiBps, priorityWeight, termsHash, startAt, endAt, active);
        emit CohortCreated(cohortId, communityId, active);
    }

    function setCohortActive(uint256 cohortId, bool active) external restricted {
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
    ) external restricted returns (uint256 tokenId) {
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
