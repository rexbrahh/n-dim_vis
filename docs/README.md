# ndvis — N‑Dimensional Object Visualizer

A fast, browser‑based visualizer for n‑dimensional objects (n≥3). Renders in a 3D scene with Blender/Google‑Earth–style camera, exports high‑quality assets, and scales to batch/cluster rendering.

## Feature highlights

- **Objects**: n‑cube (hypercube), n‑simplex, n‑orthoplex; hypersphere point clouds.
- **Rotation in ℝⁿ**: Batched **Givens** rotations with incremental updates + periodic QR.
- **Projection**: ℝⁿ → ℝ³ (interactive basis selection) → ℝ² (screen).
- **GPU‑centric**: C++→WASM math + **WebGPU** compute/render; **WebGL2** fallback.
- **Camera**: Orbit/arcball (pivot, dolly‑to‑cursor, fit), Free‑Fly (pointer‑lock WASD).
- **Export**: PNG/SVG in browser, MP4/PNG sequences via headless renderer in container.

## Tech stack (high level)

- **C++17/20** core ➜ **WebAssembly** via **Emscripten**, SIMD + optional threads.
- **WebGPU** primary (WGSL); **WebGL2 (ES3)** fallback.
- **UI**: React + TypeScript (thin control layer).
- **Headless**: Native C++ WebGPU (Dawn or wgpu‑native) in Docker for exports.

## Quickstart

- Web build: see `BUILD-WEB.md`
- Headless export: see `BUILD-HEADLESS.md`
- API usage (JS/TS + WASM): see `API.md`
- Camera controls: see `CAMERA.md`
