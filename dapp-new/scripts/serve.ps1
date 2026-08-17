<#
.SYNOPSIS
Starts a local static server for the Jethos website.

.DESCRIPTION
Run this script from any directory. It resolves dapp-new relative to the script,
does not modify files and binds only to localhost by default. Press Ctrl+C to
stop. Use -Port when 8000 is already occupied.

.EXAMPLE
powershell -ExecutionPolicy Bypass -File scripts/serve.ps1 -Port 8000
#>
param(
  [ValidateRange(1024, 65535)]
  [int]$Port = 8000
)

$siteRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Write-Host "Serving Jethos from $siteRoot"
Write-Host "Open http://127.0.0.1:$Port/"
python -m http.server $Port --bind 127.0.0.1 --directory $siteRoot

