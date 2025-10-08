// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Interfaces for external contracts
interface IBeacon {
    function getImplementation(string memory moduleName) external view returns (address);
}

interface ITokenManager {
    function isValidToken(string memory tokenCode) external view returns (bool);
    function getTokenAddress(string memory tokenCode) external view returns (address);
    function getTokenCount() external view returns (uint256);
    function getActiveTokens() external view returns (string[] memory);
}

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
}

interface IValueCalculator {
    function calculateTokenValue(string memory tokenCode) external view returns (uint256);
    function getTotalPoolValue() external view returns (uint256);
}

interface IProxyGeneral {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function transferFunds(address to, uint256 amount) external;
}

interface ISwapManager {
    function performSwap(string memory spendTokenCode, string memory receiveTokenCode, uint256 amountIn) external returns (uint256);
}

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LiquidityManager is ReentrancyGuard, Ownable {
    address public immutable beaconAddress;

    constructor(address _beaconAddress) {
        require(_beaconAddress != address(0), "Invalid Beacon address");
        beaconAddress = _beaconAddress;
    }

    modifier onlyFromModule(string memory moduleName) {
        require(
            msg.sender == IBeacon(beaconAddress).getImplementation(moduleName),
            "Caller is not the required module"
        );
        _;
    }

    function deposit() external payable nonReentrant {
        require(msg.value > 0, "Must send ETH to deposit");

        // Get WETH address from Beacon
        address wethAddress = IBeacon(beaconAddress).getImplementation("WETH");
        IWETH weth = IWETH(wethAddress);

        // Wrap ETH to WETH
        weth.deposit{value: msg.value}();

        // Get Proxy General address from Beacon
        address proxyGeneralAddress = IBeacon(beaconAddress).getImplementation("ProxyGeneral");
        IProxyGeneral proxyGeneral = IProxyGeneral(proxyGeneralAddress);

        // Transfer WETH to Proxy General
        require(weth.transfer(proxyGeneralAddress, msg.value), "WETH transfer failed");

        // Mint LP tokens
        proxyGeneral.mint(msg.sender, msg.value);
    }

    function withdraw(uint256 lpAmount) external nonReentrant {
        require(lpAmount > 0, "Must specify LP amount to withdraw");

        // Get Proxy General address from Beacon
        address proxyGeneralAddress = IBeacon(beaconAddress).getImplementation("ProxyGeneral");
        IProxyGeneral proxyGeneral = IProxyGeneral(proxyGeneralAddress);

        // Burn LP tokens
        proxyGeneral.burn(msg.sender, lpAmount);

        // Get WETH address from Beacon
        address wethAddress = IBeacon(beaconAddress).getImplementation("WETH");
        IWETH weth = IWETH(wethAddress);

        // Check pool value and ensure sufficient liquidity
        address valueCalculatorAddress = IBeacon(beaconAddress).getImplementation("ValueCalculator");
        IValueCalculator valueCalculator = IValueCalculator(valueCalculatorAddress);
        uint256 poolValue = valueCalculator.getTotalPoolValue();
        require(poolValue >= lpAmount, "Insufficient pool value");

        uint256 wethBalance = weth.balanceOf(proxyGeneralAddress);
        if (wethBalance < lpAmount) {
            uint256 wethNeeded = lpAmount - wethBalance;

            // Get Swap Manager address from Beacon
            address swapManagerAddress = IBeacon(beaconAddress).getImplementation("SwapManager");
            ISwapManager swapManager = ISwapManager(swapManagerAddress);

            // Perform swap to get required WETH
            uint256 receivedWeth = swapManager.performSwap("TOKEN", "WETH", wethNeeded);
            require(receivedWeth >= wethNeeded, "Swap failed to provide sufficient WETH");
        }

        // Transfer WETH from Proxy General to user
        proxyGeneral.transferFunds(msg.sender, lpAmount);
    }

    receive() external payable {
        revert("Direct ETH transfers not allowed. Use deposit().");
    }

    fallback() external payable {
        revert("Function does not exist.");
    }
}
