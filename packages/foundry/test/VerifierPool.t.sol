// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {VerifierPool} from "contracts/modules/VerifierPool.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Errors} from "contracts/libs/Errors.sol";

contract MockCommunityToken is ERC20 {
    constructor() ERC20("Mock Community Token", "MCT") {
        _mint(address(this), 1_000_000e18);
    }
    
    function faucet(address to, uint256 amount) external {
        _transfer(address(this), to, amount);
    }
}

contract MockWorkerSBT {
    mapping(address => bool) private _hasSBT;
    mapping(address => uint256) private _workerPoints;
    
    function setHasSBT(address worker, bool has) external {
        _hasSBT[worker] = has;
    }
    
    function setWorkerPoints(address worker, uint256 points) external {
        _workerPoints[worker] = points;
    }
    
    function hasSBT(address worker) external view returns (bool) {
        return _hasSBT[worker];
    }
    
    function getCurrentWorkerPoints(address worker) external view returns (uint256) {
        return _workerPoints[worker];
    }
}

contract VerifierPoolTest is Test {
    VerifierPool public verifierPool;
    MockCommunityToken public communityToken;
    MockWorkerSBT public workerSBT;
    
    address public owner = address(1);
    address public verifier1 = address(2);
    
    uint256 public constant COMMUNITY_ID = 1;
    uint256 public constant BASE_BOND = 1000e18;

    function setUp() public {
        communityToken = new MockCommunityToken();
        workerSBT = new MockWorkerSBT();
        
        verifierPool = new VerifierPool(
            address(workerSBT),
            address(communityToken),
            COMMUNITY_ID,
            owner
        );
        
        workerSBT.setHasSBT(verifier1, true);
        workerSBT.setWorkerPoints(verifier1, 500);
        communityToken.faucet(verifier1, 10000e18);
    }

    function testConstructor() public view {
        assertEq(address(verifierPool.workerSBT()), address(workerSBT));
        assertEq(address(verifierPool.communityToken()), address(communityToken));
        assertEq(verifierPool.communityId(), COMMUNITY_ID);
        assertEq(verifierPool.owner(), owner);
        assertEq(verifierPool.baseBondAmount(), BASE_BOND);
    }

    function testRegisterAsVerifier() public {
        vm.startPrank(verifier1);
        communityToken.approve(address(verifierPool), BASE_BOND);
        verifierPool.registerAsVerifier(BASE_BOND);
        
        VerifierPool.Verifier memory verifierInfo = verifierPool.getVerifier(verifier1);
        assertEq(verifierInfo.bondAmount, BASE_BOND);
        assertTrue(verifierInfo.isActive);
        
        address[] memory activeVerifiers = verifierPool.getActiveVerifiers();
        assertEq(activeVerifiers.length, 1);
        assertEq(activeVerifiers[0], verifier1);
        
        vm.stopPrank();
    }

    function testIsEligibleVerifier() public {
        assertTrue(verifierPool.isEligibleVerifier(verifier1));
        
        address nonWorker = address(10);
        assertFalse(verifierPool.isEligibleVerifier(nonWorker));
    }
}
