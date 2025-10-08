// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TokenManager is Ownable {
    struct TokenInfo {
        address tokenAddress;
        uint8 tokenDecimals;
        string tokenCode;
        address priceFeed;
        uint8 priceFeedDecimals;
        bool isActive;
        uint256 lastPriceTimestamp;
        uint256 lastPrice;
        uint256 heartbeat;
    }

    mapping(string => TokenInfo) private tokenData;
    string[] private tokenCodes;

    event TokenAdded(string indexed tokenCode, address tokenAddress, address priceFeed);
    event TokenRemoved(string indexed tokenCode);
    event HeartbeatUpdated(string indexed tokenCode, uint256 newHeartbeat);

    /**
     * @notice Adds or updates a token in the pool
     * @param _tokenCode Unique identifier for the token
     * @param _tokenAddress Address of the ERC20 token contract
     * @param _priceFeed Address of the Chainlink price feed
     * @param _tokenDecimals Number of decimals for the token
     * @param _priceFeedDecimals Number of decimals in price feed
     * @param _heartbeat Maximum time between price updates
     */
    function manageTokenData(
        string memory _tokenCode,
        address _tokenAddress,
        address _priceFeed,
        uint8 _tokenDecimals,
        uint8 _priceFeedDecimals,
        uint256 _heartbeat
    ) external onlyOwner {
        require(_tokenAddress != address(0), "Invalid token address");
        require(_priceFeed != address(0), "Invalid price feed address");
        require(bytes(_tokenCode).length > 0, "Invalid token code");
        require(_heartbeat > 0, "Invalid heartbeat");

        if (!tokenData[_tokenCode].isActive) {
            tokenCodes.push(_tokenCode);
        }

        tokenData[_tokenCode] = TokenInfo({
            tokenAddress: _tokenAddress,
            tokenDecimals: _tokenDecimals,
            tokenCode: _tokenCode,
            priceFeed: _priceFeed,
            priceFeedDecimals: _priceFeedDecimals,
            isActive: true,
            lastPriceTimestamp: 0,
            lastPrice: 0,
            heartbeat: _heartbeat
        });

        emit TokenAdded(_tokenCode, _tokenAddress, _priceFeed);
    }

    /**
     * @notice Removes a token from the pool
     * @param _tokenCode The token code to remove
     */
    function removeToken(string memory _tokenCode) external onlyOwner {
        require(tokenData[_tokenCode].isActive, "Token not active");

        tokenData[_tokenCode].isActive = false;

        for (uint256 i = 0; i < tokenCodes.length; i++) {
            if (keccak256(bytes(tokenCodes[i])) == keccak256(bytes(_tokenCode))) {
                tokenCodes[i] = tokenCodes[tokenCodes.length - 1];
                tokenCodes.pop();
                break;
            }
        }

        emit TokenRemoved(_tokenCode);
    }

    /**
     * @notice Updates the heartbeat duration for a token's price feed
     * @param _tokenCode The token to update
     * @param _newHeartbeat New maximum time between price updates
     */
    function updateHeartbeat(string memory _tokenCode, uint256 _newHeartbeat) external onlyOwner {
        require(_newHeartbeat > 0, "Invalid heartbeat");
        require(tokenData[_tokenCode].isActive, "Token not active");

        tokenData[_tokenCode].heartbeat = _newHeartbeat;
        emit HeartbeatUpdated(_tokenCode, _newHeartbeat);
    }

    /**
     * @notice Gets the latest price for a token from Chainlink without events
     * @param _tokenCode The token to get the price for
     * @return price The current price
     * @return updatedAt The timestamp of the price
     * @return isStale Whether the price is considered stale
     */
    function getTokenPrice(string memory _tokenCode)
        public
        view
        returns (
            uint256 price,
            uint256 updatedAt,
            bool isStale
        )
    {
        TokenInfo memory token = tokenData[_tokenCode];
        require(token.isActive, "Token not active");

        AggregatorV3Interface priceFeed = AggregatorV3Interface(token.priceFeed);
        (
            ,
            int256 rawPrice,
            ,
            uint256 timestamp,
            
        ) = priceFeed.latestRoundData();

        require(rawPrice > 0, "Invalid price");
        return (
            uint256(rawPrice),
            timestamp,
            block.timestamp - timestamp > token.heartbeat
        );
    }

    /**
     * @notice Gets the latest price and emits events if needed
     * @param _tokenCode The token to get the price for
     * @return price The current price
     * @return updatedAt The timestamp of the price
     */
    function getTokenPriceWithEvents(string memory _tokenCode)
        public
        returns (uint256 price, uint256 updatedAt)
    {
        (price, updatedAt, ) = getTokenPrice(_tokenCode);
        tokenData[_tokenCode].lastPrice = price;
        tokenData[_tokenCode].lastPriceTimestamp = updatedAt;
    }

    /**
     * @notice Gets the number of tokens managed by the pool
     * @return The number of tokens in the pool
     */
    function getTokenCount() external view returns (uint256) {
        return tokenCodes.length;
    }

    /**
     * @notice Gets a list of all active tokens in the pool
     * @return Array of active token codes
     */
    function getActiveTokens() external view returns (string[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < tokenCodes.length; i++) {
            if (tokenData[tokenCodes[i]].isActive) {
                activeCount++;
            }
        }

        string[] memory activeTokens = new string[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < tokenCodes.length; i++) {
            if (tokenData[tokenCodes[i]].isActive) {
                activeTokens[index] = tokenCodes[i];
                index++;
            }
        }
        return activeTokens;
    }

    // Interface for other modules to interact with TokenManager
    function getTokenAddress(string memory _tokenCode) external view returns (address) {
        return tokenData[_tokenCode].tokenAddress;
    }

    function getTokenPriceForModule(string memory _tokenCode) external view returns (uint256) {
        (uint256 price, , ) = getTokenPrice(_tokenCode);
        return price;
    }
}
