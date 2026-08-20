// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

contract MockInterVaultValueCalculator {
    uint256 public value;
    bool public shouldRevert;
    function setValue(uint256 newValue) external { value = newValue; }
    function setShouldRevert(bool enabled) external { shouldRevert = enabled; }
    function getTotalPoolValueView() external view returns (uint256) {
        require(!shouldRevert, "mock valuation failure");
        return value;
    }
}
