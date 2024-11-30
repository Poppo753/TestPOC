// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IPool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

contract AaveSupplyBorrowSeparate {
    address public poolAddress = 0x794a61358D6845594F94dc1DB02A252b5b4814aD; // Indirizzo del contratto POOL
    address public usdcToken = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831; // Indirizzo USDC
    address public ethToken = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1; // Indirizzo WETH
    address public owner;
    
// Costruttore per inizializzare il proprietario
    constructor() {
        owner = msg.sender; // Imposta il proprietario del contratto
    }

    // Modificatore per limitare l'accesso al proprietario
    modifier onlyOwner() {
        require(msg.sender == owner, "Not the contract owner");
        _;
    }

    // Deposita USDC come collaterale
    function supply(uint256 usdcAmount) external {
        IPool pool = IPool(poolAddress);

        // Trasferisci USDC dal mittente al contratto
        require(IERC20(usdcToken).transferFrom(msg.sender, address(this), usdcAmount), "TransferFrom failed");

        // Approva il contratto POOL a spendere USDC
        require(IERC20(usdcToken).approve(poolAddress, usdcAmount), "Approval failed");

        // Deposita USDC
        pool.supply(usdcToken, usdcAmount, address(this), 0);
    }

    // Prendi in prestito ETH
    function borrow(uint256 ethBorrowAmount) external {
        IPool pool = IPool(poolAddress);

        // Prendi in prestito ETH
        pool.borrow(ethToken, ethBorrowAmount, 2, 0, msg.sender); // 2 = Tasso variabile
    }

    // Ritira il collaterale (solo proprietario)
    function withdrawCollateral(uint256 usdcAmount) external onlyOwner {
        IPool pool = IPool(poolAddress);

        // Ritira il collaterale
        uint256 withdrawn = pool.withdraw(usdcToken, usdcAmount, msg.sender);
        require(withdrawn > 0, "Withdraw failed");
    }

    // Ritira ETH preso in prestito (solo proprietario)
    function withdrawETH(uint256 ethAmount) external onlyOwner {
        payable(msg.sender).transfer(ethAmount);
    }

    // Consente di ricevere ETH nel contratto
    receive() external payable {}

}

