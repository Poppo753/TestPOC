// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Interface for TokenManager
interface ITokenManager {
    function getTokenAddress(string memory tokenCode) external view returns (address);
    function isTokenActive(string memory tokenCode) external view returns (bool);
}

// Interface for SimpleSwap
interface ISimpleSwap {
    function inputSwap(address spendToken, address receiveToken, uint256 amountIn) external returns (uint256);
}

// Interface for Beacon to get module addresses
interface IBeacon {
    function getImplementation(string memory moduleName) external view returns (address);
}

/**
 * @title SwapManager
 * @notice Handles token swaps using the SimpleSwap protocol.
 */
contract SwapManager is Ownable, ReentrancyGuard {
    address public immutable beacon;

    event SwapExecuted(
        string spendTokenCode,
        string receiveTokenCode,
        uint256 amountIn,
        uint256 amountReceived
    );

    event SwapFailed(
        string spendTokenCode,
        string receiveTokenCode,
        uint256 amountIn,
        string reason
    );

    /**
     * @dev Constructor to set the Beacon address.
     * @param _beacon Address of the Beacon contract.
     */
    constructor(address _beacon) {
        require(_beacon != address(0), "Invalid beacon address");
        beacon = _beacon;
    }

    /**
     * @notice Performs a token swap using the SimpleSwap protocol.
     * @param spendTokenCode Code of the token to spend.
     * @param receiveTokenCode Code of the token to receive.
     * @param amountIn Amount of tokens to spend.
     * @return amountReceived Amount of tokens received.
     */
    function performSwap(
        string memory spendTokenCode,
        string memory receiveTokenCode,
        uint256 amountIn
    ) 
        external
        nonReentrant
        returns (uint256 amountReceived)
    {
        require(amountIn > 0, "Amount must be greater than 0");

        // Fetch addresses of TokenManager and SimpleSwap from Beacon
        address tokenManagerAddress = IBeacon(beacon).getImplementation("TokenManager");
        address simpleSwapAddress = IBeacon(beacon).getImplementation("SimpleSwap");

        require(tokenManagerAddress != address(0), "TokenManager not configured");
        require(simpleSwapAddress != address(0), "SimpleSwap not configured");

        ITokenManager tokenManager = ITokenManager(tokenManagerAddress);
        ISimpleSwap simpleSwap = ISimpleSwap(simpleSwapAddress);

        // Validate token codes and get token addresses
        require(tokenManager.isTokenActive(spendTokenCode), "Spend token is inactive");
        require(tokenManager.isTokenActive(receiveTokenCode), "Receive token is inactive");

        address spendToken = tokenManager.getTokenAddress(spendTokenCode);
        address receiveToken = tokenManager.getTokenAddress(receiveTokenCode);

        require(spendToken != address(0) && receiveToken != address(0), "Invalid token addresses");
        require(spendToken != receiveToken, "Cannot swap the same token");

        // Approve SimpleSwap to spend tokens
        IERC20(spendToken).approve(simpleSwapAddress, 0); // Reset approval
        IERC20(spendToken).approve(simpleSwapAddress, amountIn);

        // Perform the swap
        try simpleSwap.inputSwap(spendToken, receiveToken, amountIn) returns (uint256 received) {
            amountReceived = received;
            emit SwapExecuted(spendTokenCode, receiveTokenCode, amountIn, received);
        } catch Error(string memory reason) {
            emit SwapFailed(spendTokenCode, receiveTokenCode, amountIn, reason);
            revert(reason);
        }
    }
}
