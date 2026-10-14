# PowerShell test execution script for KernelLens
$ErrorActionPreference = "Stop"

$TestExe = "build/bin/kernellens_tests.exe"
if (-not (Test-Path $TestExe)) {
  Write-Host "Test executable not found at $TestExe. Building native suite first..."
  & powershell -ExecutionPolicy Bypass -File scripts/build-native.ps1
}

Write-Host "Executing KernelLens automated test suite ($TestExe)..."
& $TestExe

if ($LASTEXITCODE -ne 0) {
  Write-Error "Test suite failed with exit code $LASTEXITCODE"
  exit $LASTEXITCODE
}

Write-Host "All automated tests executed successfully!"
