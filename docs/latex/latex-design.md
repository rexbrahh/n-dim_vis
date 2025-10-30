You’re right—typing math is faster than dragging sliders. Here’s a **repo-specific** plan that drops a LaTeX input path straight into your current UI/state and compiles it to the exact data you already consume (hyperplane coefficients, function bytecode, custom bases).

Below I reference your files so you can wire it in without guesswork.

---

# What we’ll add

1. **LaTeX input mode** for Hyperplane, Function, and (optionally) Basis/Matrix.
2. A tiny **LaTeX→IR** translator (subset of TeX math, not full TeX) that emits:

   - Hyperplane: (a\cdot x=b) → `{coefficients: Float32Array, offset: number}` to fill `HyperplaneConfig`.
   - Function: (f(x_1,\dots,x_n)=\cdots) → ASCII expression (`x1, x2, …`) or **bytecode** for your future `ndcalc` VM (`programBytecode`), both already modeled in `FunctionConfig`.
   - Matrix: `\begin{bmatrix}…\end{bmatrix}` → `Float32Array` to set a **custom projection basis** (3×n) or a linear map later.
3. Small UI components that slot into your existing panel structure and Zustand store.

You already have: projection-basis UI with PCA readout, and state buckets for hyperplane/function/calculus/geometry. We’ll hook into those instead of inventing new plumbing.

---

# 1) State additions (surgical edits)

In `ndvis-web/src/state/appState.ts`, extend `FunctionConfig` and `HyperplaneConfig` to remember the original TeX the user typed:

```ts
// appState.ts — add fields
export type FunctionConfig = {
  expression: string; // ASCII form you already use
  type: "scalar" | "vector";
  isValid: boolean;
  errorMessage: string | null;
  programBytecode: Uint8Array | null;
  latex?: string; // new: raw LaTeX the user typed
};

export type HyperplaneConfig = {
  enabled: boolean;
  coefficients: Float32Array; // normalized a
  offset: number; // b
  showIntersection: boolean;
  intersectionColor: [number, number, number];
  latex?: string; // new: raw LaTeX the user typed
};
```

No other store shape changes are needed; hyperplane coefficients and function program already flow through your recompute path.

---

# 2) UI: “LaTeX mode” in the three panels

You plan to have `HyperplanePanel.tsx`, `FunctionPanel.tsx`, `CalculusPanel.tsx` per the HyperViz docs; add a LaTeX input switch + preview in those panels.

- **HyperplanePanel.tsx**: a textarea (or MathLive input) + “Parse”. On success, call `setHyperplane({ coefficients, offset, latex })`. The rest of the panel stays as is.
- **FunctionPanel.tsx**: same; on success, call `setFunctionExpression(ascii)` and optionally `setFunctionValid(true, null, bytecode)` once the VM lands. You already store `programBytecode`.
- **ControlsPanel.tsx** can keep the PCA/basis section unchanged; add a small “Custom basis (LaTeX matrix)” drop-down if you want to feed a 3×n matrix.

For preview rendering, use KaTeX in “display:none” until parse succeeds, then show it next to the green validity pill.

---

# 3) Parser/translator (tiny, focused)

Create `ndvis-web/src/math/latex.ts` with three exported helpers:

```ts
// latex.ts
export function latexToAsciiExpr(latex: string): string;
export function latexToHyperplane(
  latex: string,
  n: number,
): { a: Float32Array; b: number };
export function latexToMatrix(latex: string): number[][]; // rows
```

### Supported LaTeX (subset)

- Variables: `x_1, x_2, …, x_{10}` → `x1, x2, …`
- Numbers: `-12.5`, `\pi` (optional) → numeric
- Ops: `+ - * \cdot \times`, `/` and `\frac{u}{v}`, parentheses/braces
- Powers: `x^2`, `x^{3}`
- Functions: `\sin \cos \tan \exp \log \ln \sqrt{…}`
- **Hyperplane restriction**: only **linear** combinations on each side of `=`.
- Matrices: `\begin{bmatrix} a&b&c \\ d&e&f \end{bmatrix}`

> Why a translator instead of a full TeX engine? Because you only need math **expressions** mapping to your existing `FunctionConfig` and `HyperplaneConfig`. It keeps bundle size and attack surface small, and it works in WASM-restricted contexts.

### Sketch (drop-in) implementation

