// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBeacon {
    function getImplementation(string memory moduleName) external view returns (address);
    function upgradeImplementation(string memory moduleName, address newImplementation) external;
}
