docs/latex/10_ARCHITECTURE.md

# LaTeX Input — Architecture

[User] ──types LaTeX──▶ MathField (UI) │ └─▶ Translator (src/math/latex.ts) ├─ hyperplane: { a: Float32Array, b: number } ├─ function: ascii "sin(x1)+x2^2" └─ matrix: number[][]

Zustand store ◀──── Panel handlers set state │ ├─ Hyperplane: setHyperplane({coefficients, offset, enabled: true}) ├─ Function: setFunctionExpression(ascii) → compileExpression(ascii,n) │ → setFunctionValid(true, null, bytecode) └─ Geometry: setGeometry({ basis: Float32Array(3*n) }) (optional)

triggerRecompute() → WASM computeOverlays(...) → viewport overlays update
