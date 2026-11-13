$ErrorActionPreference = "Stop"

$contractsRoot = $PSScriptRoot
foreach ($contract in @("demo-nft", "carry-vault")) {
    $contractDirectory = Join-Path $contractsRoot $contract
    Push-Location $contractDirectory
    try {
        cargo near build non-reproducible-wasm
        if ($LASTEXITCODE -ne 0) {
            throw "cargo near build failed for $contract (exit code $LASTEXITCODE)."
        }
    }
    finally {
        Pop-Location
    }

    $artifactDirectory = Join-Path $contractDirectory "target/near"
    $wasm = Get-ChildItem -LiteralPath $artifactDirectory -Filter "*.wasm" -File |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if (-not $wasm) {
        throw "No Wasm artifact found in $artifactDirectory."
    }
    Write-Output "$contract Wasm: $($wasm.FullName)"
}