```ts
// latex.ts (excerpt)
const fnMap = new Map([
  ["\\sin", "sin"],
  ["\\cos", "cos"],
  ["\\tan", "tan"],
  ["\\exp", "exp"],
  ["\\log", "log"],
  ["\\ln", "log"],
  ["\\sqrt", "sqrt"],
]);

export function latexToAsciiExpr(src: string): string {
  let s = src.trim();

  // normalize whitespace and remove \left \right
  s = s.replace(/\\left|\\right/g, "");

  // fractions
  s = s.replace(/\\frac\s*\{([^}]*)\}\s*\{([^}]*)\}/g, "($1)/($2)");

  // functions
  for (const [k, v] of fnMap) {
    s = s.replace(new RegExp(`${k}\\s*\\(`, "g"), `${v}(`);
  }
  for (const [k, v] of fnMap) {
    s = s.replace(new RegExp(`${k}\\s*\\{`, "g"), `${v}(`).replace(/\}/g, ")");
  }

  // variables: x_{10} → x10, x_2 → x2
  s = s.replace(/x_\{(\d+)\}/g, "x$1").replace(/x_(\d+)/g, "x$1");

  // \cdot \times → *
  s = s.replace(/\\cdot|\\times/g, "*");

  // implicit "2x3" → "2*x3"
  s = s.replace(/(\d)(x\d+)/g, "$1*$2");

  // power braces: ^{k} → ^(k)
  s = s.replace(/\^\{([^}]+)\}/g, "^($1)");

  return s;
}

export function latexToHyperplane(src: string, n: number) {
  const [lhsRaw, rhsRaw] = src.split("=").map((s) => s?.trim());
  if (!lhsRaw || !rhsRaw) throw new Error("Expected an equation with '='");

  const lhs = latexToAsciiExpr(lhsRaw);
  const rhs = latexToAsciiExpr(rhsRaw);

  // Move all to LHS: lhs - rhs = 0
  const expr = `(${lhs})-(${rhs})`;

  // Collect linear terms ai*xi and constant c:
  // pattern:  [+/-] [number?] * x<idx>
  const a = new Float32Array(n);
  let c = 0;

  // tokenize by +/-
  const tokens = expr.replace(/-/g, "+-").split("+").map((t) => t.trim())
    .filter(Boolean);
  for (const t of tokens) {
    // term like k*xj or just k or just xj
    const m = t.match(/^([+-]?\d*\.?\d*)\*?(x(\d+))?$/);
    if (!m) throw new Error(`Non-linear or unsupported term: '${t}'`);

    const coeff = m[1] === "" || m[1] === "+" || m[1] === "-"
      ? Number((m[1] || "+") + "1")
      : Number(m[1]);
    if (m[2]) {
      const j = Number(m[3]) - 1;
      if (j < 0 || j >= n) {
        throw new Error(`Variable index out of range: x${j + 1}`);
      }
      a[j] += coeff;
    } else {
      c += coeff; // constant term
    }
  }

  // We now have sum(ai xi) + c = 0  ⇒ a·x = -c
  return { a, b: -c };
}

export function latexToMatrix(src: string): number[][] {
  const body = src
    .replace(/\\left|\\right/g, "")
    .replace(/\\begin\{bmatrix\}|\\\\end\{bmatrix\}/g, "")
    .replace(/\\begin\{bmatrix\}/g, "")
    .replace(/\\end\{bmatrix\}/g, "")
    .trim();
  return body.split(/\\\\/).map((row) =>
    row.split(/&/).map((x) => Number(latexToAsciiExpr(x.trim())))
  );
}
```

That’s intentionally minimal—good enough for linear planes and common calculus expressions. You can expand the grammar later without changing the UI.

---

# 4) Wiring it into your panels

**Hyperplane (LaTeX → coefficients + offset)**

```ts
// HyperplanePanel.tsx (excerpt)
import { latexToHyperplane } from "@/math/latex";
import { useAppState } from "@/state/appState";

function HyperplaneLatexInput() {
  const n = useAppState((s) => s.dimension);
  const setHyperplane = useAppState((s) => s.setHyperplane);

  const onParse = (tex: string) => {
    const { a, b } = latexToHyperplane(tex, n);
    // normalize a and update
    let norm = Math.hypot(...Array.from(a));
    if (norm === 0) throw new Error("All-zero normal");
    const coeffs = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) coeffs[i] = a[i] / norm;
    setHyperplane({
      coefficients: coeffs,
      offset: b / norm,
      latex: tex,
      enabled: true,
    });
  };

  // …render textarea + “Parse” button…
}
```

This writes directly into the state your compute pipeline already uses for slicing overlays.

**Function (LaTeX → ASCII string → VM/bytecode when available)**

```ts
// FunctionPanel.tsx (excerpt)
import { latexToAsciiExpr } from "@/math/latex";
import { useAppState } from "@/state/appState";

function FunctionLatexInput() {
  const setExpr = useAppState((s) => s.setFunctionExpression);
  const setValidity = useAppState((s) => s.setFunctionValid);

  const onParse = (tex: string) => {
    const ascii = latexToAsciiExpr(tex); // produces "sin(x1) + exp(-(x2^2+x3^2)) - x4"
    setExpr(ascii);

    // If ndcalc isn’t ready yet, just mark valid. When it is, compile to bytecode and store:
    // const bytecode = ndcalc.compile(ascii)
    // setValidity(true, null, bytecode)
    setValidity(true, null, null);
  };
}
```

Your `FunctionConfig` is already set up to hold an expression + program bytecode, and your recompute path invokes WASM worker methods that will later consume the program.

**Basis (optional):** accept a 3×n LaTeX matrix and set `geometry.basis`:

```ts
// ControlsPanel.tsx (add-on)
import { latexToMatrix } from "@/math/latex";
const setGeometry = useAppState((s) => s.setGeometry);
const geometry = useAppState((s) => s.geometry);

function BasisLatexInput() {
  const onParse = (tex: string) => {
    const rows = latexToMatrix(tex); // [[...n], [...n], [...n]]
    if (
      rows.length !== 3 || rows.some((r) => r.length !== geometry.dimension)
    ) throw new Error("Expect 3×n");
    const B = new Float32Array(3 * geometry.dimension);
    for (let k = 0; k < 3; k++) {
      for (
        let j = 0;
        j < geometry.dimension;
        j++
      ) B[k * geometry.dimension + j] = rows[k][j];
    }
    // (Optional) Gram–Schmidt here to orthonormalize B3.
    setGeometry({ ...geometry, basis: B });
  };
}
```

Your projection path multiplies rotated vertices by `basis` to produce 3-D positions already.

---

# 5) WASM/VM tie-in (when `ndcalc-core` lands)

When your expression VM is in place (per docs), add a small loader `ndvis-web/src/wasm/ndcalc.ts` that exposes `compile()` and `evalBatch()`. On successful LaTeX parse:

- `ascii = latexToAsciiExpr(tex)`
- `bytecode = ndcalc.compile(ascii)` → store in `functionConfig.programBytecode` (already in state).

Your `triggerRecompute()` already hands `functionConfig` into the WASM-side `computeOverlays()`; you’ll just branch inside that function: if `programBytecode` exists, use the VM; otherwise use the ASCII expression with your current fallback.

---

# 6) Tests (fast confidence)

- **Vitest**: `src/math/latex.spec.ts`

  - Hyperplane: `"x_1 + 2x_3 = 7"` → `a=[1,0,2,0], b=7`.
  - `"\\frac{1}{2} x_2 - x_4 = 0"` → `a=[0,0.5,0,-1], b=0`.
  - Function: `"\\sin(x_1)+\\exp(-x_2^2-x_3^2)-x_4"` → `"sin(x1)+exp(-(x2^2+x3^2))-x4"`.
  - Matrix: 3×4 bmatrix to `Float32Array(12)`.
- **UI smoke**: mount panel, paste LaTeX, assert `useAppState` updated.
- **WASM later**: add Node tests to compile and eval bytecode on random points (see your WASM test plan).

---

# 7) UX details (sharp edges handled)

- On parse error, call `setFunctionValid(false, err.message, null)` and show a red tag near the input.
- For hyperplanes, detect **non-linear** terms and error out explicitly (“Only linear terms allowed for hyperplanes”).
- Normalize `a` so UI sliders and the numeric display are invariant to scale.
- Respect `dimension` changes by re-sizing stored vectors (you already do this for hyperplane coefficients and probe points).

---

# 8) Why this fits your codebase (not generic)

- We write **into your existing store fields** (`HyperplaneConfig.coefficients/offset`, `FunctionConfig.expression/programBytecode`). No new global state.
- We plug into the **planned panel layout** and keep PCA/basis UI intact (radio group, eigenvalue list).
- We reuse your **projection pipeline** and geometry recompute (Basis3 stays `n×3`, SoA vertex layout stays the same).
- The translator runs purely on the **web side**; it doesn’t change your C++ core or the PCA/Jacobi code.

---

## Quick TODO list you can commit today

1. `src/math/latex.ts` — add the 3 helpers above.
2. Panels: add a LaTeX input + “Parse” button to Hyperplane/Function (and optional Basis). Wire to `useAppState`.
3. `appState.ts` — add `latex?: string` fields as shown; no other logic changes needed.
4. Tests: create `src/math/latex.spec.ts` with the cases listed.
5. (Later) `wasm/ndcalc.ts`: hook compile()→`programBytecode` and let your existing `triggerRecompute()` path consume it.

If you want, I’ll write the complete `latex.ts` with edge-case handling (nested `\frac`, unary `-`, `\abs{⋅}`, simple `\|x\|`) and the exact panel component you can paste into `ndvis-web/src/ui/`.
