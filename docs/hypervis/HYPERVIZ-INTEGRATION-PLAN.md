# HyperViz Integration Execution Plan

## Environment & Tooling
- Pin toolchain versions (emsdk, CMake ≥3.22, Node 18) in `docs/BUILD-web.md` and include a `.tool-versions`/`.nvmrc` pair plus `CMakePresets.json`.
- Extend CI matrix (Linux/macOS) to build native (`cmake -S ndvis-core -B ndvis-core/build`), build WASM (`emcmake cmake -S ndvis-core -B ndvis-core/build-wasm`), run `ctest`, `npm run lint`, and Vitest once added.

## Repository Layout Updates
- Introduce `ndcalc-core/` with `CMakeLists.txt`, public headers under `include/ndcalc`, source in `src/`, and tests in `tests/`.
- Refresh top-level `README.md` plus `docs/ARCHITECTURE.md` to document the new calculus module and adjust `.gitignore` for new build directories.

## Build System Adjustments
- Add a native static library target for `ndcalc-core` and optional `ndcalc-core-tests`.
- Update `docs/example-emscripten-build.sh` to emit WASM artifacts for both `ndvis-core` and `ndcalc-core`, generating modular ES6 loaders in `ndvis-web/src/wasm/`.
- Produce TypeScript declaration files (`ndvis-wasm.d.ts`, `ndcalc-wasm.d.ts`) during the build for editor support.

## ndvis-core Enhancements
- Implement hyperplane slicing helpers in new `include/ndvis/hyperplane.hpp` and `src/hyperplane.cpp`, supporting SoA inputs and stitched polylines.
- Add level-set utilities for scalar fields along edges (linear interpolation plus refinement) and expose both features via the C API (`ndvis_slice_hyperplane`, `ndvis_level_set_on_edges`).
- Surface QR sweep cadence controls to help UI manage re-orthonormalization frequency.

## ndvis-core Testing
- Extend `tests/core_tests.cpp` to cover hyperplane slicing on cubes, misaligned planes, and scalar level sets.
- Add long-run rotation + QR drift tests using repeated plane updates.

## ndcalc-core Expression VM
- Define bytecode (const pool + opcodes) with parser (Pratt or shunting-yard) supporting trig/exp/log, power, unary minus, and variables `x1..xn`.
- Implement interpreter handling batched evaluation (AoS + SoA adapters).
- Provide forward-mode AD for gradients/Hessians up to configured `n` threshold, falling back to central differences otherwise.
- Expose C ABI (`include/ndcalc/api.h`) for init/free, compile, evaluate, gradient, Hessian, directional derivative, and error codes.

## ndcalc-core Testing
- Create unit tests for parser precedence, error handling, transcendental functions, gradient agreement with finite differences, Hessian symmetry, and directional derivatives.
- Add stress testing for random expressions to guard against stack overflow and performance regressions.

## WASM Integration
- Build consolidated loader `ndvis-web/src/wasm/hyperviz.ts` that lazy-loads both WASM modules, handles `_malloc/_free`, and wraps geometry, slicing, and calculus functions with pooled heap allocations and descriptive errors.
- Add Vitest suites (`ndvis-web/src/__tests__/hyperviz.spec.ts`) instantiating WASM in Node to verify expression compilation, gradients, Hessians, and hyperplane slices.

## GPU Pipeline Implementation
- For WebGPU: add WGSL compute shaders (`rotate_givens.wgsl`, `project_to3.wgsl`, `slice_hyperplane.wgsl`) plus command encoding that handles staging, uniform setup, and instanced draw passes.
- For WebGL2 fallback: reuse WASM-projected positions via VAOs, implement slice overlays with dynamic buffers, and provide thickness shaders to match WebGPU visuals.

## Renderer Abstraction
- Update `ndvis-web/src/gpu/renderer.ts` to return mode-specific renderers with `prepareFrame`, `render`, and `dispose`; move canvas lifecycle into `SceneViewport` and manage SharedArrayBuffer usage behind COOP/COEP checks.
- Implement zero-copy SoA uploads using pinned heap segments when SAB is available, otherwise perform minimal copies.

## State Management & UI
- Expand Zustand store (`src/state/appState.ts`) to track geometry buffers, hyperplane parameters, field programs, probe points, calculus results, level-set value, and export settings with async actions for recomputation.
- Build UI panels (`HyperplanePanel.tsx`, `FunctionPanel.tsx`, `CalculusPanel.tsx`, `ExportPanel.tsx`) mirroring `HYPERVIZ-UX.md` specifics.
- Enhance `SceneViewport.tsx` to render geometry, slice polylines, level sets, gradient arrows, and tangent plane meshes.

## Interaction & UX Hooks
- Implement plane-picker controls for Givens rotations, level-set animation sliders, and camera shortcuts (Orbit/Free-fly toggle, fit-to-object, pivot under cursor) in the UI layer.
- Ensure UI triggers recompute actions without blocking using microtask scheduling or Web Workers where necessary.

## Export & Headless Parity
- Extend `ndvis-render-headless` to integrate both core libraries, accept JSON jobs (geometry, hyperplane, function, camera animation), and output deterministic PNG/SVG/MP4 assets via wgpu-native.
- Provide CLI tooling and document usage in the hypervis docs bundle.

## Performance & Diagnostics
- Add an on-screen diagnostics overlay with FPS, GPU mode, WASM timings, QR sweep cadence, and AD mode indicators.
- Implement LOD thresholds and edge sampling rules based on profiling; persist user-tuned settings.
- Build automation (Node scripts) capturing performance metrics and storing JSON snapshots for regression tracking.

## Documentation Refresh
- Update hypervis docs with concrete file paths, build commands, WASM requirements, and troubleshooting guidance for WebGPU/COOP-COEP.
- Replace `ndvis-web/README.md` template with HyperViz-specific setup, usage, and demo instructions.

## Demo & Validation
- Script a reproducible demo sequence (build → run → showcase geometry, hyperplane slicing, level-set animation, calculus probes, exports) and capture expected assets under `docs/hypervis/examples/`.
- Ensure final validation includes native tests, WASM tests, linting, and manual WebGPU/WebGL smoke checks before release.

## Risk Mitigation
- Guarantee WebGL2 fallback gracefully handles all features even if slower, with clear UI messaging.
- Cap expression size and enforce runtime guards against division by zero or invalid operations, returning descriptive errors.
- Monitor WASM heap usage through `hv_init` capacity checks and alert users when limits are approached.
