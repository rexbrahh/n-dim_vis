Great targets. Here’s a tight, build-ready plan to add:

- linear maps (A),
- orthogonal/unitary diagonalization (EVD),
- SVD,

and make them **visually explorable** in your n-D → 3-D projector.

---

# 1) Core representation (small additions, big leverage)

**Data model**

- `Basis3 B ∈ ℝ^{n×3}` already maps world (x∈ℝ^n) to view (p=B^T x∈ℝ^3).
- Add an optional **linear map** `A`:

  - Square (A∈ℝ^{n×n}) for endomorphisms (EVD, polar).
  - Rectangular (A∈ℝ^{m×n}) for general SVD (domain vs codomain).
- Keep **two bases** when (m≠n): `B_dom ∈ ℝ^{n×3}`, `B_codom ∈ ℝ^{m×3}`.

**Where it plugs in**

- Geometry path: (x \mapsto y = A,x \mapsto p = B^T y).
- So rendering just multiplies positions by `A` before projection.
- For scalar fields (f): expose a **coordinate transform**: (g(x)=f(A^{-1}x)). (Gradients transform by (∇g(x)=A^{-T} ∇f(A^{-1}x)).)

**Implement**

- CPU/WASM: SoA kernel `y[j][k] = Σ_i A[j,i]*x[i][k]`.
- GPU (WebGPU): storage buffer for `A`, compute pass `apply_linear` → projects after.

---

# 2) Orthogonal / unitary diagonalization (EVD)

**When it applies**

- Real **symmetric** (S=S^T) (orthogonally diagonalizable): (S=QΛQ^T).
- Complex **normal** (N) (unitarily diagonalizable): (N=UΛU^_) with (NN^_=N^*N).

**Algorithms to ship**

- **MVP (robust + simple)**: _Jacobi_ eigenvalue algorithm for symmetric real (n×n).

  - Easy to write, numerically stable, (O(n^3)), fine up to a few hundred.
- **Upgrade**: Householder **tridiagonalization** + **implicit-shift QR** (Wilkinson) for speed.
- **Normal (complex)**: Use real-block embedding or a complex path (if/when you add (\mathbb C)) to test normality and call a Hermitian routine.

**What to visualize**

- **Eigenvectors**: draw as axes/lines; allow “snap Basis3 to top-3 eigenvectors”.
- **Unit sphere → ellipsoid under (S)** (if SPD): axes lengths (|\lambda_i|) along eigenvectors (note sign flips orientation).
- **Dynamics**: iterates (x, Sx, S^2x,\dots) (power iteration visual), convergence to (\lambda_{\max}) direction.

**UI hooks**

- “Compute EVD” button (detect symmetry; warn if not).
- Toggles: show eigenframe, color code by sign of (\lambda), slider to animate (t\mapsto Q,\mathrm{diag}((1-t)+t\lambda_i),Q^T).

---

# 3) Singular Value Decomposition (SVD)

**Applies to any (A∈ℝ^{m×n})**

- (A=U,Σ,V^T), (Σ=\mathrm{diag}(σ_i≥0)).
- Image of **unit sphere** in domain is an **ellipsoid** in codomain with axes (σ_i) along columns of (U).

**Algorithms**

- **MVP**: Golub–Kahan SVD

  1. **Bidiagonalize** with Householder reflections: (U_1^T A V_1 = B).
  2. **Diagonalize** (B) via implicit-shift QR on bidiagonal; accumulate (U_2,V_2).
  3. (U=U_1U_2, Σ=\mathrm{diag}(B), V=V_1V_2).
- **Small n fast path** (2×2/3×3): closed-form SVD for stability demos.
- If you don’t want to write this now: compile **Eigen** to WASM for SVD/EVD, then replace with in-house later.

**What to visualize**

