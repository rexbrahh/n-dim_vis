# HyperViz — Vision & Scope (ndvis × Hyperplane Calculus)

**Goal:** Merge the fast n‑dimensional object visualizer (“ndvis”) with a first‑class **hyperplane & multivariable‑calculus** toolset. Users can: (1) generate classic n‑polytopes and point clouds, (2) rotate in ℝⁿ (Givens), (3) project into ℝ³ for inspection, (4) define scalar/vector fields \(f:\mathbb{R}^n \to \mathbb{R}^m\), (5) visualize **hyperplanes**, **level sets**, **tangent planes**, **gradients/Jacobians/Hessians**, and (6) export crisp assets (SVG/PNG/MP4).

## MVP (2–3 weeks)

- **Geometry & camera:** n‑cube/simplex/orthoplex + orbit/free‑fly camera; LOD for high n.
- **Hyperplane slicing:** Interactive plane \(a\cdot x=b\). Intersect with current polytope; render intersection polygonal lines.
- **Function field:** Text editor for scalar \(f:\mathbb{R}^n\to\mathbb{R}\) with x1..xn variables; live evaluation at a probe point.
- **Tangent plane:** At point \(p\), show \(\nabla f(p)\) and tangent plane for a selected 2‑ or 3‑D subspace.
- **Level set slider:** Visualize \(f(x)=c\) by edge‑wise intersection on the current geometry; animate c.
- **Exports:** PNG + SVG of projected edges/overlays; save/load scenes.

## v1 (4–6 weeks total)

- **Grad/Jac/Hess calculators:** numeric ∇f, Jf, Hf with conditioning warnings.
- **Critical points:** find & classify critical points in selected region.
- **Directional derivatives:** along user‑chosen \(v\).
- **Matrix maps:** apply linear map \(A\in\mathbb{R}^{n\times n}\) to geometry; animate eigen‑decomposition.
- **Batch/headless exports:** JSON job spec → MP4/PNGs; parity with browser rendering.
- **PCA basis:** optional PCA on vertices or sample clouds; expose convergence knobs.

## Non‑goals (for later)

- Full symbolic CAS; non‑linear PDE plots; general marching “hyper‑cubes” meshing in n>3.
