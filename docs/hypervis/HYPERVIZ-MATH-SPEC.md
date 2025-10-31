# HyperViz — Math Spec (Geometry, Hyperplanes, Calculus)

## 1) Geometry & Rotations
- **n‑cube:** vertices `v ∈ {−1,+1}^n`, edges connect ids at Hamming distance 1.
- **Givens rotation G(i,j,θ):** rotate in coordinate plane (i,j). Composite R = ∏ G.
  - Single rotation: `G(i,j,θ)[row, i] = cos(θ) * R[row, i] - sin(θ) * R[row, j]`
  - Single rotation: `G(i,j,θ)[row, j] = sin(θ) * R[row, i] + cos(θ) * R[row, j]`
  - Batched application: apply planes sequentially to mutation matrix in-place
- **Projection:** choose orthonormal `B3 ∈ R^{n×3}`, then `P3 = V Rᵀ B3`.

### Drift Correction & QR Re-orthonormalization
- **Orthogonality drift:** measure quality of rotation matrix via `δ = ||R^T R - I||_F` (Frobenius norm)
- **Drift accumulation:** numerical errors accumulate during repeated Givens rotations
- **QR correction:** apply Modified Gram-Schmidt re-orthonormalization periodically
  - Configurable cadence (default: every 100 frames)
  - Threshold-based trigger (default: δ > 0.01)
- **Implementation:** `reorthonormalize(R, n)` restores orthonormality with O(n³) cost
- **Stability guarantee:** with periodic QR, drift remains bounded (< 0.01) over extended sessions

### Rotation API
- **C API:** `ndvis_apply_rotations(matrix*, order, planes*, plane_count)`
  - Struct: `NdvisRotationPlane { u32 i, u32 j, f32 theta }` (12 bytes)
- **C API (geometry):** `ndvis_project_geometry(vertices*, vertex_count, dimension, rotation*, rotation_stride, basis*, basis_stride, out*, out_length)`
- **WASM bindings:** `applyRotations()`, `computeOrthogonalityDrift()`, `reorthonormalize()`, `projectGeometry()`
  - Initialized on app startup via `initializeWasmBindings()` in App.tsx
  - Plane packing: 3 x 32-bit values per plane (no padding)
- **WebGPU compute:** `rotate_givens.wgsl` parallelizes rotation across matrix rows (64 threads/workgroup)
- **Performance:** native WASM preferred when available, JS fallback otherwise

## 2) Hyperplanes & Slices
- **Hyperplane:** \(H = \{x \in \mathbb{R}^n \mid a\cdot x = b\}\), `a` normalized.
- **Edge intersection:** For edge `x(t)=v0 + t (v1−v0)`, solve `a·x(t)=b` ⇒
  `t = (b − a·v0) / (a·(v1−v0))`, keep `t∈[0,1]`.
- **Stitching:** Hash by incident facet ids to connect segments into polylines.

## 3) Level sets \(f(x)=c\)
- Evaluate `f(vk)` on vertices; detect sign changes across edges.
- For each sign‑changing edge, initial `t0 = (c−f(v0))/(f(v1)−f(v0))` (linear interp).
- Optional secant refinement limited to the scalar edge param t.

## 4) Calculus
- **Gradient:** central difference (MVP): `∂f/∂xi ≈ [f(x+he_i)−f(x−he_i)]/(2h)`; choose `h≈√ε(1+|xi|)`.
- **Hessian:** central difference on gradient or 2‑D stencil; symmetric by construction.
- **Directional derivative:** `D_v f = ∇f·v̂`.
- **Tangent plane at p:** `T_p = { x | ∇f(p)·(x−p) = 0 }`. Render a finite patch embedded via Basis3.
- **Critical points:** solve `∇f=0` with coarse grid + Newton refinement (fallback to gradient descent). Classify by H eigenvalues.

## 5) PCA basis (v1)
- Build covariance on vertices/clouds; diagonalize; take top‑3 eigenvectors; monitor residuals.
