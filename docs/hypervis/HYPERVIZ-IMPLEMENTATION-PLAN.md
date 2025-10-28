# HyperViz — Implementation Plan (Phases & Milestones)

## Phase 0 — Tooling & repo shape (1–2d)
- Bootstrap dev shells for Emscripten, CMake, Node; pin versions.
- Confirm repo layout and CI artifacts (WASM + TS types).

**Deliverables:** reproducible builds; CI baseline; Vite scaffold.

## Phase 1 — Core geometry & render (3–4d)
- C++ SoA generators for cube/simplex/orthoplex; edges via bit‑tricks (Hamming distance 1).
- React + R3F scene with orbit/free‑fly camera, instanced lines/points; LOD caps by edge budget.
- Basis3 plumbing and standard/random ONB presets.

**Proof:** interactive n‑cube up to n=8 with 60–120 FPS; export PNG/SVG.

## Phase 2 — Rotations & projection compute (2–3d)
- Givens rotations in CPU WASM; optional WebGPU compute (`rotate_givens` + `project_to3`).
- Periodic QR re‑orthonormalization to avoid drift.

**Proof:** smooth auto‑spin across arbitrary planes; stability over minutes.

## Phase 3 — Hyperplane slicing (3–4d)
- Edge‑wise intersection CPU path; parallelized in WASM.
- WGSL compute for large E; stitching into polylines; 3D overlay material.

**Proof:** live slider on `b` with stable intersection curves @ 90+ FPS (moderate E).

## Phase 4 — Field engine (3–5d)
- Expression parser → bytecode VM; numeric evaluation on points.
- Finite‑difference ∇, H (central difference, step adapt); conditioning checks and warnings.

**Proof:** level‑set \(f(x)=c\) via edge signs; tangent plane & gradient gizmos.

## Phase 5 — Calculus tools & UI (3–4d)
- Calculus panel: probe point, ∇, directional derivative along v, Hessian eigen‑classification.
- Critical point scan in a window (coarse grid + local refinement).

**Proof:** find and classify extrema on demo functions in n=3..6.

## Phase 6 — PCA & profiling (2–3d)
- PCA basis on vertices/clouds; surface tolerance/sweeps to UI.
- Perf harness across WebGPU/WebGL2; SharedArrayBuffer threading gated by headers.

**Proof:** PCA toggles; FPS + memory regression dashboards.

## Phase 7 — Exports & headless (4–6d)
- SVG path overlay; PNG snapshot; job JSON + headless renderer parity.
- CLI/queue for batch MP4/PNG/SVG.

**Proof:** deterministic assets across web/headless on sample scenes.

## Risks & Mitigations
- **Combinatorial edges:** cap E; sample edges; point‑cloud mode.
- **Numeric drift:** QR cadence; double‑precision in WASM for sensitive steps.
- **Browser variance:** strict fallback rules; guard feature flags.
