# PowerShell native build script for KernelLens
$ErrorActionPreference = "Stop"

$Compiler = "C:\msys64\ucrt64\bin\g++.exe"
if (-not (Test-Path $Compiler)) {
  $Compiler = (Get-Command g++ -ErrorAction SilentlyContinue).Source
}

Write-Host "Using C++ Compiler: $Compiler"

$IncludeDir = "-Iengine/include"
$SrcFiles = @(
  "engine/src/core/clock.cpp",
  "engine/src/core/event_log.cpp",
  "engine/src/core/metrics.cpp",
  "engine/src/core/engine.cpp",
  "engine/src/cpu/fcfs.cpp",
  "engine/src/cpu/sjf.cpp",
  "engine/src/cpu/srtf.cpp",
  "engine/src/cpu/priority.cpp",
  "engine/src/cpu/round_robin.cpp",
  "engine/src/cpu/mlfq.cpp",
  "engine/src/cpu/cfs_like.cpp",
  "engine/src/workload/presets.cpp"
)

if (-not (Test-Path "build/bin")) {
  New-Item -ItemType Directory -Force -Path "build/bin" | Out-Null
}

Write-Host "Building kernellens CLI..."
& $Compiler -std=c++17 -Wall -Wextra -O2 $IncludeDir $SrcFiles "engine/cli/main.cpp" -o "build/bin/kernellens.exe"

Write-Host "Building test suite..."
$TestFiles = @(
  "tests/test_main.cpp",
  "tests/unit/test_clock.cpp",
  "tests/unit/test_schedulers.cpp",
  "tests/unit/test_metrics.cpp",
  "tests/golden/test_golden_cpu.cpp"
)
& $Compiler -std=c++17 -Wall -Wextra -O2 $IncludeDir -Itests $SrcFiles $TestFiles -o "build/bin/kernellens_tests.exe"

Write-Host "Build complete! Executables located in build/bin/"
