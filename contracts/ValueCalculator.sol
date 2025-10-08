// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Interfaces to interact with other modules

interface ITokenManager {
    function getTokenPriceWithEvents(string memory _tokenCode) external returns (uint256 price, uint256 updatedAt);
    function getCachedTokenValue(string memory _tokenCode) external view returns (uint256 value, bool isValid);
    function calculateTokenValue(string memory _tokenCode) external returns (uint256);
    function getActiveTokens() external view returns (string[] memory); // Aggiunta della funzione
    function invalidateCache(string memory _tokenCode) external;
}


interface IParameterManager {
    function getCurrentParameterValue(string memory parameterName) external view returns (uint256);
}

interface IBeacon {
    function getImplementation(string memory moduleName) external view returns (address);
}


import "./Beacon.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract ValueCalculator is Ownable {
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

    function getCachedTokenValue(string memory _tokenCode) public view returns (uint256 value, bool isValid) {
        address tokenManagerAddress = IBeacon(beaconAddress).getImplementation("TokenManager");
        ITokenManager tokenManager = ITokenManager(tokenManagerAddress);
        return tokenManager.getCachedTokenValue(_tokenCode);
    }

    function calculateTokenValue(string memory _tokenCode) public returns (uint256) {
        address tokenManagerAddress = IBeacon(beaconAddress).getImplementation("TokenManager");
        ITokenManager tokenManager = ITokenManager(tokenManagerAddress);
        return tokenManager.calculateTokenValue(_tokenCode);
    }

    function getTotalPoolValue() external returns (uint256 totalValue) {
        address tokenManagerAddress = IBeacon(beaconAddress).getImplementation("TokenManager");
        ITokenManager tokenManager = ITokenManager(tokenManagerAddress);

        // Fetch list of active tokens
        string[] memory activeTokens = tokenManager.getActiveTokens();

        for (uint256 i = 0; i < activeTokens.length; i++) {
            totalValue += tokenManager.calculateTokenValue(activeTokens[i]);
        }
    }

    function invalidateCache(string memory _tokenCode) external onlyOwner {
        address tokenManagerAddress = IBeacon(beaconAddress).getImplementation("TokenManager");
        ITokenManager tokenManager = ITokenManager(tokenManagerAddress);
        tokenManager.invalidateCache(_tokenCode);
    }
}
