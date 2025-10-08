// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title Beacon
 * @dev Contract to manage module implementations for a proxy system.
 * @custom:security-contact security@yourdomain.com
 */
contract Beacon {
    /// @notice Mapping from module name to implementation address
    mapping(string => address) private implementations;

    /// @notice Owner of the Beacon contract
    address public owner;

    /// @notice Emitted when an implementation address is updated
    event ImplementationUpdated(string module, address indexed newImplementation);

    /// @dev Modifier to restrict access to the owner
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    /**
     * @dev Constructor sets the deployer as the owner
     */
    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Updates the implementation address for a specific module
     * @param module Name of the module (e.g., "TokenManager")
     * @param newImplementation Address of the new implementation contract
     */
    function updateImplementation(string memory module, address newImplementation) external onlyOwner {
        require(bytes(module).length > 0, "Invalid module name");
        require(newImplementation != address(0), "Invalid implementation address");
        implementations[module] = newImplementation;
        emit ImplementationUpdated(module, newImplementation);
    }

    /**
     * @notice Gets the implementation address for a specific module
     * @param module Name of the module (e.g., "TokenManager")
     * @return Address of the implementation contract
     */
    function getImplementation(string memory module) external view returns (address) {
        require(bytes(module).length > 0, "Invalid module name");
        address implementation = implementations[module];
        require(implementation != address(0), "Implementation not found");
        return implementation;
    }

    /**
     * @notice Transfers ownership of the Beacon to a new owner
     * @param newOwner Address of the new owner
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner address");
        owner = newOwner;
    }
}
