param(
    [string]$Tag = "arbitrum-usdc-poc-1",
    [string]$OutputDirectory = "baseline-archives"
)

$ErrorActionPreference = "Stop"

# This script intentionally works from an immutable Git tag. It refuses to
# package an arbitrary dirty worktree, because such an archive could not be
# traced back to the deployment baseline during an incident.
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $repoRoot

$tagCommit = (git rev-parse "refs/tags/$Tag^{commit}" 2>$null)
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($tagCommit)) {
    throw "Tag '$Tag' does not exist. Create and verify the final tag first."
}

$criticalDiff = git diff --name-only $Tag -- contracts hardhat.config.ts package.json package-lock.json .npmrc
if ($criticalDiff) {
    throw "Critical files differ from tag '$Tag': $($criticalDiff -join ', ')"
}

$outputRoot = Join-Path $repoRoot $OutputDirectory
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null

$safeTag = $Tag -replace '[^A-Za-z0-9._-]', '_'
$sourceArchive = Join-Path $outputRoot "$safeTag-source.zip"
$artifactArchive = Join-Path $outputRoot "$safeTag-build-info.zip"
$checksumFile = Join-Path $outputRoot "$safeTag-SHA256SUMS.txt"
$metadataFile = Join-Path $outputRoot "$safeTag-METADATA.txt"

if (Test-Path $sourceArchive) { Remove-Item -LiteralPath $sourceArchive -Force }
if (Test-Path $artifactArchive) { Remove-Item -LiteralPath $artifactArchive -Force }

# git archive includes tracked files only. Consequently .env, node_modules,
# local automation state and ignored artifacts cannot leak into this bundle.
git archive --format=zip --output=$sourceArchive $Tag
if ($LASTEXITCODE -ne 0) { throw "git archive failed" }

# Build-info contains the compiler input/output needed for forensic comparison.
# The critical-file equality check above binds it to the same tagged sources.
npm run compile
if ($LASTEXITCODE -ne 0) { throw "Compilation failed" }
if (-not (Test-Path "artifacts\build-info\*.json")) {
    throw "No Hardhat build-info was produced"
}
Compress-Archive -Path "artifacts\build-info\*.json" -DestinationPath $artifactArchive -CompressionLevel Optimal

$sourceHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $sourceArchive).Hash.ToLowerInvariant()
$artifactHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $artifactArchive).Hash.ToLowerInvariant()
$manifestHash = (Get-FileHash -Algorithm SHA256 -LiteralPath "scripts\manifests\arbitrum-usdc-poc-1.json").Hash.ToLowerInvariant()
$lockHash = (Get-FileHash -Algorithm SHA256 -LiteralPath "package-lock.json").Hash.ToLowerInvariant()

@(
    "$sourceHash  $([IO.Path]::GetFileName($sourceArchive))"
    "$artifactHash  $([IO.Path]::GetFileName($artifactArchive))"
    "$manifestHash  scripts/manifests/arbitrum-usdc-poc-1.json"
    "$lockHash  package-lock.json"
) | Set-Content -LiteralPath $checksumFile -Encoding UTF8

@(
    "tag=$Tag"
    "commit=$tagCommit"
    "createdAtUtc=$([DateTime]::UtcNow.ToString('o'))"
    "historicalDeploymentCommit=8f53e98"
    "containsSecrets=false"
) | Set-Content -LiteralPath $metadataFile -Encoding UTF8

Write-Output "Baseline archive created in: $outputRoot"
Write-Output "Copy this directory to physically separate offline storage."
