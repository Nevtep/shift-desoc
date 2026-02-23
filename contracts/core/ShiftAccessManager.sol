// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";

contract ShiftAccessManager is AccessManager {
    constructor(address initialAdmin) AccessManager(initialAdmin) {}
}
