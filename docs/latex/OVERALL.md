Got it. Here’s a repo-specific architecture + implementation plan to make **LaTeX-centric input** first-class in HyperViz, wired into your existing Zustand store, WASM bindings, and panels.

# Goals (scope & non-goals)

- **Scope**

  - Let users type LaTeX for: **(a)** hyperplanes (a\cdot x=b), **(b)** scalar fields (f:\mathbb{R}^n\to\mathbb{R}), **(c)** optional matrices (custom basis (3\times n) now; linear maps (m\times n) later).
  - Render LaTeX beautifully; compile to the **exact state** and WASM paths you already have: `HyperplaneConfig`, `FunctionConfig.expression/programBytecode`, `geometry.basis`, then `triggerRecompute()`. Your panels and async recompute flow already exist.
- **Non-goals (v1)**: full symbolic CAS, arbitrary TeX macros, general PDE solvers.

---

# High-level architecture (fits current code)

**Flow (web only):** UI MathField (LaTeX) → `latex-translator` (subset LaTeX → IR) →

- Hyperplane: `{a: Float32Array, b}` → `setHyperplane()` → `triggerRecompute()`
- Function: ASCII expr (e.g. `sin(x1)+x2^2`) → `setFunctionExpression()` → `compileExpression()` (WASM stub you already call) → `setFunctionValid(..., bytecode)` → `triggerRecompute()`
- Matrix: `number[][]` → pack to `Float32Array` → set as **custom basis** (or later, a linear map)

You already have the **panels**, **tabs**, and **recompute** plumbing:

- Panels: Geometry / Hyperplane / Function / Calculus / Export.
- Hyperplane panel updates `hyperplane` via `setHyperplane(...)` and triggers recompute.
- Function panel debounces, calls `compileExpression(...)` from your WASM layer, then `setFunctionValid(...)`.
- `triggerRecompute()` dynamically imports `computeOverlays(...)` and stores results + errors.
- The WASM interface in `hyperviz.ts` is already shaped for an expression VM and overlays.

**Where LaTeX fits:** add a **Math Mode** section to Hyperplane/Function panels, plus an optional **Matrix (LaTeX)** section in Geometry/Controls.

---

# Modules & files to add/modify

## 1) `ndvis-web/src/math/latex.ts` (new)

A tiny translator for a safe LaTeX subset → your internal forms.

Exports:

- `latexToAsciiExpr(latex: string): string` → e.g. `\sin(x_1)+x_2^2` → `sin(x1)+x2^2`
- `latexToHyperplane(latex: string, n: number): { a: Float32Array; b: number }` (linear check)
- `latexToMatrix(latex: string): number[][]` (parse `bmatrix` to rows)

Rationale: keep bundle small; you only need math expressions, not a full TeX engine. (Render with KaTeX, enter with MathLive; translator is for compilation.)

## 2) `ndvis-web/src/ui/latex/MathField.tsx` (new)

- Wrap **MathLive** (contenteditable math input) with a light adapter:

  - Props: `{ value?: string; onChange(tex: string); onSubmit?(); onValidate?(ok:boolean, msg?:string) }`
  - Defer loading MathLive via dynamic import to avoid increasing the main bundle.
- Use **KaTeX** for read-only preview.

## 3) Panel integrations (surgical, no Redux sprawl)

- **HyperplanePanel.tsx**: add a LaTeX card:

  - “Equation (LaTeX):” input → `latexToHyperplane` → normalize `a` → `setHyperplane({ coefficients, offset, enabled: true })` → `triggerRecompute()`. Your panel already normalizes and toggles; follow the same conventions.
- **FunctionPanel.tsx**: add “Expression (LaTeX)” above the textarea:

  - `latexToAsciiExpr(tex)` → `setFunctionExpression(ascii)` (your existing debounce then calls `compileExpression`).
- **ControlsPanel** (or Geometry tab): “Custom basis (LaTeX matrix)”

  - `latexToMatrix` → pack to `Float32Array(3*dimension)` → set `geometry.basis` or flip `basis` radio to `"custom"`. Your `GeometryState` already holds `basis` column-major (3×n).

## 4) State shape (minimal extension)

Append non-breaking optional fields in `src/state/appState.ts`:

```ts
// Add only these two (optional) fields:
export type FunctionConfig = {
  /* existing fields */
  // :contentReference[oaicite:14]{index=14}
  latex?: string;
};

export type HyperplaneConfig = {
  /* existing fields */
  // :contentReference[oaicite:15]{index=15}
  latex?: string;
};
```

All other mutations stay the same: `setHyperplane`, `setFunctionExpression`, `setFunctionValid`, `triggerRecompute`.

---

# Parsing & safety (translator rules)

**Supported LaTeX (v1):**

