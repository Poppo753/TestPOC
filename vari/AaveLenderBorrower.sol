// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IPool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external;
}

contract AaveLenderBorrower {
    address public poolAddress = 0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff; // Indirizzo del Pool

    function depositAndBorrow(
        address usdcToken,
        address ethToken,
        uint256 usdcAmount,
        uint256 ethBorrowAmount
    ) external {
        // Instanzia il contratto Pool
        IPool pool = IPool(poolAddress);

        // Approva il Pool per usare i tuoi USDC
        IERC20(usdcToken).approve(poolAddress, usdcAmount);

        // Deposita USDC
        pool.supply(usdcToken, usdcAmount, address(this), 0);

        // Prendi in prestito ETH
        pool.borrow(ethToken, ethBorrowAmount, 2, 0, address(this)); // 2 = Tasso variabile
    }
}
