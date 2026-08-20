// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IParameterManagerForModules {
    function getCurrentParameterValue(string memory parameterName) external view returns (uint256);
    function isPaused() external view returns (bool);
}
