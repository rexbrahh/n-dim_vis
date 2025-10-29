# Build — Web (C++→WASM + WebGPU/WebGL2 + React/TS)

## Prereqs

- Node.js 18+, pnpm or npm
- CMake 3.22+
- Emscripten SDK (emsdk) latest (activate in your shell)
- (Optional) Python 3 for small scripts

## 1) Build C++ core to WASM with Emscripten

Run `docs/example-emscripten-build.sh` from the repo root once emsdk is active. It wires `ndcalc-core` into the wasm archive and exports `_ndvis_compute_overlays`, `_ndvis_compute_pca_with_values`, `_ndvis_generate_hypercube`, plus `_malloc/_free`. SIMD is enabled with `-msimd128` (no extra `-sWASM_SIMD` flag needed on current Emscripten). The script places `ndvis-wasm.js/wasm` and `ndcalc_wasm.js/wasm` under `ndvis-web/public/wasm/`, so both the main thread and spawned workers fetch identical artifacts.

For the multi-thread build to run in the browser you must serve the UI from a cross-origin-isolated context (COOP/COEP). The dev server already injects the proper headers (see `vite.config.ts`); restart `npm run dev` after rebuilding the wasm bundle so the headers take effect.

> Note: If you rebuilt the wasm bundle before this change, rerun the script so the additional runtime helpers (`stringToUTF8`, `lengthBytesUTF8`) are exported—without them expression validation will fail with `this.module.lengthBytesUTF8 is not a function` in the console.

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
