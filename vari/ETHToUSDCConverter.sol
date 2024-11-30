
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

interface IOdosRouterV2 {
    struct swapTokenInfo {
        address inputToken;
        uint256 inputAmount;
        address inputReceiver;
        address outputToken;
        uint256 outputQuote;
        uint256 outputMin;
        address outputReceiver;
    }

    function swap(
        swapTokenInfo memory tokenInfo,
        bytes calldata pathDefinition,
        address executor,
        uint32 referralCode
    ) external payable returns (uint256 amountOut);
}

contract ETHToUSDCConverter {
    address public constant ODOS_ROUTER = 0xa669e7A0d4b3e4Fa48af2dE86BD4CD7126Be4e13;
    address public constant USDC_TOKEN = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    uint32 public constant REFERRAL_CODE = 82178;
    uint256 public constant MAX_SLIPPAGE = 50; // 0.5% in basis points (divide by 10,000)

    event ConvertedETHToUSDC(address indexed user, uint256 ethAmount, uint256 usdcAmount);

    /**
     * @dev Riceve ETH, li converte in USDC usando Odos V2 Router, e invia i token all'utente.
     */
    function convertETHToUSDC(bytes calldata pathDefinition, address executor, uint256 quoteUSDC) external payable {
        require(msg.value > 0, "No ETH sent");

        // Calcola l'importo minimo di USDC accettabile basato sullo slippage massimo
        uint256 minUSDC = (quoteUSDC * (10_000 - MAX_SLIPPAGE)) / 10_000;

        // Configura le informazioni di swap
        IOdosRouterV2.swapTokenInfo memory tokenInfo = IOdosRouterV2.swapTokenInfo({
            inputToken: address(0), // ETH
            inputAmount: msg.value,
            inputReceiver: executor,
            outputToken: USDC_TOKEN,
            outputQuote: quoteUSDC,
            outputMin: minUSDC,
            outputReceiver: msg.sender
        });

        // Chiama il router Odos V2 per effettuare lo swap
        uint256 usdcReceived = IOdosRouterV2(ODOS_ROUTER).swap{value: msg.value}(
            tokenInfo,
            pathDefinition,
            executor,
            REFERRAL_CODE
        );

        emit ConvertedETHToUSDC(msg.sender, msg.value, usdcReceived);
    }

    /**
     * @dev Fallback per impedire trasferimenti diretti di ETH senza passare dalla funzione principale.
     */
    receive() external payable {
        revert("Use convertETHToUSDC to convert ETH");
    }
}
