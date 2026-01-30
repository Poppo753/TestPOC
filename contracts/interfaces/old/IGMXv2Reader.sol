// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IGMXv2Reader
 * @notice Interface for GMX V2 Reader contract
 * @dev Used for getting quotes and market info
 * 
 * CONTRACT ADDRESS (Arbitrum):
 * Reader: 0xf60becbba223EEA9495Da3f606753867eC10d139
 * DataStore: 0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8
 * 
 * DOCUMENTATION:
 * https://github.com/gmx-io/gmx-synthetics/blob/main/contracts/reader/Reader.sol
 */
interface IGMXv2Reader {
    
    /**
     * @notice Market configuration info
     * @param marketToken GM token address
     * @param indexToken Index token (e.g., WETH for ETH market)
     * @param longToken Long collateral token
     * @param shortToken Short collateral token
     */
    struct Market {
        address marketToken;
        address indexToken;
        address longToken;
        address shortToken;
    }
    
    /**
     * @notice Market prices from oracles
     * @param indexTokenPrice Index token price (min, max)
     * @param longTokenPrice Long token price (min, max)
     * @param shortTokenPrice Short token price (min, max)
     */
    struct MarketPrices {
        Price indexTokenPrice;
        Price longTokenPrice;
        Price shortTokenPrice;
    }
    
    /**
     * @notice Price with min/max bounds
     */
    struct Price {
        uint256 min;
        uint256 max;
    }
    
    /**
     * @notice Get market info for a GM token
     * @param dataStore DataStore contract address
     * @param market Market struct with token addresses
     * @return marketInfo Market configuration
     */
    function getMarket(address dataStore, address market) 
        external view returns (Market memory marketInfo);
    
    /**
     * @notice Get deposit amount out (quote for minting GM)
     * @param dataStore DataStore contract address
     * @param market Market struct
     * @param prices MarketPrices struct
     * @param longTokenAmount Amount of long token to deposit
     * @param shortTokenAmount Amount of short token to deposit
     * @param uiFeeReceiver UI fee receiver address
     * @return marketTokenAmount Expected GM tokens to receive
     */
    function getDepositAmountOut(
        address dataStore,
        Market memory market,
        MarketPrices memory prices,
        uint256 longTokenAmount,
        uint256 shortTokenAmount,
        address uiFeeReceiver
    ) external view returns (uint256 marketTokenAmount);
    
    /**
     * @notice Get withdrawal amount out (quote for burning GM)
     * @param dataStore DataStore contract address
     * @param market Market struct
     * @param prices MarketPrices struct
     * @param marketTokenAmount Amount of GM tokens to burn
     * @param uiFeeReceiver UI fee receiver address
     * @return longTokenAmount Expected long token amount
     * @return shortTokenAmount Expected short token amount
     */
    function getWithdrawalAmountOut(
        address dataStore,
        Market memory market,
        MarketPrices memory prices,
        uint256 marketTokenAmount,
        address uiFeeReceiver
    ) external view returns (uint256 longTokenAmount, uint256 shortTokenAmount);
}
