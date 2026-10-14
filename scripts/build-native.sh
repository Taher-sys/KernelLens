#!/usr/bin/env bash
set -euo pipefail

echo "Configuring and building KernelLens with CMake..."
mkdir -p build
cmake -B build -S . -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release -j$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

echo "Build complete! Artifacts located in build/bin/"
