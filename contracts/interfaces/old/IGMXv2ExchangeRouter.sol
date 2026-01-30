// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IGMXv2ExchangeRouter
 * @notice Interface for GMX V2 ExchangeRouter
 * @dev Main entry point for creating deposits/withdrawals in GMX V2
 * 
 * CONTRACT ADDRESS (Arbitrum):
 * ExchangeRouter: 0x7C68C7866A64FA2160F78EEaE12217FFbf871fa8
 * 
 * DOCUMENTATION:
 * https://github.com/gmx-io/gmx-synthetics/blob/main/contracts/router/ExchangeRouter.sol
 */
interface IGMXv2ExchangeRouter {
    
    /**
     * @notice Parameters for creating a deposit (minting GM tokens)
     * @param receiver Address that will receive GM tokens
     * @param callbackContract Optional callback contract
     * @param uiFeeReceiver Address for UI fee distribution
     * @param market GM market address (e.g., GM:ETH/USD market)
     * @param initialLongToken Long token address (e.g., WETH)
     * @param initialShortToken Short token address (e.g., USDC)
     * @param longTokenSwapPath Path for swapping long token (empty for direct)
     * @param shortTokenSwapPath Path for swapping short token (empty for direct)
     * @param minMarketTokens Minimum GM tokens to receive (slippage protection)
     * @param shouldUnwrapNativeToken Whether to unwrap WETH to ETH
     * @param executionFee Execution fee in ETH for keeper
     * @param callbackGasLimit Gas limit for callback
     */
    struct CreateDepositParams {
        address receiver;
        address callbackContract;
        address uiFeeReceiver;
        address market;
        address initialLongToken;
        address initialShortToken;
        address[] longTokenSwapPath;
        address[] shortTokenSwapPath;
        uint256 minMarketTokens;
        bool shouldUnwrapNativeToken;
        uint256 executionFee;
        uint256 callbackGasLimit;
    }
    
    /**
     * @notice Parameters for creating a withdrawal (burning GM tokens)
     * @param receiver Address that will receive output tokens
     * @param callbackContract Optional callback contract
     * @param uiFeeReceiver Address for UI fee distribution
     * @param market GM market address
     * @param longTokenSwapPath Path for receiving long token
     * @param shortTokenSwapPath Path for receiving short token
     * @param minLongTokenAmount Minimum long token to receive
     * @param minShortTokenAmount Minimum short token to receive
     * @param shouldUnwrapNativeToken Whether to unwrap WETH to ETH
     * @param executionFee Execution fee in ETH for keeper
     * @param callbackGasLimit Gas limit for callback
     */
    struct CreateWithdrawalParams {
        address receiver;
        address callbackContract;
        address uiFeeReceiver;
        address market;
        address[] longTokenSwapPath;
        address[] shortTokenSwapPath;
        uint256 minLongTokenAmount;
        uint256 minShortTokenAmount;
        bool shouldUnwrapNativeToken;
        uint256 executionFee;
        uint256 callbackGasLimit;
    }
    
    /**
     * @notice Create a deposit to mint GM tokens
     * @dev ASYNC OPERATION - Keeper executes after ~1-2 minutes
     * @param params CreateDepositParams struct
     * @return depositKey Unique key for tracking deposit
     * 
     * FLOW:
     * 1. User approves tokens to ExchangeRouter
     * 2. User sends execution fee in ETH (msg.value)
     * 3. ExchangeRouter creates deposit request
     * 4. Keeper executes deposit after delay
     * 5. GM tokens minted to receiver
     */
    function createDeposit(CreateDepositParams calldata params) 
        external payable returns (bytes32 depositKey);
    
    /**
     * @notice Create a withdrawal to burn GM tokens
     * @dev ASYNC OPERATION - Keeper executes after ~1-2 minutes
     * @param params CreateWithdrawalParams struct
     * @return withdrawalKey Unique key for tracking withdrawal
     */
    function createWithdrawal(CreateWithdrawalParams calldata params)
        external payable returns (bytes32 withdrawalKey);
    
    /**
     * @notice Send WETH for execution fees
     * @param receiver Address to receive WETH
     * @param amount Amount of WETH
     */
    function sendWnt(address receiver, uint256 amount) external payable;
    
    /**
     * @notice Send tokens (for deposit collateral)
     * @param token Token address
     * @param receiver Receiver address
     * @param amount Amount to send
     */
    function sendTokens(address token, address receiver, uint256 amount) external;
}
