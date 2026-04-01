// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title MockBeacon
 * @notice Mock del Beacon per test unitari
 * @dev Permette di configurare implementazioni per moduli
 */
contract MockBeacon {
    mapping(string => address) private implementations;
    string[] private moduleNames;
    mapping(string => bool) private moduleExists;
    
    function setImplementation(string memory moduleName, address implementation) external {
        if (!moduleExists[moduleName]) {
            moduleNames.push(moduleName);
            moduleExists[moduleName] = true;
        }
        implementations[moduleName] = implementation;
    }
    
    function getImplementation(string memory moduleName) external view returns (address) {
        return implementations[moduleName];
    }
    
    function getAddress(string memory moduleName) external view returns (address) {
        return implementations[moduleName];
    }

    function getRegisteredModules() external view returns (string[] memory) {
        return moduleNames;
    }
}
