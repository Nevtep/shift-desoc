// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library Errors {
    error NotAuthorized();
    error InvalidParams();
    error NotEligible();
    error NotFound();
    error AlreadyProcessed();
    error WindowClosed();
}
