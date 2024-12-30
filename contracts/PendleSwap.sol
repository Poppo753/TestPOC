// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPendleRouter {
    function swapExactTokenForToken(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address receiver,
        uint256 deadline
    ) external returns (uint256 actualOut);
}

contract PendleSwap {
    address public immutable pendleRouter;

    constructor(address _pendleRouter) {
        pendleRouter = _pendleRouter;
    }

    /**
     * @notice Esegue uno swap tra due token ERC20 utilizzando il router Pendle
     * @param tokenIn L'indirizzo del token in entrata
     * @param tokenOut L'indirizzo del token in uscita
     * @param amountIn L'importo del token da scambiare
     * @param minAmountOut L'importo minimo del token in uscita accettabile
     * @param receiver L'indirizzo che riceverà i token in uscita
     * @param deadline Il timestamp entro cui la transazione deve completarsi
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address receiver,
        uint256 deadline
    ) external {
        require(amountIn > 0, "AmountIn must be greater than zero");
        require(deadline >= block.timestamp, "Deadline expired");

        // Trasferire i token al contratto
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);

        // Approvare il router per spendere i token
        IERC20(tokenIn).approve(pendleRouter, amountIn);

        // Eseguire lo swap
        IPendleRouter(pendleRouter).swapExactTokenForToken(
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut,
            receiver,
            deadline
        );
    }
}
