// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ProjectFactory} from "contracts/modules/ProjectFactory.sol";

contract ProjectFactoryTest is Test {
    ProjectFactory internal projectFactory;

    uint256 internal constant COMMUNITY_ID = 1;
    address internal creator = address(0xA11CE);
    address internal token1155 = address(0xBEEF);

    function setUp() public {
        projectFactory = new ProjectFactory(COMMUNITY_ID);
    }

    function testCreateProjectUsesBoundCommunity() public {
        vm.prank(creator);
        uint256 id = projectFactory.create("ipfs://project-1", token1155);

        (
            address storedCreator,
            string memory cid,
            address storedToken,
            bool active,
            uint256 storedCommunityId
        ) = projectFactory.projects(id);

        assertEq(id, 1);
        assertEq(storedCreator, creator);
        assertEq(cid, "ipfs://project-1");
        assertEq(storedToken, token1155);
        assertTrue(active);
        assertEq(storedCommunityId, COMMUNITY_ID);
        assertEq(projectFactory.communityId(), COMMUNITY_ID);
    }

    function testRevertWhenCommunityIdIsZero() public {
        vm.expectRevert(bytes("invalid community"));
        new ProjectFactory(0);
    }
}
