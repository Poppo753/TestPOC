// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockReentrantToken
 * @notice ERC20 token that calls back into a target contract on transfer
 * @dev Used for testing reentrancy guards
 */
contract MockReentrantToken is ERC20 {
    address public attackTarget;
    bytes public attackCalldata;
    bool public attackEnabled;

    constructor() ERC20("Reentrant Token", "REENT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setAttack(address target, bytes calldata data) external {
        attackTarget = target;
        attackCalldata = data;
        attackEnabled = true;
    }

    function disableAttack() external {
        attackEnabled = false;
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        super._afterTokenTransfer(from, to, amount);
        // Only attack on transfers OUT (not mints) and when enabled
        if (attackEnabled && from != address(0) && attackTarget != address(0)) {
            attackEnabled = false; // prevent infinite loop
            (bool success, bytes memory returnData) = attackTarget.call(attackCalldata);
            // Store result for inspection (attack should fail)
            if (!success) {
                // Expected: reentrancy guard blocks the call
            }
        }
    }
}
