// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Interfaces to interact with other modules
interface ILiquidityManager {
    function withdrawAllAssets(address recipient) external;
    function pause() external;
    function unpause() external;
}

interface ITokenManager {
    function getActiveTokens() external view returns (string[] memory);
    function getTokenAddress(string memory tokenCode) external view returns (address);
}

interface IValueCalculator {
    function getTotalPoolValue() external view returns (uint256);
}

interface IWETH {
    function withdraw(uint256 amount) external;
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IBeacon {
    function getImplementation(string memory moduleName) external view returns (address);
}

import "./Beacon.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract EmergencyHandler is Ownable {
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

    function pause() external onlyOwner {
        address liquidityManagerAddress = IBeacon(beaconAddress).getImplementation("LiquidityManager");
        ILiquidityManager liquidityManager = ILiquidityManager(liquidityManagerAddress);
        liquidityManager.pause();
    }

    function unpause() external onlyOwner {
        address liquidityManagerAddress = IBeacon(beaconAddress).getImplementation("LiquidityManager");
        ILiquidityManager liquidityManager = ILiquidityManager(liquidityManagerAddress);
        liquidityManager.unpause();
    }

    function emergencyWithdraw() external onlyOwner {
        address tokenManagerAddress = IBeacon(beaconAddress).getImplementation("TokenManager");
        ITokenManager tokenManager = ITokenManager(tokenManagerAddress);

        address liquidityManagerAddress = IBeacon(beaconAddress).getImplementation("LiquidityManager");
        ILiquidityManager liquidityManager = ILiquidityManager(liquidityManagerAddress);

        // Retrieve active tokens from TokenManager
        string[] memory activeTokens = tokenManager.getActiveTokens();

        // Withdraw all assets for each active token
        for (uint256 i = 0; i < activeTokens.length; i++) {
            address tokenAddress = tokenManager.getTokenAddress(activeTokens[i]);
            require(tokenAddress != address(0), "Invalid token address");

            // Interact with LiquidityManager to withdraw assets
            liquidityManager.withdrawAllAssets(owner());
        }

        // Include WETH withdrawal
        address wethAddress = IBeacon(beaconAddress).getImplementation("WETH");
        require(wethAddress != address(0), "Invalid WETH address");

        IWETH weth = IWETH(wethAddress);
        uint256 wethBalance = weth.balanceOf(address(this));
        if (wethBalance > 0) {
            weth.withdraw(wethBalance);
            require(weth.transfer(owner(), wethBalance), "WETH transfer failed");
        }
    }

    function getEmergencyReport() external view returns (uint256 totalValue) {
        address valueCalculatorAddress = IBeacon(beaconAddress).getImplementation("ValueCalculator");
        IValueCalculator valueCalculator = IValueCalculator(valueCalculatorAddress);

        totalValue = valueCalculator.getTotalPoolValue();
    }
}
