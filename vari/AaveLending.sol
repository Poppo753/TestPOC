// SPDX-License-Identifier: MIT
/*pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IPool {
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;
}

contract AaveLending is Ownable {
    IERC20 public usdc;
    IPool public aavePool;

    constructor(address _usdc, address _aavePool, address initialOwner) Ownable(initialOwner) {
        usdc = IERC20(_usdc);
        aavePool = IPool(_aavePool);
    }

    // Funzione per depositare USDC su Aave
    function deposit(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");

        // Trasferisci USDC al contratto
        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        require(success, "USDC transfer failed");

        // Approva Aave a spendere USDC
        usdc.approve(address(aavePool), amount);

        // Deposita gli USDC in Aave
        aavePool.supply(address(usdc), amount, address(this), 0);
    }

    // Funzione per prelevare i fondi (puoi personalizzarla)
    function withdraw(address to, uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        require(usdc.balanceOf(address(this)) >= amount, "Insufficient balance");

        // Trasferisci USDC all'utente
        usdc.transfer(to, amount);
    }
}*/
