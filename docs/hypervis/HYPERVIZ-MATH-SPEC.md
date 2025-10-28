# HyperViz — Math Spec (Geometry, Hyperplanes, Calculus)

## 1) Geometry & Rotations
- **n‑cube:** vertices `v ∈ {−1,+1}^n`, edges connect ids at Hamming distance 1.
- **Givens rotation G(i,j,θ):** rotate in coordinate plane (i,j). Composite R = ∏ G.
- **Projection:** choose orthonormal `B3 ∈ R^{n×3}`, then `P3 = V Rᵀ B3`.

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
