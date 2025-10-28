# HyperViz — Testing & Performance

## Unit & Integration
- **Core math:** generators, Givens, projection, hyperplane intersections, finite‑diff ∇/H.
- **Parser/VM:** tokenization, precedence, constants, error paths.
- **GPU parity:** WebGPU vs WebGL2 snapshot tests on geometry & slices.
- **Exports:** deterministic SVG path ordering; PNG pixel‑diff within tolerance.

## Perf harness
- Automated scenarios (tesseract n=4..8, random planes) with FPS & memory budgets.
- Compare CPU‑WASM vs GPU compute for rotations/projections; tune LOD thresholds.

## Stability & Numerical checks
- QR cadence to re‑orthonormalize R; PCA residuals; gradient step sizing.
- Threading/headers matrix: ensure SAB path only when COOP/COEP present.

## Tooling
- CI on Linux/macOS with emsdk; brotli bundles; separate chunks for WASM kernels.
