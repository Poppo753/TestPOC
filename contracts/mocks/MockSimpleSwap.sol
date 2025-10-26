// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ISimpleSwap.sol";

/**
 * @title MockSimpleSwap
 * @dev Mock DEX router for testing SwapManager
 * Simulates swaps with configurable behavior
 */
contract MockSimpleSwap is ISimpleSwap {
    
    // Mapping to store expected output amounts per token pair
    mapping(address => mapping(address => uint256)) public expectedOutputs;
    
    // Custody holder address (ProxyGeneral in custody pattern)
    address public custodyHolder;
    
    // Flag to simulate swap failures
    bool public shouldFail;
    
    // Flag to simulate low output (slippage)
    bool public simulateLowOutput;
    uint256 public lowOutputPercentage = 9000; // 90% of expected (10% slippage)
    
    /**
     * @notice Set custody holder (ProxyGeneral) for custody-based swaps
     */
    function setCustodyHolder(address _custodyHolder) external {
        custodyHolder = _custodyHolder;
    }
    
    /**
     * @notice Set expected output for a token pair
     */
    function setExpectedOutput(
        address spendToken,
        address receiveToken,
        uint256 expectedOutput
    ) external {
        expectedOutputs[spendToken][receiveToken] = expectedOutput;
    }
    
    /**
     * @notice Toggle failure simulation
     */
    function setShouldFail(bool _shouldFail) external {
        shouldFail = _shouldFail;
    }
    
    /**
     * @notice Toggle low output simulation (slippage)
     */
    function setSimulateLowOutput(bool _simulate, uint256 _percentage) external {
        simulateLowOutput = _simulate;
        if (_percentage > 0 && _percentage <= 10000) {
            lowOutputPercentage = _percentage;
        }
    }
    
    /**
     * @notice Simulate input swap (spend exact amount, receive variable)
     * @dev Supports custody pattern: if custodyHolder is set, pull tokens from there
     * @param spendToken Token to spend
     * @param receiveToken Token to receive
     * @param amountIn Amount of spendToken to spend
     * @return Amount of receiveToken received
     */
    function inputSwap(
        address spendToken,
        address receiveToken,
        uint256 amountIn
    ) external override returns (uint256) {
        require(!shouldFail, "MockSimpleSwap: Swap failed");
        require(amountIn > 0, "MockSimpleSwap: Invalid amount");
        require(spendToken != receiveToken, "MockSimpleSwap: Same token");
        
        // Determine token holder: custody pattern or caller
        address tokenHolder = (custodyHolder != address(0)) ? custodyHolder : msg.sender;
        
        // Transfer spend token from holder (approval must be set beforehand)
        require(
            IERC20(spendToken).transferFrom(tokenHolder, address(this), amountIn),
            "MockSimpleSwap: Transfer failed"
        );
        
        // Calculate output amount
        uint256 expectedOutput = expectedOutputs[spendToken][receiveToken];
        require(expectedOutput > 0, "MockSimpleSwap: No output configured");
        
        uint256 actualOutput = expectedOutput;
        
        // Simulate slippage if enabled
        if (simulateLowOutput) {
            actualOutput = (expectedOutput * lowOutputPercentage) / 10000;
        }
        
        // Transfer receive token to appropriate destination
        // If custody pattern is enabled, send to custody holder (ProxyGeneral)
        // Otherwise send to caller (SwapManager)
        address recipient = (custodyHolder != address(0)) ? custodyHolder : msg.sender;
        require(
            IERC20(receiveToken).transfer(recipient, actualOutput),
            "MockSimpleSwap: Transfer failed"
        );
        
        return actualOutput;
    }
    
    /**
     * @notice Simulate output swap (receive exact amount, spend variable)
     */
    function outputSwap(
        address spendToken,
        address receiveToken,
        uint256 amountInMax,
        uint256 amountOut
    ) external override returns (uint256) {
        require(!shouldFail, "MockSimpleSwap: Swap failed");
        require(amountOut > 0, "MockSimpleSwap: Invalid amount");
        
        // For simplicity, spend proportional amount
        uint256 amountIn = (amountOut * 11) / 10; // 10% markup
        require(amountIn <= amountInMax, "MockSimpleSwap: Insufficient max amount");
        
        // Transfer tokens
        require(
            IERC20(spendToken).transferFrom(msg.sender, address(this), amountIn),
            "MockSimpleSwap: Transfer failed"
        );
        require(
            IERC20(receiveToken).transfer(msg.sender, amountOut),
            "MockSimpleSwap: Transfer failed"
        );
        
        return amountIn;
    }
    
    /**
     * @notice Get expected output for a swap
     */
    function getExpectedOutput(
        address spendToken,
        address receiveToken,
        uint256 /* amountIn */
    ) external view override returns (uint256) {
        uint256 baseOutput = expectedOutputs[spendToken][receiveToken];
        
        // Simple linear scaling based on amountIn
        // In real DEX, this would be more complex (AMM formula)
        if (baseOutput == 0) return 0;
        
        // Scale output proportionally (assuming baseOutput is for 1 unit)
        return baseOutput;
    }
}
