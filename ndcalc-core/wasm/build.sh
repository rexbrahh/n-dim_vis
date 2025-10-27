#!/bin/bash
set -e

# Build WASM module using Emscripten
echo "Building ndcalc WASM module..."

# Create build directory
mkdir -p build-wasm
cd build-wasm

# Configure with Emscripten
emcmake cmake .. -DNDCALC_BUILD_TESTS=OFF -DNDCALC_BUILD_WASM=ON

# Build
emmake make -j$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

# Copy outputs
mkdir -p ../dist
cp ndcalc_wasm.js ../dist/
cp ndcalc_wasm.wasm ../dist/

echo "WASM build complete! Outputs in dist/"
echo "Generating TypeScript declarations..."

# Generate TypeScript declarations
cd ..
node generate-types.js

echo "Build complete!"
