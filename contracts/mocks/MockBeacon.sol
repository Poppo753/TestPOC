// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title MockBeacon
 * @notice Mock del Beacon per test unitari
 * @dev Permette di configurare implementazioni per moduli
 */
contract MockBeacon {
    mapping(string => address) private implementations;
    
    function setImplementation(string memory moduleName, address implementation) external {
        implementations[moduleName] = implementation;
    }
    
    function getImplementation(string memory moduleName) external view returns (address) {
        return implementations[moduleName];
    }
    
    function getAddress(string memory moduleName) external view returns (address) {
        return implementations[moduleName];
    }
}
