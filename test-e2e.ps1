# GMX V2 Plugin - E2E Test Runner

Write-Host "[TEST] GMX V2 Plugin - End-to-End Test" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (-Not (Test-Path ".env")) {
    Write-Host "[ERROR] .env file not found" -ForegroundColor Red
    Write-Host "Please create .env with ARBITRUM_RPC_URL" -ForegroundColor Yellow
    exit 1
}

# Load environment variables
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^#][^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
}

# Check if RPC URL is set
if (-Not $env:ARBITRUM_RPC_URL) {
    Write-Host "[ERROR] ARBITRUM_RPC_URL not set in .env" -ForegroundColor Red
    Write-Host "" 
    Write-Host "Add this to your .env file:" -ForegroundColor Yellow
    Write-Host "ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc" -ForegroundColor Gray
    Write-Host "or use a paid RPC like Alchemy/Infura for better reliability" -ForegroundColor Gray
    exit 1
}

Write-Host "[OK] Environment configured" -ForegroundColor Green
Write-Host "     RPC: $env:ARBITRUM_RPC_URL" -ForegroundColor Gray
Write-Host ""

# Enable forking
$env:FORK_ENABLED = "true"

Write-Host "[CONFIG] Test Configuration:" -ForegroundColor Cyan
Write-Host "   - Fork: Arbitrum Mainnet (Chain ID: 42161)" -ForegroundColor Gray
Write-Host "   - Block: Latest" -ForegroundColor Gray
Write-Host "   - Timeout: 10 minutes" -ForegroundColor Gray
Write-Host ""

Write-Host "[RUN] Running E2E test..." -ForegroundColor Cyan
Write-Host ""

# Run the test
npx hardhat test test/integration/GMXv2Plugin.e2e.test.ts --network hardhat

$exitCode = $LASTEXITCODE

Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "[PASSED] E2E Test PASSED!" -ForegroundColor Green
    Write-Host ""
    Write-Host "[RESULTS] Test Results:" -ForegroundColor Cyan
    Write-Host "   [OK] All components deployed successfully" -ForegroundColor Green
    Write-Host "   [OK] Token registration working" -ForegroundColor Green
    Write-Host "   [OK] Plugin authorization verified" -ForegroundColor Green
    Write-Host "   [OK] Buy flow structure validated" -ForegroundColor Green
    Write-Host "   [OK] Auto-detection mechanism confirmed" -ForegroundColor Green
    Write-Host "   [OK] Sell flow structure validated" -ForegroundColor Green
    Write-Host ""
    Write-Host "[SUCCESS] Your GMX V2 Plugin is ready for deployment!" -ForegroundColor Green
    Write-Host ""
    Write-Host "[NEXT] Next Steps:" -ForegroundColor Yellow
    Write-Host "   1. Deploy to Arbitrum testnet: npm run deploy:testnet" -ForegroundColor Gray
    Write-Host "   2. Test with real keeper execution" -ForegroundColor Gray
    Write-Host "   3. Add Chainlink feeds for GM tokens" -ForegroundColor Gray
    Write-Host "   4. Deploy to mainnet" -ForegroundColor Gray
} else {
    Write-Host "[FAILED] E2E Test FAILED!" -ForegroundColor Red
    Write-Host ""
    Write-Host "[DEBUG] Troubleshooting:" -ForegroundColor Yellow
    Write-Host "   1. Check if RPC URL is accessible" -ForegroundColor Gray
    Write-Host "   2. Verify you have sufficient RPC rate limits" -ForegroundColor Gray
    Write-Host "   3. Try using a paid RPC provider (Alchemy or Infura)" -ForegroundColor Gray
    Write-Host "   4. Check the error messages above" -ForegroundColor Gray
    Write-Host ""
    Write-Host "[HELP] Common Issues:" -ForegroundColor Yellow
    Write-Host "   - RPC rate limiting: Use paid RPC" -ForegroundColor Gray
    Write-Host "   - Network timeout: Increase hardhat timeout" -ForegroundColor Gray
    Write-Host "   - Compilation errors: Run npx hardhat compile first" -ForegroundColor Gray
}

Write-Host ""
exit $exitCode
