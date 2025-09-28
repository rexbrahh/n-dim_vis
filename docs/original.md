# Objective

Ship a fast, clean, browser‑based visualizer for n‑dimensional objects (n≥3) that renders in 3D and 2D, supports interactive rotations across arbitrary coordinate planes, and exports high‑quality assets (PNG/SVG/GIF) for docs and Figma.

---

## 1) Product slice & scope (MVP → v1)

**MVP (week 0–1):**

- Shapes: n‑cube (hypercube), n‑simplex, n‑orthoplex; hypersphere point cloud.
- n range: 3–8 (cap via vertex/edge budget).
- Projection: Rⁿ → R³ (interactive) → R² (screen).
- Rotations: Givens rotations (pick any 2D plane, e.g., x₂↔x₄).
- Controls: n slider; rotation plane picker; auto‑spin; reset; presets (4D tesseract).
- Render: thin lines (edges), small spheres (vertices), transparent faces optional.
- Perf target: 120 FPS on M1/M2 laptops for n‑cube up to n=6.

**v1 (week 2–4):**

- Additional objects: product spaces (cube×circle), lattices, user‑defined linear maps (matrix input).
- Projection bases: standard, PCA (on vertices), random orthonormal basis, custom (type 3 basis vectors).
- Camera: perspective/orthographic toggle; depth cue, fog.
- Styling: color by coordinate sign, magnitude, or cell id; Halpern gradients.
- Export: SVG (2D overlay), PNG, GLB; animated GIF/MP4 path export.
- Annotations: axis glyphs for up to 6 dims, legend.

**Later (advanced):**

- Stereographic projection for Sⁿ.
- Hopf fibration view for S³→S².
- Clifford torus slicing, marching‑slices through hyper‑surfaces.
- Time‑varying linear maps, eigenvector tracing; GPU compute (WebGPU) for big clouds.

---

## 2) Tech stack

- **UI**: React + TypeScript + Vite.
- **3D**: react‑three‑fiber (Three.js) + drei helpers; fallback to Canvas2D for 2D overlays.
- **State**: Zustand (low‑boilerplate).
- **Math**: custom linear‑algebra utils (float32), PCA via numeric.js‑style implementation or simple SVD (small matrices).
- **Build/quality**: Vitest, ESLint, Prettier.
- **Camera**: `drei`'s `CameraControls` (yomotsu/camera-controls) for orbit/dolly-to-cursor + pan + fit-to-object; optional pointer‑lock FPS mode (WASD) for free‑fly; quaternion orientation with damping.
- **Optional** (v1+): WebGPU path (wgpu/lygia shaders) behind feature flag; worker for heavy math.

Folder sketch

```
apps/web/
  src/
    math/            # R^n ops, PCA, projections, combinatorics
    models/          # generators for polytopes, clouds, lattices
    render/          # R3 scene graph, materials, instancing
    ui/              # panels, sliders, pickers
    export/          # svg/png/gif encoders
    state/           # zustand stores
    utils/
```

---

## 3) Math pipeline

Let V ∈ ℝ^{N×n} be vertex set (N vertices, n dims). For an n‑cube: N=2^n, coordinates in {−1,+1}^n.

1. **Rotation in ℝⁿ** Use a sequence of Givens rotations G(i,j,θ) (orthogonal, det=+1): R = ∏_k G(i_k,j_k,θ_k). Update: V′ = V·Rᵀ.

   - UI exposes plane (i,j) and θ or auto‑animate θ̇.

2. **Projection ℝⁿ → ℝ³** Choose orthonormal basis B₃ = [b₁ b₂ b₃] ∈ ℝ^{n×3}. 3D points: P₃ = V′·B₃. Options for B₃:

   - Standard axes (e₁,e₂,e₃).
   - Random ONB via Gram–Schmidt on 3 random n‑vectors.
   - PCA: top‑3 eigenvectors of covariance(V′).
   - Custom: user edits three n‑vectors, we orthonormalize.

3. **Camera ℝ³ → ℝ² (Blender/Google‑Earth style)**

   - **Orbit/Arcball (centered)**: pivot = object centroid (or user‑picked point). Rotate camera around pivot; **zoom** = dolly‑to‑cursor; **pan** moves camera+target together.
   - **Free‑Fly (FPS)**: pointer‑lock mouse‑look + WASD/QE; speed scales with scene radius; optional inertia/damping.
   - **Fit‑to‑Object**: compute bounding sphere of current 3D points P₃; set distance so object fills view with margin; dynamic near/far from radius.
   - **Pivot under cursor**: ray‑pick nearest vertex/edge; temporarily set pivot for precise inspections (Google‑Earth “zoom here”).
   - **Implementation**: Three.js + `camera-controls` via drei; maintain quaternion orientation to avoid gimbal lock; default up = (0,1,0) with toggle.
   - **Consistency**: normalize P₃ so RMS radius ≈ 1 → navigation feels consistent across n and bases.

