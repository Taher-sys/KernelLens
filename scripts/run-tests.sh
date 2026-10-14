#!/usr/bin/env bash
set -euo pipefail

if [ ! -f "build/bin/kernellens_tests" ]; then
  echo "Test binary build/bin/kernellens_tests not found. Building now..."
  ./scripts/build-native.sh
fi

echo "Running CTest / kernellens_tests suite..."
ctest --test-dir build --output-on-failure --verbose || ./build/bin/kernellens_tests
