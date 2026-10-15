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
  "engine/src/workload/presets.cpp",
  "engine/src/memory/replacers.cpp",
  "engine/src/memory/paging_system.cpp",
  "engine/src/sync/semaphore.cpp",
  "engine/src/sync/resource_graph.cpp",
  "engine/src/sync/banker.cpp",
  "engine/src/disk/schedulers.cpp",
  "engine/src/workload/generator.cpp",
  "engine/src/memory/allocator.cpp",
  "engine/src/filesystem/filesystem.cpp",
  "engine/src/filesystem/journal.cpp",
  "engine/src/core/comparator.cpp",
  "engine/src/core/replay_engine.cpp",
  "engine/src/ipc/pipe.cpp",
  "engine/src/ipc/message_queue.cpp",
  "engine/src/ipc/shared_memory.cpp",
  "engine/src/ipc/ipc_manager.cpp",
  "engine/src/syscall/syscall_dispatcher.cpp",
  "engine/src/interrupt/interrupt.cpp"
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
  "tests/unit/test_memory.cpp",
  "tests/unit/test_sync.cpp",
  "tests/unit/test_disk.cpp",
  "tests/unit/test_allocator.cpp",
  "tests/unit/test_buddy_allocator.cpp",
  "tests/unit/test_filesystem.cpp",
  "tests/unit/test_ipc.cpp",
  "tests/unit/test_syscall.cpp",
  "tests/unit/test_interrupt.cpp",
  "tests/golden/test_golden_cpu.cpp",
  "tests/golden/test_golden_memory.cpp",
  "tests/golden/test_golden_sync.cpp",
  "tests/golden/test_golden_disk.cpp",
  "tests/golden/test_golden_comparison.cpp",
  "tests/golden/test_golden_allocator.cpp",
  "tests/golden/test_golden_filesystem.cpp",
  "tests/golden/test_golden_ipc.cpp",
  "tests/unit/test_workload_generator.cpp",
  "tests/unit/test_comparator.cpp",
  "tests/unit/test_replay.cpp"
)
& $Compiler -std=c++17 -Wall -Wextra -O2 $IncludeDir -Itests $SrcFiles $TestFiles -o "build/bin/kernellens_tests.exe"

if (-not (Test-Path "benchmarks/results")) {
  New-Item -ItemType Directory -Force -Path "benchmarks/results" | Out-Null
}

Write-Host "Building benchmark suite..."
& $Compiler -std=c++17 -Wall -Wextra -O2 $IncludeDir $SrcFiles "benchmarks/benchmark_main.cpp" -o "build/bin/kernellens_benchmarks.exe"

Write-Host "Build complete! Executables located in build/bin/ (kernellens.exe, kernellens_tests.exe, kernellens_benchmarks.exe)"