4. **Styling/semantic layers**

   - Color maps: sign pattern, coordinate magnitude, vertex index Gray‑coded to preserve edge adjacency; edges colored by axis pair.
   - Face translucency with back‑face culling to reduce clutter.

**Complexity notes**

- n‑cube: |V|=2^n, |E|=n·2^{n−1}, |faces|=C(n,2)·2^{n−2}.
- Cap n so that E ≤ ~150k for 60–120 FPS; implies n ≤ 8 for full edge render (131,072 edges).
- For higher n, sample edges or render vertex point cloud + hull hints.

---

$1- **Camera modes & gestures**

- _Orbit (default):_ LMB drag = rotate, Shift+drag = pan, wheel/pinch = **dolly to cursor**, double‑click = focus pivot; `F` frame/fit; `1/3/7` = front/right/top, `Ctrl` for opposite.
- _Free‑Fly:_ `Tab` to toggle; mouse‑look + `WASD` move, `Q/E` rise/fall, `Shift` fast, `Alt` slow; `R` recenter on object.
- _Focus/pivot:_ click vertex/edge to set pivot; `Z` zoom‑to‑fit selection.
- **Dimension slider** n∈[3,12] with soft cap warning beyond perf budget.
- **Plane picker**: matrix of toggle buttons for (i,j) planes; multi‑plane auto‑spin uses small θ̇ per plane.
- **Basis presets**: Standard / Random ONB / PCA / Custom.
- **Slicing**: fix k coordinates to constants → displays a lower‑dimensional section.
- **Trails**: optional screen‑space motion trails for intuition of rotation.
- **Labels**: show up to first 6 axes with colored ticks; rest collapsed into legend.

---

## 5) Data structures & generation

```ts
// core types
export type VecN = Float32Array; // length n
export type Basis3 = Float32Array; // n×3, column‑major

export interface Polytope {
  n: number;
  vertices: Float32Array; // N×n
  edges: Uint32Array; // 2×E pairs of vertex indices
  faces?: Uint32Array; // optional quads/triangles indices
}

// n‑cube generator
function hypercube(n: number): Polytope {/* bit tricks for vertices + edges */}
```

- Use **bit patterns** for n‑cube: vertex id v∈[0,2^n), coord k is ±1 by ((v>>k)&1).
- Edge if ids differ by exactly one bit (Hamming distance 1).
- For simplex: vertices = standard basis + origin; edges all pairs.

---

## 6) Rendering strategy

- **Instanced meshes** for vertices (spheres) and edges (cylinders/lines).
- **Line rendering**: use `LineSegments2` (wide lines) or shader‑based extruded lines for crispness.
- **GPU matrices**: upload B₃ and active rotation planes as uniforms; compute V′·B₃ on GPU via per‑instance attributes where feasible (v1+).
- **LOD**: switch to point cloud beyond edge threshold; fade faces first, then edges.

---

## 7) Numerical stability

- Keep rotations incremental with small Δθ to avoid drift; periodically re‑orthonormalize R via QR.
- When building B₃, always Gram–Schmidt + renormalize.
- Use Float32 for GPU interop; Float64 CPU side OK for PCA step.

---

## 8) Export pipeline

- **SVG overlay**: capture projected 2D paths (edges) with z‑sorted painter’s algorithm → deterministic SVG that imports cleanly to Figma.
- **PNG**: WebGL snapshot at devicePixelRatio.
- **Animation**: keyframe θ(t) and basis(t); offline export to GIF/MP4 using webm‑writer or WASM ffmpeg.

---

## 9) Minimal milestones

1. **Scaffold** (day 0): Vite + R3F; panel with n slider; static 3D axes.
2. **Geometry** (day 1): n‑cube generator + edges; render as lines in 3D.
3. **Rotation** (day 2): Givens UI; animate θ; reset.
4. **Projection presets** (day 3): standard vs random basis; camera controls.
5. **Perf** (day 4): instancing + LOD; cap edges; measure FPS.
6. **Export** (day 5): SVG export of current frame; PNG snapshot.
7. **Polish** (day 6–7): labels, color maps, help popovers.

---

## 10) API surface (internal)

```ts
// rotations
applyGivens(R: Float64Array, i: number, j: number, theta: number): void
buildComposite(planes: [i,j,theta][]): Float64Array

// bases
randomONB(n: number): Basis3
pcaBasis(V: Float64Array): Basis3

// projection
projectTo3D(V: Float32Array, R: Float64Array, B3: Basis3): Float32Array // N×3
```

---

## 10a) Camera API

```ts
type CameraMode = "orbit" | "freefly";

interface CameraStore {
  mode: CameraMode;
  setMode(m: CameraMode): void;
  fitToSphere(center: THREE.Vector3, radius: number, margin?: number): void;
  focusOn(point: THREE.Vector3): void; // set pivot
  dollyToCursor(delta: number, ndc: { x: number; y: number }): void;
  setAzimuthPolar(az: number, pol: number): void;
  setDistance(d: number): void;
  pan(dx: number, dy: number): void;
  setFov(fov: number): void;
  setNearFar(near: number, far: number): void;
}

function getBoundingSphere(
  P3: Float32Array,
): { center: [number, number, number]; radius: number };
function raycastPivot(ndc: { x: number; y: number }): THREE.Vector3 | null;
```

