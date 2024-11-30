// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

contract MyStrategy {
    string public strategyName;

    constructor(string memory _name) {
        strategyName = _name;
    }
}
