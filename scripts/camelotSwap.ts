import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

// Environment configurations
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const RPC_URL = process.env.ARBITRUM_RPC_URL || "";

// Addresses
const CAMELOT_ROUTER = "0x1F721E2E82F6676FCE4eA07A5958cF098D339e18";  // Camelot V3 Router
const WETH_ADDRESS = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";    // WETH on Arbitrum
const TOKEN_B_ADDRESS = "0x0fBcbaEA96Ce0cF7Ee00A8c19c3ab6f5Dc8E1921";  // Example token B address

// Router ABI for Camelot V3
const camelotRouterAbi = [
    "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 limitSqrtPrice)) external payable returns (uint256 amountOut)",
    "function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 limitSqrtPrice) external view returns (uint256 amountOut)"
];

// Configuration parameters
const ETH_AMOUNT_TO_SWAP = ethers.parseEther("0.00001"); // Amount of ETH to swap
const SLIPPAGE_TOLERANCE = 0.03; // 3% slippage tolerance
const RECIPIENT = "0x8390e98483a9b39265428c8610371134B5d11C3F"; // Wallet receiving Token B
const DEADLINE = Math.floor(Date.now() / 1000) + 60 * 5; // 5-minute deadline
const DEFAULT_FEE_TIER = 5; // Fee tier for the pool (0.05%)

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log("Wallet address:", wallet.address);

    // Check ETH balance
    const balance = await provider.getBalance(wallet.address);
    console.log("ETH Balance:", ethers.formatEther(balance));

    if (balance < ETH_AMOUNT_TO_SWAP) {
        throw new Error("Insufficient ETH balance");
    }

    const camelotRouter = new ethers.Contract(CAMELOT_ROUTER, camelotRouterAbi, wallet);

    try {
        // Get a quote for the swap
        console.log("Fetching swap quote...");
        const quote = await camelotRouter.quoteExactInputSingle(
            WETH_ADDRESS,
            TOKEN_B_ADDRESS,
            DEFAULT_FEE_TIER,
            ETH_AMOUNT_TO_SWAP,
            0 // No price limit
        );

        const amountOutMin = BigInt(quote) - (BigInt(quote) * BigInt(Math.floor(SLIPPAGE_TOLERANCE * 1000)) / 1000n);

        console.log("Expected output amount:", ethers.formatEther(quote));
        console.log("Minimum output amount (after slippage):", ethers.formatEther(amountOutMin));

        // Wrap ETH to WETH
        const wethContract = new ethers.Contract(WETH_ADDRESS, [
            "function deposit() payable",
            "function approve(address spender, uint256 amount) external returns (bool)"
        ], wallet);

        console.log("Wrapping ETH to WETH...");
        await wethContract.deposit({ value: ETH_AMOUNT_TO_SWAP });
        console.log("ETH successfully wrapped to WETH");

        // Approve the router to spend WETH
        console.log("Approving router to spend WETH...");
        await wethContract.approve(CAMELOT_ROUTER, ethers.MaxUint256);
        console.log("Router approved");

        // Prepare swap parameters
        const params = {
            tokenIn: WETH_ADDRESS,
            tokenOut: TOKEN_B_ADDRESS,
            fee: DEFAULT_FEE_TIER,
            recipient: RECIPIENT,
            deadline: DEADLINE,
            amountIn: ETH_AMOUNT_TO_SWAP,
            amountOutMinimum: amountOutMin,
            sqrtPriceLimitX96: 0 // No price limit
        };

        console.log("Swap Parameters:", params);

        // Estimate gas limit
        let gasLimit;
        try {
            gasLimit = await provider.estimateGas({
                to: CAMELOT_ROUTER,
                data: camelotRouter.interface.encodeFunctionData("exactInputSingle", [params]),
                value: ETH_AMOUNT_TO_SWAP
            });
        } catch (error) {
            console.error("Gas estimation failed. Falling back to default gas limit.", error);
            gasLimit = BigInt(3000000); // Fallback gas limit
        }

        console.log("Gas limit set to:", gasLimit.toString());

        // Execute the swap
        console.log("Executing the swap...");
        const tx = await camelotRouter.exactInputSingle(
            params,
            {
                value: ETH_AMOUNT_TO_SWAP,
                gasLimit
            }
        );

        console.log("Transaction hash:", tx.hash);
        const receipt = await tx.wait();
        console.log("Transaction confirmed:", receipt);

    } catch (error) {
        console.error("Error during the swap process:", error);
        throw error;
    }
}

main().catch((error) => {
    console.error("Script execution failed:", error);
    process.exit(1);
});