- **Two panes** (or split view): domain (basis (V)) and codomain (basis (U)).
- Animate **A in three steps**:

  1. rotate domain by (V^T) (axes line up),
  2. scale along axes by (Σ),
  3. rotate codomain by (U).
- Show **rank** (zero (σ_i)), **condition number** (κ=σ_{\max}/σ_{\min}), **det sign** (if square).
- Draw **nullspace** (vectors mapped to 0) and **range** (spanned by columns of (U) with nonzero (σ)).

**UI hooks**

- “Compute SVD” → overlay bars for (σ_i), toggle null/range subspaces.
- Button: “Set Basis to (V)” (domain) / “Set Basis to (U)” (codomain).
- Option: “Sphere→Ellipsoid” overlay.

---

# 4) Polar decomposition (nice for animations)

Every square (A) has (A=QH) with (Q∈SO(n)), (H) SPD.

- Compute via SVD: (A=UΣV^T) ⇒ (Q=UV^T), (H=VΣV^T).
- **Visual**: clean “rotate then stretch” story; geodesic interpolate (Q(t)) on (SO(n)) + (H(t)=V,Σ^t,V^T).

---

# 5) Rendering & performance notes

- Doing (y=A x) on GPU is cheap (one mat-vec per point). Keep `A` in a storage buffer (uniforms can be size-limited).
- For **massive** point clouds, pretransform in a compute pass once per frame; then reuse projected buffers.
- **Stability**:

  - Re-orthonormalize `Basis3` periodically (modified Gram–Schmidt / QR) so it stays orthonormal after user drags + animations.
  - Normalize eigenvectors/singular vectors; sort (σ_i,|\lambda_i|) descending for consistent UI.

---

# 6) API surface (C++/WASM)

```cpp
// Linear map
void apply_linear_map(const float* A, int m, int n,
                      const float* X_soa, size_t Npts,
                      float* Y_soa);

// EVD (symmetric real)
bool evd_symmetric(const double* S, int n,
                   double* Q_out, double* lambda_out); // S ≈ Q Λ Q^T

// SVD
bool svd(const double* A, int m, int n,
         double* U_out, double* S_diag_out, double* Vt_out);

// Helpers
bool is_symmetric(const double* S, int n, double tol);
bool is_normal(const std::complex<double>* A, int n, double tol);
```

Expose the same via WASM (C ABI) and simple TS bindings.

---

# 7) Visual “labs” (feature list you can ship incrementally)

**Linear Map Lab (MVP)**

- Matrix editor, apply (A) to geometry, show det/trace/rank.
- Unit sphere → image.

**Eigen Lab**

- Compute EVD (auto-detect symmetry).
- Draw eigenframe, axes lengths (|\lambda_i|).
- Power-iteration widget for (\lambda_{\max}).

**SVD Lab**

- Two-pane domain/codomain, stepwise (V^T → Σ → U).
- Nullspace/range toggles, condition number bar.

**Polar Lab**

- Animate (Q(t)H(t)), show “pure rotation” vs “pure stretch”.

---

# 8) Edge cases & messaging

- **Not symmetric / not normal**: say “orthogonal/unitary diagonalization does not apply; showing **Schur** instead” (optional later).
- **Nearly defective** matrices: avoid “Jordan form” (numerically ill-conditioned); prefer real Schur or just show SVD.
- **m≠n**: EVD disabled; SVD only. Render domain/codomain separately.

---

## Quick roadmap

1. Implement GPU/CPU `apply_linear_map` + UI matrix editor.
2. Add symmetric EVD via Jacobi; eigenframe overlay + sphere→ellipsoid.
3. Add SVD (Eigen or in-house Golub–Kahan); two-pane visualization + animations.
4. Add polar decomposition animation and basis-snapping to (U,V).
5. Quality: basis re-orthonormalization, numeric guards, perf polish.

If you want, I can sketch the Jacobi EVD (rotation selection, convergence test) and a minimal bidiagonal SVD in C++ so you can drop them into your WASM build.