- Vars: `x_1, …, x_n` → `x1, …, xn`
- Numbers: decimals, scientific, `\pi` (→ numeric)
- Ops: `+ - *` and `\cdot \times`, `/`, `\frac{u}{v}`
- Functions: `\sin \cos \tan \exp \log \ln \sqrt{…}`
- Powers: `x^2`, `x^{k}`
- Grouping: `()[]{}` and `\left … \right …`
- **Hyperplane** is restricted to **linear** form each side of `=`.
- Matrices: `\begin{bmatrix} a&b \\ c&d \end{bmatrix}`

**Validation:**

- Hyperplane: reject any term that isn’t constant or `coef * x_i`.
- Function: after `latexToAsciiExpr`, rely on your `compileExpression()` (already called by FunctionPanel) for definitive parse/bytecode errors.

**Why not full TeX?** Smaller attack surface, deterministic output, simpler tests. You can extend grammar later without breaking the UI.

---

# WASM binding touch-points (no ABI changes)

- Function path is unchanged: the panel already calls `compileExpression(trimmed, dimension)` and stores returned `bytecode` or `error`.
- Recompute path unchanged: `triggerRecompute()` snapshots `geometry`, `hyperplane`, `functionConfig`, `calculus` and awaits `computeOverlays(...)` (stub → WASM).
- Your WASM module interface already includes parser/VM hooks, hyperplane slicing, level sets, etc. (future real module will slot in).

---

# UI/UX details

- **Mode selector** inside each panel:

  - Hyperplane: `[ Sliders | LaTeX ]` tabs.
  - Function: `[ Text | LaTeX ]` tabs; both views bound to the same state.
- **Live preview** (KaTeX) with status pill:

  - ✓ valid → shows compiled; ✖ error → message returned by translator or `compileExpression`.
- **Keyboard**: Enter = parse & submit; `Ctrl/Cmd+Enter` = parse + recompute.
- **A11y**: preserve existing tab/ARIA patterns from panel CSS.

---

# Concrete code skeletons (drop-in)

## `src/math/latex.ts` (translator outline)

