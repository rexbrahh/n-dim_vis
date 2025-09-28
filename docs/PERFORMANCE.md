# Performance Notes

## PCA/Jacobi Solver

- `ndvis-core` uses a Jacobi diagonalisation pass for covariance matrices. The implementation lives in `ndvis-core/include/ndvis/detail/jacobi.hpp:1` and `ndvis-core/src/jacobi.cpp:1`.
- `JacobiParams.max_sweeps` defaults to 32. Profiles on high-dimension inputs should start with 16, 32, and 48 sweeps to balance stability and runtime. Stop early when off-diagonal elements fall below `JacobiParams.tolerance` (defaults to `1e-10`).
- When integrating in WASM, surface the parameters so the UI can request faster-but-rough passes (lower sweeps, higher tolerance) during interactive scrubbing, then re-run with tighter tolerance for exports.
- Record eigenvalue residuals (`||C * v - λv||`) during profiling to validate convergence; see `ndvis-core/tests/core_tests.cpp:120` for sample datasets.
