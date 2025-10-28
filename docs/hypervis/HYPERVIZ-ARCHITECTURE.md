# HyperViz — Architecture

## 1) High‑level layout

```
/ndvis-core/           # C++: geometry + math kernels (Givens, QR, PCA, intersections, finite diff)
/ndcalc-core/          # C++: expression VM (bytecode) + forward-mode AD (v1), compiles to WASM
/ndvis-web/            # React/TS UI, loader, camera, GPU pipelines
  src/gpu/             # WebGPU primary, WebGL2 fallback shaders
  src/wasm/            # WASM loader, TS types
  src/state/           # Zustand stores for n, planes, basis, fields
  src/ui/              # Panels: Hyperplane, Function, Calculus, Export
  src/render/          # R3 scene, instancing for edges/points
/ndvis-render-headless/# Native renderer (Dawn/wgpu-native) + job runner
/docs/
```

The **WebGPU-first** path executes rotations/projections in compute; WebGL2 is the fallback. WASM (C++ via Emscripten) owns heavy math and packing/unpacking of buffers. The UI orchestrates but avoids per‑vertex math in JS.

## 2) Data model

- **Structure-of-Arrays (SoA)** buffers for vertices in ℝⁿ: one `Float32Array` per dimension; edge index buffer `Uint32Array`.
- **Basis3** (n×3, column‑major) for ℝⁿ→ℝ³ projection.
- **Plane list**: up to K Givens (i,j,θ); compacted for GPU uniform buffer.
- **Hyperplane**: `a: Float32Array(n)`, `b: number`; pre‑normalized.
- **Field program**: expression **bytecode** (const pool + opcodes) compiled once, executed over points in WASM; optional forward‑mode AD for ∇, J, H.

## 3) Pipelines

### Geometry → View
1. Apply Givens rotations in ℝⁿ (CPU WASM for accuracy at small n; compute shader for large clouds).
2. Project to ℝ³ with Basis3.
3. Render vertices/edges as instanced primitives; optional faces for low n.

### Hyperplane intersection
- For each edge (v0,v1) in ℝⁿ, compute t solving \(a\cdot(v0 + t (v1-v0)) = b\).
- Keep 0≤t≤1; collect points; stitch into polylines per cell via hash on incident facets.
- GPU compute pass available for large E; otherwise WASM.

### Level set \(f(x)=c\)
- Evaluate f at vertices; mark sign changes along edges; compute intersection t by linear interpolation or 1D secant on the edge param.
- Assemble segments similar to hyperplane intersection.

### Calculus probes
- Evaluate f, ∇f, Hf at a point p.
- Show gradient arrow and a 2‑D tangent patch embedded in ℝ³ via Basis3.
- Optional Jacobian for vector‑valued f.

## 4) GPU & Fallback

- **WebGPU**: WGSL compute passes `rotate_givens`, `project_to3`, `slice_hyperplane`, optional `evaluate_linear`. 
- **WebGL2**: mirror buffer descriptors; reuse WASM‑projected positions if compute is unavailable.
- **Threading**: optional WASM threads (COOP/COEP) with SharedArrayBuffer for staging; degrade to single‑thread if headers missing.

## 5) Extensibility hooks

- Plug‑in generators for lattices, product spaces, random clouds.
- User‑defined linear maps A (n×n) with preset eigen‑stories.
- Headless JSON job spec for reproducible exports.