```ts
const FN = new Map([
  ["\\sin", "sin"],
  ["\\cos", "cos"],
  ["\\tan", "tan"],
  ["\\exp", "exp"],
  ["\\log", "log"],
  ["\\ln", "log"],
  ["\\sqrt", "sqrt"],
]);

export function latexToAsciiExpr(src: string): string {
  let s = src.trim().replace(/\\left|\\right/g, "");
  s = s.replace(/\\frac\s*\{([^}]*)\}\s*\{([^}]*)\}/g, "($1)/($2)");
  for (const [k, v] of FN) {
    s = s.replace(new RegExp(`${k}\\s*\\{`, "g"), `${v}(`);
  }
  s = s.replace(/\)/g, ")");
  s = s.replace(/\}/g, ")");
  s = s.replace(/x_\{(\d+)\}/g, "x$1").replace(/x_(\d+)/g, "x$1");
  s = s.replace(/\\cdot|\\times/g, "*");
  s = s.replace(/(\d)(x\d+)/g, "$1*$2");
  s = s.replace(/\^\{([^}]+)\}/g, "^($1)");
  return s;
}

export function latexToHyperplane(src: string, n: number) {
  const [lhsRaw, rhsRaw] = src.split("=").map((s) => s?.trim());
  if (!lhsRaw || !rhsRaw) throw new Error("Expected an equation with '='");
  const expr = `(${latexToAsciiExpr(lhsRaw)})-(${latexToAsciiExpr(rhsRaw)})`;
  const a = new Float32Array(n);
  let c = 0;
  const toks = expr.replace(/-/g, "+-").split("+").map((t) => t.trim()).filter(
    Boolean,
  );
  for (const t of toks) {
    const m = t.match(/^([+-]?\d*\.?\d*)\*?(x(\d+))?$/);
    if (!m) throw new Error(`Nonlinear/unsupported term: ${t}`);
    const k = m[1] === "" || m[1] === "+" || m[1] === "-"
      ? Number((m[1] || "+") + "1")
      : Number(m[1]);
    if (m[2]) {
      const j = Number(m[3]) - 1;
      if (j < 0 || j >= n) throw new Error(`x${j + 1} out of range`);
      a[j] += k;
    } else c += k;
  }
  return { a, b: -c };
}

export function latexToMatrix(src: string): number[][] {
  const body = src.replace(/\\left|\\right/g, "")
    .replace(/\\begin\{bmatrix\}|\n|\\end\{bmatrix\}/g, "")
    .trim();
  return body.split(/\\\\/).map((row) =>
    row.split(/&/).map((x) => Number(latexToAsciiExpr(x.trim())))
  );
}
```

(Kept small on purpose; expand as needed.)

## Hyperplane: wire-up snippet (inside panel)

```ts
// onParse(tex):
const { a, b } = latexToHyperplane(tex, dimension);
const mag = Math.hypot(...Array.from(a));
if (mag === 0) throw new Error("All-zero normal");
const coeffs = new Float32Array(a.length);
for (let i = 0; i < a.length; i++) coeffs[i] = a[i] / mag;
setHyperplane({
  coefficients: coeffs,
  offset: b / mag,
  latex: tex,
  enabled: true,
});
await triggerRecompute();
```

This mirrors your current normalize/enable/recompute behavior.

## Function: wire-up snippet (inside panel)

```ts
// onParse(tex):
const ascii = latexToAsciiExpr(tex);
setFunctionExpression(ascii); // your debounce → compileExpression → setFunctionValid → recompute
```

Your `FunctionPanel` already debounces and calls `compileExpression(trimmed, dimension)` then `setFunctionValid(true, null, bytecode)` on success.

## Basis (optional): 3×n LaTeX matrix

```ts
// onParse(tex):
const rows = latexToMatrix(tex);
if (rows.length !== 3 || rows.some((r) => r.length !== dimension)) {
  throw new Error("Expect 3×n");
}
const B = new Float32Array(3 * dimension);
for (let k = 0; k < 3; k++) {
  for (let j = 0; j < dimension; j++) B[k * dimension + j] = rows[k][j];
}
setGeometry({ ...geometry, basis: B }); // GeometryState.basis exists
await triggerRecompute();
```

Your projection path consumes `geometry.basis` to produce 3D positions now; no extra render code required.

---

# Styling & layout

Use your existing panel system and CSS utilities (`panel-header`, form controls, status badges). The new controls should live under the same classes to inherit look & feel.

---

# Dependencies (minimal)

- **Runtime render**: `katex` (preview)
- **Editable field**: `mathlive` (dynamic import on panel open)
- **Unit tests**: existing Vitest stack

No WASM ABI changes; the LaTeX path compiles down to the exact `expression`/`bytecode`/`hyperplane` you already use.

---

# Error handling & user feedback

- Translate-time errors (e.g., nonlinear hyperplane term) surface inline in the panel (use your `validation-error` style).
- Parser/bytecode errors are already surfaced by `FunctionPanel` via `setFunctionValid(false, error, null)`.
- Show compute errors in the viewport overlay (unchanged).

---

# Testing plan

**Unit (Vitest)**

- `latex.spec.ts`:

  - `x_1+2x_3=7` → `a=[1,0,2,0], b=7`
  - `\frac12 x_2 - x_4 = 0` → `a=[0,0.5,0,-1], b=0`
  - `\sin(x_1)+\exp(-x_2^2-x_3^2)-x_4` → `sin(x1)+exp(-(x2^2+x3^2))-x4`
  - `bmatrix` 3×4 → `Float32Array(12)`
- `FunctionPanel.latex.ui.spec.tsx`:

  - Paste LaTeX → ascii set → `compileExpression` invoked (mock) → success badge.

**Integration**

- Drive Hyperplane LaTeX → `triggerRecompute()` fired and overlays update. You already expose `triggerRecompute` and overlay state.

---

# Performance & security

- Translator is linear in string length; zero dynamic codegen (WASM-friendly).
- MathLive loaded on demand; KaTeX render only after successful parse → avoids typing lag.
- Clamp matrix sizes; reject huge inputs; keep `eval` out of code paths.

---

# Migration / rollout

1. Land translator + tests.
2. Add LaTeX cards to **Hyperplane** and **Function** panels (behind a feature flag prop).
3. Add **Matrix (LaTeX)** to Geometry (optional).
4. Wire KaTeX preview + basic errors; ship.
5. Iterate grammar (abs, norms, piecewise) as needed.

---

# Work breakdown (PR-sized)

**PR1 — Translator + tests**

- `src/math/latex.ts` + Vitest.

**PR2 — Hyperplane LaTeX**

- Add card to `HyperplanePanel.tsx`; parse → `setHyperplane` → recompute.

**PR3 — Function LaTeX**

- Add card to `FunctionPanel.tsx`; parse → `setFunctionExpression` (debounce/compile already there).

**PR4 — Matrix (optional)**

- Geometry tab addition; set `geometry.basis`; ensure “Projection basis” respects `"custom"`. You already keep PCA/standard/random in state.

**PR5 — Polish**

- KaTeX previews, copy buttons, small UX niceties, docs entry in `/docs/`.

---

# Open decisions (recommendations)

- **Input component**: MathLive for rich input vs. plain textarea + KaTeX. _Recommendation_: MathLive, dynamically imported.
- **Grammar breadth**: linear hyperplanes only (v1). Add `\abs{}`, `\|x\|`, piecewise later.
- **Basis editor**: allow both (3\times n) basis and (n\times n) linear map (future SVD/EVD features).

---

# “Why this is not generic”

- It writes **directly** into your existing state & recompute mechanics: `setHyperplane`, `setFunctionExpression`, `setFunctionValid`, `triggerRecompute`. No new global plumbing.
- It honors your **panel layout** and style system (panel tabs, headers, badges).
- It relies on your **WASM stubs** (`compileExpression`, overlay compute) and doesn’t change DI or ABI.

If you want, I can turn this into a set of ready-to-paste files (`latex.ts`, `MathField.tsx`, and patched panel components) matching your import paths and class names.
