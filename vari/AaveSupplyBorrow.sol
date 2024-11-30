// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

interface IPool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external;
}

contract AaveSupplyBorrow {
    address public poolAddress = 0x794a61358D6845594F94dc1DB02A252b5b4814aD; // Indirizzo del contratto POOL
    address public usdcToken = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831; // Indirizzo USDC

    // Funzione principale per supply e borrow
    function supplyAndBorrow(uint256 usdcAmount, uint256 ethBorrowAmount) external {
        IPool pool = IPool(poolAddress);

        // Trasferisci USDC dal mittente al contratto
        IERC20(usdcToken).transferFrom(msg.sender, address(this), usdcAmount);

        // Deposita USDC
        pool.supply(usdcToken, usdcAmount, address(this), 0);

        // Prendi in prestito ETH
        pool.borrow(0x82aF49447D8a07e3bd95BD0d56f35241523fBab1, ethBorrowAmount, 2, 0, address(this)); // 2 = Tasso variabile
    }
}
