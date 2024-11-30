// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

interface IOdosRouter {
    function swap(
        address inputToken,
        address outputToken,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        bytes calldata data
    ) external payable;
}

contract ETHToTokenSwap {
    // Indirizzo del router di Odos Finance sulla mainnet di Arbitrum
    address public constant ODOS_ROUTER = 0xa669e7A0d4b3e4Fa48af2dE86BD4CD7126Be4e13;
    
    // Token che si vuole ottenere dallo swap
    address public constant OUTPUT_TOKEN = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;

    // Referral code per tracciare le transazioni
    bytes32 public constant REFERRAL_CODE = "82178";

    // Evento per tracciare le transazioni di swap eseguite
    event SwapExecuted(address indexed user, uint256 amountIn, uint256 amountOut);

    /**
     * @dev Riceve ETH, effettua lo swap tramite Odos Finance e invia i token risultanti al mittente.
     */
    function depositAndSwap() external payable {
        require(msg.value > 0, "Deposit amount must be greater than 0");

        // Configura i dati personalizzati per il router: referral code e slippage massimo (0,5%)
        bytes memory data = abi.encode(REFERRAL_CODE, 50); // 50 basis points = 0.5%

        // Chiama il router Odos per eseguire lo swap
        IOdosRouter(ODOS_ROUTER).swap{value: msg.value}(
            address(0),    // ETH come token in ingresso
            OUTPUT_TOKEN,  // Token desiderato come output
            msg.value,     // Importo totale di ETH inviato
            0,             // MinAmountOut gestito dal router tramite lo slippage
            msg.sender,    // Mittente riceverà direttamente i token
            data           // Dati personalizzati (referral e slippage)
        );

        emit SwapExecuted(msg.sender, msg.value, 0); // L'`amountOut` non è calcolabile on-chain
    }

    /**
     * @dev Funzione per ricevere ETH direttamente senza restrizioni.
     */
    receive() external payable {}
}