$1

- Keep panels minimal; prioritize keyboard shortcuts (n↑/↓, add‑plane, pause).
- Provide **Explain** tooltips that link math to action (e.g., “You’re rotating in the x₂–x₄ plane”).
- Presets that tell a story: “Unfolding a tesseract,” “S³ stereographic” (v1+), “PCA of simplex”.

---

## 12) Risks & mitigations

- **Combinatorial explosion**: hard caps + LOD + sampling.
- **User confusion**: presets + axis legend + guided tour.
- **Numeric drift**: QR re‑orthonormalization cadence.
- **Browser differences**: test on WebGL2 baseline, progressive enhance to WebGPU.

---

## 13) Nice‑to‑haves for Rex

- CLI exporter for batch frames from a JSON spec.
- “Math mode”: input an n×n matrix A and watch its effect on the object.
- Live code editor (Monaco) to author bases/animations as tiny scripts.

---

$1- [ ] Implement orbit + free‑fly camera with `CameraControls` (orbit default, free‑fly via pointer‑lock).

- [ ] Add **fit‑to‑object**, **dolly‑to‑cursor**, and pivot‑under‑cursor ray‑pick; ship keyboard map & help overlay.
- [ ] Confirm n‑range and default caps.
- [ ] Decide initial color scheme (your Porsche racing green variant vs electric blue).
- [ ] Pick export priority (SVG first).
- [ ] I’ll scaffold the Vite + R3F project skeleton with the core types and one hypercube generator.

---

# Addendum — Performance‑first architecture (WebGPU/WASM/OpenGL)

## A1) Goal

Minimize JS work in the hot path. Move rotations, projections, and large‑N vertex transforms into **Rust→WASM** and **WebGPU (WGSL) compute**, with **WebGL2/OpenGL‑class** fallback for compatibility. Keep React/TS only for UI and camera gestures.

## A2) Runtime matrix & detection

| Layer  | Primary                           | Fallback                  |
| ------ | --------------------------------- | ------------------------- |
| GPU    | WebGPU (WGSL via `wgpu`)          | WebGL2 (ANGLE)            |
| Math   | Rust→WASM (SIMD + threads)        | Rust→WASM (single‑thread) |
| Camera | Orbit/Free‑Fly (uniforms only)    | Same                      |
| Export | Rust `wgpu` headless in container | CPU raster                |

At startup: detect WebGPU → enable compute; else use WebGL2 + WASM; else degrade to Canvas2D.

## A3) Data & kernels

- **Memory layout**: Structure‑of‑Arrays (SoA): n separate `Float32Array`/SSBOs for dims → coalesced loads.
- **Kernels (WGSL)**: `rotate_givens`, `project_to3`, `color_map`, `thin_out_edges` (LOD).
- **Uniforms**: packed Basis3 (n×3), plane list, θ, LOD limits.
- **Stability**: periodic QR in WASM; re‑orthonormalize Basis3 on GPU.

## A4) Camera in GPU land

- JS handles gestures only; we compute view/projection matrices CPU‑side and pass as uniforms. No per‑vertex math in JS.
- Modes: **Orbit/Arcball** (default), **Free‑Fly** (pointer‑lock WASD), fit‑to‑object, dolly‑to‑cursor, pivot‑under‑cursor.

## A5) Fallback (OpenGL‑class)

- **WebGL2** path mirrors buffers; GLSL shaders for instanced points/lines; shader‑based wide lines for thickness.
- Optional minimal Three.js only for camera helper math; avoid per‑vertex Three.js objects.

## A6) Server/Cluster export

- Rust `wgpu` headless renderer packaged into a container (Linux + Vulkan; macOS/Metal runner optional).
- **Job spec (JSON)**: geometry, n, planes over time, basis schedule, camera path, style.
- Scale with a queue (e.g., SQS/Redis) for batch 4K/8K MP4/PNG/SVG exports.

## A7) Tooling & headers

- WASM: `wasm‑bindgen`, `wasm‑pack`; enable **SharedArrayBuffer** via COOP/COEP headers on CDN.
- Build: Vite plugins for WASM; brotli compression; code‑split core vs optional kernels.

## A8) Milestones (GPU/WASM)

1. Rust core crate (`ndvis-core`) + WASM bindings.
2. WebGPU prototype: `project_to3` compute + instanced points @ 120 FPS (n‑cube n≤8).
3. Givens compute kernel + SoA buffers; perf harness.
4. Orbit/Free‑Fly camera → GPU uniforms only.
5. WebGL2 fallback path + feature flag.
6. Headless render container + JSON job ingestion + S3/GCS uploads.
7. SVG/PNG/MP4 export parity web ↔ server.
