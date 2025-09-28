# Integration Plan — WebGPU + WASM + WebGL

- **Foundation**: Lock the success metrics—browser MVP with hypercube/simplex/orthoplex, interactive rotations, 120 FPS target on M1/M2 for n-cube up to 6—so every downstream trade-off stays scoped (docs/original.md:9-26, docs/original.md:17).
- **Phase 0 / Tooling Prep**
  - Install/activate emsdk, Node 18+, and CMake 3.22+ in dev shells; document reproducible env bootstrap (docs/BUILD-web.md:5-8).
  - Sketch repo layout (`ndvis-core`, `ndvis-web`, `ndvis-render-headless`, docs) to avoid churn when wiring build outputs and shared headers (docs/ARCHITECTURE.md:5).
  - Capture reference build command (`example-emscripten-build.sh`) as a baseline CI script, noting SIMD/thread flags and COOP/COEP implications (docs/example-emscripten-build.sh:2-14).
- **Phase 1 / C++ Core → WASM**
  - Implement SoA geometry kernels (hypercube, rotations, projection, QR, PCA) behind a static lib per sample CMakeLists, ensuring headers export deterministic C ABI entry points (docs/BUILD-web.md:12-31, docs/original.md:114-188).
  - Define buffer ownership rules (`malloc`/`free` exposure, alignment for SIMD, growth strategy) and ship minimal binding layer that exposes initialization, per-frame update hooks, and error propagation (docs/example-emscripten-build.sh:12-13, docs/original.md:270-273).
  - Add regression/unit tests (CPU) for math primitives before compiling to WASM to keep WebGPU debugging limited to GPU-specific issues (docs/original.md:147-153).
- **Phase 2 / WASM Packaging & Loader**
  - Configure `emcmake`/`emcc` build to emit ES6 modularized loader consumed by Vite; verify SIMD + optional pthreads gating behind COOP/COEP-ready headers (docs/example-emscripten-build.sh:6-14, docs/original.md:293).
  - Wrap exports in TypeScript definitions describing buffer schemas (SoA arrays, basis matrices, plane lists) and lifecycle functions (docs/original.md:114-188, docs/original.md:270-273).
  - Establish initialization flow: async WASM loader resolves before R3F scene mounts; fall back gracefully with user messaging if WASM instantiation fails (docs/original.md:262-267).
- **Phase 3 / WebGPU Primary Path**
  - Implement capability detection and device request pipeline, factoring in fallback logic (WebGPU → WebGL2 → Canvas2D) per runtime matrix (docs/original.md:259-283).
  - Design WGSL compute passes: `rotate_givens`, `project_to3`, optional `color_map` and LOD thinning; structure uniform/storage buffers to match WASM SoA layout for zero-copy staging (docs/original.md:270-273).
  - Build render pipeline for instanced vertices/edges with camera uniform block fed from JS camera controller; ensure per-frame command encoding stays off the main UI thread when SharedArrayBuffer is available (docs/original.md:78-91, docs/original.md:277-279).
- **Phase 4 / WebGL2 Fallback**
  - Mirror buffer descriptors in GLSL ES shaders; implement instanced point/line rendering with shader-based wide lines to approximate WebGPU visual fidelity (docs/original.md:262, docs/original.md:280-283).
  - Reuse WASM-projected positions if compute shaders unavailable; gate advanced features (thick lines, fancy color maps) behind capability checks to preserve performance (docs/original.md:136-144).
  - Integrate fallback selection into UI state so users can override or inspect detected mode for debugging (docs/original.md:262-267).
- **Phase 5 / React UI & Camera Integration**
  - Wire Zustand stores for dimension slider, plane picker, basis presets, rotation playback; ensure state transitions send commands to WASM buffers and enqueue GPU work rather than mutating JS arrays (docs/original.md:100-110, docs/original.md:114-188).
  - Stand up R3F scene with orbit and free-fly controls, fit-to-object, dolly-to-cursor, and pivot raycast, translating camera matrices into uniforms shared with GPU pipelines (docs/original.md:78-111, docs/original.md:175-213).
  - Provide exports (SVG/PNG) by capturing GPU outputs and 2D overlays, aligning with MVP deliverables (docs/original.md:155-160, docs/original.md:25).
- **Phase 6 / Performance & QA**
  - Profile GPU and WASM stages to ensure rotation/projection offloaded, re-orthonormalize bases periodically (QR) to avoid numeric drift, and enforce edge-count LOD caps for high n (docs/original.md:92-97, docs/original.md:147-153).
  - Add automated perf harness (simulated UI scripts) to verify FPS budget and memory usage across WebGPU/WebGL paths.
  - Document SharedArrayBuffer and threading requirements (headers, worker setup) and provide troubleshooting guidance for browser feature gaps (docs/original.md:291-295, docs/original.md:224-233).
- **Phase 7 / Extensions & Exports**
  - Plan headless `ndvis-render-headless` milestones (wgpu-native container, JSON job spec) once browser path stabilizes, keeping parity in math kernels (docs/original.md:285-304).
  - Queue "nice-to-have" explorations (CLI exporter, math mode, live scripting) for post-v1 once core integration proves stable (docs/original.md:233-238).
- **Open Questions**
  1. Confirm final SoA layout compatibility between WASM and WebGPU staging (packing, padding) to avoid redundant copies.
  2. Decide on threading rollout strategy (opt-in flag vs auto) given COOP/COEP deployment constraints.
  3. Clarify SVG export expectations when running in WebGL fallback—do we require compute path parity or accept reduced fidelity?

