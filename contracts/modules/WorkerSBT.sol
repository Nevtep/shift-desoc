// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Errors} from "../libs/Errors.sol";

/// @title WorkerSBT - Soulbound Tokens for Worker Reputation
/// @notice Non-transferable tokens representing worker achievements and reputation
/// @dev Implements ERC721 with transfer restrictions and WorkerPoints tracking
contract WorkerSBT is ERC721URIStorage, AccessControl {
    
    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/
    
    error Soulbound();
    error TokenNotExists(uint256 tokenId);
    error WorkerAlreadyHasToken(address worker);
    error InsufficientWorkerPoints(address worker, uint256 required, uint256 actual);
    error InvalidWorkerPointsAmount(uint256 amount);
    error WorkerPointsDecayTooHigh(uint256 decay, uint256 maxDecay);
    
    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/
    
    event WorkerPointsAwarded(address indexed worker, uint256 amount, uint256 newTotal);
    event WorkerPointsDecayed(address indexed worker, uint256 decayAmount, uint256 newTotal);
    event AchievementUnlocked(address indexed worker, uint256 indexed achievementId, string name);
    event TokenRevoked(address indexed worker, uint256 indexed tokenId, string reason);
    event WorkerPointsDecayUpdated(uint256 oldDecayRate, uint256 newDecayRate);
    
    /*//////////////////////////////////////////////////////////////
                                 CONSTANTS
    //////////////////////////////////////////////////////////////*/
    
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    
    /// @dev EMA decay factor (95% retention per period)
    uint256 public constant DEFAULT_DECAY_RATE = 950; // 95.0% (out of 1000)
    uint256 public constant MAX_DECAY_RATE = 990; // 99.0% max retention
    uint256 public constant MIN_DECAY_RATE = 500; // 50.0% min retention
    
    /// @dev Time period for WorkerPoints decay (1 week)
    uint256 public constant DECAY_PERIOD = 7 days;
    
    /*//////////////////////////////////////////////////////////////
                                 STORAGE
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Next token ID to mint
    uint256 public nextTokenId = 1;
    
    /// @notice Decay rate for WorkerPoints EMA (per 1000)
    uint256 public workerPointsDecayRate = DEFAULT_DECAY_RATE;
    
    /// @notice Mapping from worker address to token ID (each worker can only have one SBT)
    mapping(address => uint256) public workerToTokenId;
    
    /// @notice Mapping from token ID to worker address
    mapping(uint256 => address) public tokenIdToWorker;
    
    /// @notice Current WorkerPoints balance for each worker
    mapping(address => uint256) public workerPoints;
    
    /// @notice Last update timestamp for WorkerPoints (for decay calculation)
    mapping(address => uint256) public lastWorkerPointsUpdate;
    
    /// @notice Total WorkerPoints ever earned by a worker (lifetime)
    mapping(address => uint256) public lifetimeWorkerPoints;
    
    /// @notice Achievement unlock status for each worker
    mapping(address => mapping(uint256 => bool)) public achievements;
    
    /// @notice Total number of achievements unlocked per worker
    mapping(address => uint256) public achievementCount;
    
    /*//////////////////////////////////////////////////////////////
                                 STRUCTS
    //////////////////////////////////////////////////////////////*/
    
    struct Achievement {
        string name;
        string description;
        uint256 workerPointsRequired;
        string metadataURI; // IPFS URI for badge image/metadata
        bool active;
    }
    
    /// @notice Achievement definitions
    mapping(uint256 => Achievement) public achievementDefinitions;
    uint256 public nextAchievementId = 1;
    
    /*//////////////////////////////////////////////////////////////
                               CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    
    /// @param initialOwner Address that will have DEFAULT_ADMIN_ROLE
    /// @param manager Address of the Claims contract (gets MANAGER_ROLE)
    /// @param governance Address of governance contract (gets GOVERNANCE_ROLE)
    constructor(
        address initialOwner,
        address manager,
        address governance
    ) ERC721("Shift Worker SBT", "SHIFT-SBT") {
        if (initialOwner == address(0)) revert Errors.ZeroAddress();
        if (manager == address(0)) revert Errors.ZeroAddress();
        if (governance == address(0)) revert Errors.ZeroAddress();
        
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(MANAGER_ROLE, manager);
        _grantRole(GOVERNANCE_ROLE, governance);
        
        // Initialize default achievements
        _initializeAchievements();
    }
    
    /*//////////////////////////////////////////////////////////////
                            MAIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Mint SBT and award WorkerPoints to a worker
    /// @param worker Address of the worker
    /// @param points Amount of WorkerPoints to award
    /// @param metadataURI IPFS URI for token metadata
    /// @dev Only callable by manager (Claims contract)
    function mintAndAwardPoints(
        address worker,
        uint256 points,
        string calldata metadataURI
    ) external onlyRole(MANAGER_ROLE) {
        if (worker == address(0)) revert Errors.ZeroAddress();
        if (points == 0) revert InvalidWorkerPointsAmount(points);
        
        uint256 tokenId = workerToTokenId[worker];
        
        // If worker doesn't have a token yet, mint one
        if (tokenId == 0) {
            tokenId = nextTokenId++;
            workerToTokenId[worker] = tokenId;
            tokenIdToWorker[tokenId] = worker;
            
            _safeMint(worker, tokenId);
            _setTokenURI(tokenId, metadataURI);
        }
        
        // Award WorkerPoints
        _awardWorkerPoints(worker, points);
    }
    
    /// @notice Award WorkerPoints to an existing SBT holder
    /// @param worker Address of the worker
    /// @param points Amount of WorkerPoints to award
    function awardWorkerPoints(
        address worker,
        uint256 points
    ) external onlyRole(MANAGER_ROLE) {
        if (worker == address(0)) revert Errors.ZeroAddress();
        if (points == 0) revert InvalidWorkerPointsAmount(points);
        if (workerToTokenId[worker] == 0) revert TokenNotExists(0);
        
        _awardWorkerPoints(worker, points);
    }
    
    /// @notice Revoke a worker's SBT (governance only)
    /// @param worker Address of the worker
    /// @param reason Reason for revocation
    function revokeSBT(
        address worker,
        string calldata reason
    ) external onlyRole(GOVERNANCE_ROLE) {
        uint256 tokenId = workerToTokenId[worker];
        if (tokenId == 0) revert TokenNotExists(tokenId);
        
        // Reset worker data
        delete workerToTokenId[worker];
        delete tokenIdToWorker[tokenId];
        delete workerPoints[worker];
        delete lastWorkerPointsUpdate[worker];
        // Note: Keep lifetimeWorkerPoints for historical reference
        
        // Burn the token
        _burn(tokenId);
        
        emit TokenRevoked(worker, tokenId, reason);
    }
    
    /// @notice Update token metadata URI
    /// @param tokenId Token ID to update
    /// @param newURI New metadata URI
    function updateTokenURI(
        uint256 tokenId,
        string calldata newURI
    ) external onlyRole(MANAGER_ROLE) {
        if (_ownerOf(tokenId) == address(0)) revert TokenNotExists(tokenId);
        _setTokenURI(tokenId, newURI);
    }
    
    /*//////////////////////////////////////////////////////////////
                           WORKERDPOINTS LOGIC
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Get current WorkerPoints for a worker (with decay applied)
    /// @param worker Address of the worker
    /// @return Current WorkerPoints balance
    function getCurrentWorkerPoints(address worker) public view returns (uint256) {
        uint256 lastUpdate = lastWorkerPointsUpdate[worker];
        if (lastUpdate == 0) return 0;
        
        uint256 timePassed = block.timestamp - lastUpdate;
        if (timePassed < DECAY_PERIOD) {
            return workerPoints[worker];
        }
        
        // Calculate decay
        uint256 decayPeriods = timePassed / DECAY_PERIOD;
        uint256 currentPoints = workerPoints[worker];
        
        // Apply exponential decay
        for (uint256 i = 0; i < decayPeriods && currentPoints > 0; i++) {
            currentPoints = (currentPoints * workerPointsDecayRate) / 1000;
        }
        
        return currentPoints;
    }
    
    /// @notice Apply decay to WorkerPoints (can be called by anyone)
    /// @param worker Address of the worker
    function applyDecay(address worker) external {
        _applyDecay(worker);
    }
    
    /// @notice Set WorkerPoints decay rate (governance only)
    /// @param newDecayRate New decay rate (per 1000)
    function setWorkerPointsDecayRate(uint256 newDecayRate) external onlyRole(GOVERNANCE_ROLE) {
        if (newDecayRate > MAX_DECAY_RATE || newDecayRate < MIN_DECAY_RATE) {
            revert WorkerPointsDecayTooHigh(newDecayRate, MAX_DECAY_RATE);
        }
        
        uint256 oldDecayRate = workerPointsDecayRate;
        workerPointsDecayRate = newDecayRate;
        
        emit WorkerPointsDecayUpdated(oldDecayRate, newDecayRate);
    }
    
    /*//////////////////////////////////////////////////////////////
                          ACHIEVEMENT SYSTEM
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Add new achievement definition (governance only)
    /// @param name Achievement name
    /// @param description Achievement description
    /// @param workerPointsRequired WorkerPoints required to unlock
    /// @param metadataURI IPFS URI for achievement badge
    function addAchievement(
        string calldata name,
        string calldata description,
        uint256 workerPointsRequired,
        string calldata metadataURI
    ) external onlyRole(GOVERNANCE_ROLE) {
        uint256 achievementId = nextAchievementId++;
        
        achievementDefinitions[achievementId] = Achievement({
            name: name,
            description: description,
            workerPointsRequired: workerPointsRequired,
            metadataURI: metadataURI,
            active: true
        });
    }
    
    /// @notice Check and unlock achievements for a worker
    /// @param worker Address of the worker
    function checkAchievements(address worker) external {
        uint256 currentPoints = getCurrentWorkerPoints(worker);
        
        for (uint256 i = 1; i < nextAchievementId; i++) {
            Achievement memory achievement = achievementDefinitions[i];
            
            if (achievement.active && 
                !achievements[worker][i] && 
                currentPoints >= achievement.workerPointsRequired) {
                
                achievements[worker][i] = true;
                achievementCount[worker]++;
                
                emit AchievementUnlocked(worker, i, achievement.name);
            }
        }
    }
    
    /// @notice Get achievement status for a worker
    /// @param worker Address of the worker
    /// @param achievementId Achievement ID
    /// @return Whether the worker has unlocked this achievement
    function hasAchievement(address worker, uint256 achievementId) external view returns (bool) {
        return achievements[worker][achievementId];
    }
    
    /*//////////////////////////////////////////////////////////////
                           INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @dev Award WorkerPoints and check for achievements
    function _awardWorkerPoints(address worker, uint256 points) internal {
        // Apply decay first
        _applyDecay(worker);
        
        // Add new points
        workerPoints[worker] += points;
        lifetimeWorkerPoints[worker] += points;
        lastWorkerPointsUpdate[worker] = block.timestamp;
        
        emit WorkerPointsAwarded(worker, points, workerPoints[worker]);
        
        // Check for new achievements
        this.checkAchievements(worker);
    }
    
    /// @dev Apply decay to WorkerPoints based on time passed
    function _applyDecay(address worker) internal {
        uint256 lastUpdate = lastWorkerPointsUpdate[worker];
        if (lastUpdate == 0) return;
        
        uint256 timePassed = block.timestamp - lastUpdate;
        if (timePassed < DECAY_PERIOD) return;
        
        uint256 decayPeriods = timePassed / DECAY_PERIOD;
        uint256 currentPoints = workerPoints[worker];
        uint256 originalPoints = currentPoints;
        
        // Apply exponential decay
        for (uint256 i = 0; i < decayPeriods && currentPoints > 0; i++) {
            currentPoints = (currentPoints * workerPointsDecayRate) / 1000;
        }
        
        if (currentPoints != originalPoints) {
            uint256 decayAmount = originalPoints - currentPoints;
            workerPoints[worker] = currentPoints;
            lastWorkerPointsUpdate[worker] = block.timestamp;
            
            emit WorkerPointsDecayed(worker, decayAmount, currentPoints);
        }
    }
    
    /// @dev Initialize default achievements
    function _initializeAchievements() internal {
        // Starter achievements
        achievementDefinitions[nextAchievementId++] = Achievement({
            name: "First Contribution",
            description: "Made your first verified contribution to the community",
            workerPointsRequired: 1,
            metadataURI: "",
            active: true
        });
        
        achievementDefinitions[nextAchievementId++] = Achievement({
            name: "Active Contributor",
            description: "Earned 100 WorkerPoints through community contributions",
            workerPointsRequired: 100,
            metadataURI: "",
            active: true
        });
        
        achievementDefinitions[nextAchievementId++] = Achievement({
            name: "Community Builder",
            description: "Earned 500 WorkerPoints through community contributions",
            workerPointsRequired: 500,
            metadataURI: "",
            active: true
        });
        
        achievementDefinitions[nextAchievementId++] = Achievement({
            name: "Expert Contributor",
            description: "Earned 1000 WorkerPoints through community contributions",
            workerPointsRequired: 1000,
            metadataURI: "",
            active: true
        });
        
        achievementDefinitions[nextAchievementId++] = Achievement({
            name: "Community Leader",
            description: "Earned 2500 WorkerPoints through community contributions",
            workerPointsRequired: 2500,
            metadataURI: "",
            active: true
        });
    }
    
    /*//////////////////////////////////////////////////////////////
                        SOULBOUND RESTRICTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @dev Override transfer function to make tokens soulbound
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        
        // Allow minting and burning, but not transfers
        if (from != address(0) && to != address(0)) {
            revert Soulbound();
        }
        
        return super._update(to, tokenId, auth);
    }
    
    /// @dev Override approve to prevent approvals (soulbound)
    function approve(address, uint256) public pure override(ERC721, IERC721) {
        revert Soulbound();
    }
    
    /// @dev Override setApprovalForAll to prevent approvals (soulbound)
    function setApprovalForAll(address, bool) public pure override(ERC721, IERC721) {
        revert Soulbound();
    }
    
    /*//////////////////////////////////////////////////////////////
                         VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Check if a worker has an SBT
    /// @param worker Address to check
    /// @return Whether the worker has an SBT
    function hasSBT(address worker) external view returns (bool) {
        return workerToTokenId[worker] != 0;
    }
    
    /// @notice Get token ID for a worker
    /// @param worker Address of the worker
    /// @return Token ID (0 if no token)
    function getTokenId(address worker) external view returns (uint256) {
        return workerToTokenId[worker];
    }
    
    /// @notice Get worker address for a token ID
    /// @param tokenId Token ID
    /// @return Worker address
    function getWorker(uint256 tokenId) external view returns (address) {
        if (_ownerOf(tokenId) == address(0)) revert TokenNotExists(tokenId);
        return tokenIdToWorker[tokenId];
    }
    
    /// @notice Get comprehensive worker stats
    /// @param worker Address of the worker
    /// @return hasToken Whether worker has an SBT
    /// @return tokenId Token ID (0 if no token)
    /// @return currentPoints Current WorkerPoints (with decay applied)
    /// @return lifetimePoints Total WorkerPoints ever earned
    /// @return achievementsUnlocked Number of achievements unlocked
    function getWorkerStats(address worker) external view returns (
        bool hasToken,
        uint256 tokenId,
        uint256 currentPoints,
        uint256 lifetimePoints,
        uint256 achievementsUnlocked
    ) {
        hasToken = workerToTokenId[worker] != 0;
        tokenId = workerToTokenId[worker];
        currentPoints = getCurrentWorkerPoints(worker);
        lifetimePoints = lifetimeWorkerPoints[worker];
        achievementsUnlocked = achievementCount[worker];
    }
    
    /*//////////////////////////////////////////////////////////////
                         ERC165 SUPPORT
    //////////////////////////////////////////////////////////////*/
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
