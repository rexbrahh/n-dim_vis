# Build — Web (C++→WASM + WebGPU/WebGL2 + React/TS)

## Prereqs

- Node.js 18+, pnpm or npm
- CMake 3.22+
- Emscripten SDK (emsdk) latest (activate in your shell)
- (Optional) Python 3 for small scripts

## 1) Build C++ core to WASM with Emscripten

### Example CMakeLists.txt (ndvis-core)

```cmake
cmake_minimum_required(VERSION 3.22)
project(ndvis-core LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(ndvis-core STATIC
  src/hypercube.cpp
  src/rotations.cpp
  src/projection.cpp
  src/qr.cpp
  src/pca.cpp
  src/edges.cpp
)

target_include_directories(ndvis-core PUBLIC include)
```
