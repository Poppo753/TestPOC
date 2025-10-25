// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * 🎭 MOCK CHAINLINK ORACLE
 * Mock implementazione di Chainlink AggregatorV3Interface per test
 */
contract MockChainlinkOracle {
    int256 private _price;
    uint8 private _decimals;
    string private _description;
    uint256 private _updatedAt;
    uint80 private _roundId;
    bool private _shouldFail;

    event AnswerUpdated(int256 indexed current, uint256 indexed roundId, uint256 updatedAt);

    constructor(
        int256 initialPrice,
        uint8 decimals_,
        string memory description_
    ) {
        _price = initialPrice;
        _decimals = decimals_;
        _description = description_;
        _updatedAt = block.timestamp;
        _roundId = 1;
        _shouldFail = false;
    }

    /**
     * @notice Update the mock price
     */
    function updatePrice(int256 newPrice) external {
        _price = newPrice;
        _updatedAt = block.timestamp;
        _roundId++;
        emit AnswerUpdated(newPrice, _roundId, _updatedAt);
    }

    /**
     * @notice Set whether the oracle should fail
     */
    function setShouldFail(bool shouldFail) external {
        _shouldFail = shouldFail;
    }

    /**
     * @notice Simulate stale price by setting old timestamp
     */
    function makeStale(uint256 ageInSeconds) external {
        _updatedAt = block.timestamp - ageInSeconds;
    }

    /**
     * @notice Get latest round data (Chainlink interface)
     */
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        require(!_shouldFail, "Oracle is failing");
        
        return (
            _roundId,
            _price,
            _updatedAt - 100, // startedAt
            _updatedAt,
            _roundId
        );
    }

    /**
     * @notice Get decimals
     */
    function decimals() external view returns (uint8) {
        return _decimals;
    }

    /**
     * @notice Get description
     */
    function description() external view returns (string memory) {
        return _description;
    }

    /**
     * @notice Get version
     */
    function version() external pure returns (uint256) {
        return 1;
    }

    /**
     * @notice Get round data for specific round
     */
    function getRoundData(uint80 _roundId_)
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        require(!_shouldFail, "Oracle is failing");
        require(_roundId_ <= _roundId, "Round not complete");
        
        return (
            _roundId_,
            _price,
            _updatedAt - 100,
            _updatedAt,
            _roundId_
        );
    }

    // Additional helper functions for testing
    function getCurrentPrice() external view returns (int256) {
        return _price;
    }

    function getCurrentRoundId() external view returns (uint80) {
        return _roundId;
    }

    function getUpdatedAt() external view returns (uint256) {
        return _updatedAt;
    }

    function isFailing() external view returns (bool) {
        return _shouldFail;
    }
}