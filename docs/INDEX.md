# ndvis — N‑Dimensional Object Visualizer (Web)

This documentation set covers:

- **README.md** — Project overview and quickstart
- **ARCHITECTURE.md** — Modules, data flow, runtime matrix
- **BUILD-WEB.md** — Web build (C++→WASM with Emscripten, WebGPU/WebGL2, React/TS)
- **BUILD-HEADLESS.md** — Native headless renderer for exports (Dawn/wgpu-native, Docker)
- **API.md** — C ABI exported from WASM + TypeScript JS interface
- **MATH.md** — Geometry, Givens rotations, projection bases, normalization
- **SHADERS.md** — WGSL (WebGPU) + GLSL ES (WebGL2) shader specs
- **CAMERA.md** — Orbit/arcball + free‑fly UX and event mapping
- **PERFORMANCE.md** — SoA layout, SIMD/threads, LOD, profiling
- **EXPORTS.md** — PNG/SVG/MP4 export (browser + headless), job JSON schema
- **DEPLOYMENT.md** — COOP/COEP headers, CDN, feature detection, fallback rules
- **CONTRIBUTING.md** — Code style, testing, CI, review
- **TROUBLESHOOTING.md** — Common issues and fixes
- **ROADMAP.md** — Near‑term and later milestones
