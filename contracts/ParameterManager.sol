// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Interface to interact with the Beacon contract
interface IBeacon {
    function getImplementation(string memory moduleName) external view returns (address);
}

import "./Beacon.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ParameterManager is Ownable {
    // Beacon address to retrieve module addresses
    address public immutable beaconAddress;

    constructor(address _beaconAddress) {
        require(_beaconAddress != address(0), "Invalid Beacon address");
        beaconAddress = _beaconAddress;
    }

    modifier onlyFromModule(string memory moduleName) {
        require(msg.sender == IBeacon(beaconAddress).getImplementation(moduleName), "Caller is not the required module");
        _;
    }

    // Function to check if a parameter is valid
    function isValidParameter(string calldata parameterName, uint256 newValue) internal pure returns (bool) {
        bytes32 paramHash = keccak256(bytes(parameterName));

        if (paramHash == keccak256(bytes("maxDeposit"))) {
            return newValue >= 1 ether;
        } else if (paramHash == keccak256(bytes("maxWithdrawPerTx"))) {
            return newValue >= 0.1 ether;
        } else if (paramHash == keccak256(bytes("minDeposit"))) {
            return newValue <= 1 ether;
        } else if (paramHash == keccak256(bytes("minWithdraw"))) {
            return newValue <= 1 ether;
        } else if (paramHash == keccak256(bytes("maxSlippage"))) {
            return newValue <= 1000; // Max 10%
        } else if (paramHash == keccak256(bytes("poolReserveRatio"))) {
            return newValue <= 5000; // Max 50%
        } else if (paramHash == keccak256(bytes("cacheDuration"))) {
            return newValue <= 1 hours;
        } else if (paramHash == keccak256(bytes("maxPriceAge"))) {
            return newValue <= 48 hours;
        } else if (paramHash == keccak256(bytes("maxTokensPerOperation"))) {
            return newValue <= 20;
        } else if (paramHash == keccak256(bytes("maxErrors"))) {
            return newValue <= 10;
        } else if (paramHash == keccak256(bytes("withdrawLimitPerHour"))) {
            return newValue >= 1 ether;
        }

        return false;
    }

    // Function to get the current value of a parameter
    function getCurrentParameterValue(string calldata parameterName) public view returns (uint256) {
        bytes32 paramHash = keccak256(bytes(parameterName));

        if (paramHash == keccak256(bytes("maxDeposit"))) return 100 ether;
        if (paramHash == keccak256(bytes("maxWithdrawPerTx"))) return 50 ether;
        if (paramHash == keccak256(bytes("minDeposit"))) return 0.000001 ether;
        if (paramHash == keccak256(bytes("minWithdraw"))) return 0.000001 ether;
        if (paramHash == keccak256(bytes("maxSlippage"))) return 200;
        if (paramHash == keccak256(bytes("poolReserveRatio"))) return 0;
        if (paramHash == keccak256(bytes("cacheDuration"))) return 5 minutes;
        if (paramHash == keccak256(bytes("maxPriceAge"))) return 24 hours;
        if (paramHash == keccak256(bytes("maxTokensPerOperation"))) return 10;
        if (paramHash == keccak256(bytes("maxErrors"))) return 3;
        if (paramHash == keccak256(bytes("withdrawLimitPerHour"))) return 100 ether;

        revert("Invalid parameter name");
    }

    // Function to update a parameter value
    function updateParameterValue(string calldata parameterName, uint256 newValue) external onlyOwner {
        require(newValue > 0, "Invalid value");

        // Validate parameter name and value
        require(isValidParameter(parameterName, newValue), "Invalid parameter or value");

        // Get old value for event emission
        uint256 oldValue = getCurrentParameterValue(parameterName);

        // Emit event for parameter update
        emit ParameterUpdated(parameterName, oldValue, newValue, block.timestamp, msg.sender);
    }

    // Event for parameter updates
    event ParameterUpdated(
        string indexed parameterName,
        uint256 oldValue,
        uint256 newValue,
        uint256 timestamp,
        address indexed executor
    );
}
