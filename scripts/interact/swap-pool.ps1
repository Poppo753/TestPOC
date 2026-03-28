# 🔄 Quick Swap Helper Script
# PowerShell script per eseguire swap velocemente dal pool

param(
    [Parameter(Mandatory=$false)]
    [string]$Preset = "",
    
    [Parameter(Mandatory=$false)]
    [string]$From = "",
    
    [Parameter(Mandatory=$false)]
    [string]$To = "",
    
    [Parameter(Mandatory=$false)]
    [int]$Percentage = 0,
    
    [Parameter(Mandatory=$false)]
    [int]$Slippage = 300
)

# Colors
$ColorReset = "`e[0m"
$ColorGreen = "`e[32m"
$ColorYellow = "`e[33m"
$ColorBlue = "`e[34m"
$ColorRed = "`e[31m"
$ColorBright = "`e[1m"

function Write-Header {
    param([string]$Title)
    Write-Host ""
    Write-Host ("=" * 60)
    Write-Host "  $ColorBright$Title$ColorReset"
    Write-Host ("=" * 60)
    Write-Host ""
}

function Write-Success {
    param([string]$Message)
    Write-Host "$ColorGreen✅ $Message$ColorReset"
}

function Write-Error {
    param([string]$Message)
    Write-Host "$ColorRed❌ $Message$ColorReset"
}

function Write-Info {
    param([string]$Message)
    Write-Host "$ColorBlue$Message$ColorReset"
}

function Write-Warning {
    param([string]$Message)
    Write-Host "$ColorYellow⚠️  $Message$ColorReset"
}

# Preset definitions
$Presets = @{
    "1" = @{
        Name = "50% WETH → USDC"
        From = "WETH"
        To = "USDC"
        Percentage = 50
        Slippage = 300
    }
    "2" = @{
        Name = "50% USDC → WETH"
        From = "USDC"
        To = "WETH"
        Percentage = 50
        Slippage = 300
    }
    "3" = @{
        Name = "25% WETH → USDC (conservative)"
        From = "WETH"
        To = "USDC"
        Percentage = 25
        Slippage = 200
    }
    "4" = @{
        Name = "75% USDC → WETH (aggressive)"
        From = "USDC"
        To = "WETH"
        Percentage = 75
        Slippage = 500
    }
    "5" = @{
        Name = "50% WETH → WBTC"
        From = "WETH"
        To = "WBTC"
        Percentage = 50
        Slippage = 300
    }
    "6" = @{
        Name = "50% WBTC → WETH"
        From = "WBTC"
        To = "WETH"
        Percentage = 50
        Slippage = 300
    }
    "7" = @{
        Name = "30% USDC → WBTC"
        From = "USDC"
        To = "WBTC"
        Percentage = 30
        Slippage = 500
    }
    "8" = @{
        Name = "30% WBTC → USDC"
        From = "WBTC"
        To = "USDC"
        Percentage = 30
        Slippage = 500
    }
}

Write-Header "🔄 QUICK SWAP - Pool Token Swapper"

# If no parameters, show menu
if (-not $Preset -and -not $From) {
    Write-Info "Available swap presets:"
    Write-Host ""
    
    foreach ($key in ($Presets.Keys | Sort-Object)) {
        $preset = $Presets[$key]
        Write-Host "  $ColorBright[$key]$ColorReset $($preset.Name)"
        Write-Host "      $($preset.From) → $($preset.To) | $($preset.Percentage)% | Slippage: $($preset.Slippage / 100)%"
        Write-Host ""
    }
    
    Write-Host ""
    Write-Host "USAGE:"
    Write-Host "  .\swap-pool.ps1 -Preset 1                    # Use preset"
    Write-Host "  .\swap-pool.ps1 -From WETH -To USDC -Percentage 30   # Custom"
    Write-Host ""
    exit 0
}

# Execute swap
$swapConfig = $null

if ($Preset) {
    # Use preset
    if ($Presets.ContainsKey($Preset)) {
        $swapConfig = $Presets[$Preset]
        Write-Header "EXECUTING: $($swapConfig.Name)"
    } else {
        Write-Error "Invalid preset: $Preset"
        exit 1
    }
} else {
    # Custom swap
    if (-not $From -or -not $To -or $Percentage -eq 0) {
        Write-Error "Custom swap requires: -From, -To, and -Percentage"
        Write-Host ""
        Write-Host "Example:"
        Write-Host "  .\swap-pool.ps1 -From WETH -To USDC -Percentage 30 -Slippage 300"
        exit 1
    }
    
    $swapConfig = @{
        Name = "Custom: $From → $To"
        From = $From
        To = $To
        Percentage = $Percentage
        Slippage = $Slippage
    }
    
    Write-Header "EXECUTING: $($swapConfig.Name)"
}

# Display config
Write-Info "Configuration:"
Write-Host "  From: $($swapConfig.From)"
Write-Host "  To: $($swapConfig.To)"
Write-Host "  Amount: $($swapConfig.Percentage)% of pool balance"
Write-Host "  Slippage: $($swapConfig.Slippage / 100)%"
Write-Host "  Deadline: 20 minutes"
Write-Host ""

# Confirmation
Write-Warning "This will execute a swap on Arbitrum mainnet!"
Write-Host "Press Ctrl+C to cancel, or any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Set environment variables
$env:SWAP_TOKEN_FROM = $swapConfig.From
$env:SWAP_TOKEN_TO = $swapConfig.To
$env:SWAP_PERCENTAGE = $swapConfig.Percentage
$env:SWAP_SLIPPAGE = $swapConfig.Slippage

# Execute
Write-Host ""
Write-Info "🚀 Launching swap script..."
Write-Host ""

try {
    $result = npx hardhat run scripts/interact/SwapPoolTokens.ts --network arbitrum
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Success "Swap completed successfully!"
    } else {
        Write-Host ""
        Write-Error "Swap failed with exit code: $LASTEXITCODE"
        exit $LASTEXITCODE
    }
} catch {
    Write-Host ""
    Write-Error "Swap failed: $_"
    exit 1
}
