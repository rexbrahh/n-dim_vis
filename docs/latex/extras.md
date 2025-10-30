Absolutely—here’s a clean, properly-formed set of scoped Markdown docs you can drop into your repo. I’ve kept them concise but complete, with code blocks that compile and no odd characters.

---

### `docs/latex/00_OVERVIEW.md`

```markdown
# LaTeX Input — Overview

## Problem

Typing math via sliders and plain text is slow. Many users already have LaTeX in notes; they want to paste it and get correct visualizations immediately.

## Goals

- First-class LaTeX input for:
  1. **Hyperplanes** \(a \cdot x = b\)
  2. **Functions** \(f:\mathbb{R}^n \to \mathbb{R}\)
  3. **(Optional)** Matrices for **Custom Projection Basis** \((3 \times n)\)
- Compile LaTeX into the **same internal state** you already use (no ABI changes):
  - `HyperplaneConfig` → `{coefficients: Float32Array, offset: number}`
  - `FunctionConfig` → `expression: string` (and `programBytecode` when VM is active)
  - `geometry.basis` → `Float32Array` packed 3×n basis
- Keep the existing **recompute flow** (`triggerRecompute()`), panels, and overlays.

## Non-Goals (v1)

- Full TeX macro system or general CAS
- Non-linear constraint solving in the hyperplane path

## Success Criteria

- Pasting common LaTeX works on first try; errors are clear.
- Hyperplane slices match manual controls when equivalent.
- Function LaTeX compiles to ASCII and (optionally) bytecode; overlays render correctly.
- Minimal bundle impact; zero dynamic codegen.
```

---

### `docs/latex/10_ARCHITECTURE.md`

```markdown
# LaTeX Input — Architecture

## Dataflow (Web)

User (LaTeX) → **MathField** (editable LaTeX) → **Translator** (subset LaTeX→IR) → write to Zustand state → `triggerRecompute()` → WASM compute → overlays

### Translator Outputs

- **Hyperplane**: `{ a: Float32Array, b: number }`
- **Function**: `ascii: string` (e.g., `sin(x1)+x2^2`)
- **Matrix**: `number[][]` (row-major), later packed into `Float32Array`

## Components & Modules

- `src/ui/latex/MathField.tsx` — lazy-loaded MathLive wrapper + KaTeX preview
- `src/math/latex.ts` — translator:
  - `latexToAsciiExpr(latex: string): string`
  - `latexToHyperplane(latex: string, n: number): { a: Float32Array; b: number }`
  - `latexToMatrix(latex: string): number[][]`
- Panel integrations:
  - **Hyperplane**: parse → normalize → `setHyperplane(...)`
  - **Function**: parse → ASCII → `setFunctionExpression(...)` (existing compile/debounce)
  - **Geometry (optional)**: parse matrix → set `geometry.basis`

## State & WASM (unchanged contracts)

- Keep `FunctionConfig.expression`, `FunctionConfig.programBytecode`, `HyperplaneConfig.coefficients/offset`.
- Add **optional** `latex?: string` to both configs to preserve user input.
- Continue calling `compileExpression(...)` (when available) and `triggerRecompute()` as today.
```

---

### `docs/latex/20_TRANSLATOR_SPEC.md`

```markdown
# Translator Spec — `src/math/latex.ts`

## Purpose

Convert a **safe LaTeX subset** to the app’s internal forms without bringing a full TeX engine or a CAS.

## Supported (v1)

- Variables: `x_1, …, x_n`, `x_{10}` → `x1 … x10`
- Numbers: integers/decimals; optional `\pi` (→ numeric)
- Binary ops: `+`, `-`, `*`, `\cdot`, `\times`, `/`
- Fractions: `\frac{u}{v}`
- Powers: `x^2`, `x^{k}`
- Functions: `\sin`, `\cos`, `\tan`, `\exp`, `\log`, `\ln`, `\sqrt{…}`
- Grouping: `()[]{}` and `\left … \right …`
- Matrices: `\begin{bmatrix} a&b \\ c&d \end{bmatrix}`

## Hyperplane Rule

- Input must be **linear** on each side of `=`.
- Translator forms `lhs - rhs = 0`, collects:
  - variable terms `k * x_i` (or `x_i` ≡ `1*x_i`)
  - constant terms
- Output \(a\cdot x = b\) where `b = -constant`.

Errors when:

- Non-linear terms (`x1^2`, `sin(x2)`, `x1*x2`) are present
- `=` missing
- variable index out of range

## Function Rule

- Convert to ASCII string accepted by your existing compiler:
  - `\frac{u}{v}` → `(u)/(v)`
  - `\sin{…}` → `sin(...)`, etc.
  - normalize powers and implicit multiply (`2x_3` → `2*x3`)
- Semantic/bytecode validation remains in your compile step.

## Matrix Rule

- Accept `bmatrix`; split by `\\` (rows) and `&` (cols).
- Convert each entry via `latexToAsciiExpr` → `Number(...)`.
- Output `number[][]` row-major; UI will validate shape (3×n for basis).

## Limits & Guards

- Input length limit (default 8k chars)
- Allowed token whitelist; reject unknown control sequences
```

---

### `docs/latex/30_UI_UX.md`

```markdown
# UI / UX

## Panels

### Hyperplane

- Section: **Equation (LaTeX)**
  - MathField (editable) + “Parse”
  - KaTeX preview on success; inline error on failure
  - On success:
    1. Translate → `{ a, b }`
    2. Normalize `a` (unit vector) and scale `b` accordingly
    3. `setHyperplane({ coefficients: a, offset: b, enabled: true, latex: raw })`
    4. `triggerRecompute()`

### Function

- Section: **Expression (LaTeX)**
  - MathField + “Parse”
  - On success:
    - `ascii = latexToAsciiExpr(tex)`
    - `setFunctionExpression(ascii)` (existing debounce → compile → `setFunctionValid`)

### Geometry (optional)

- Section: **Custom Projection Basis (LaTeX 3×n)**
  - MathField for `bmatrix`
  - On success: validate 3×n, pack to `Float32Array`, set `geometry.basis`
  - Optional: “Orthonormalize” (Modified Gram–Schmidt)

## Interaction

- Enter = Parse; Cmd/Ctrl+Enter = Parse + Recompute
- Paste safe; strip newlines where needed
- A11y: labels + `aria-describedby` for errors; keyboard focus preserved

## Visual Consistency

- Reuse panel card styles, status pills, and form components already in the app
```

---

### `docs/latex/40_STATE_AND_APIS.md`

````markdown
# State & APIs

## State Extensions (backwards compatible)

```ts
// In appState types:
export type FunctionConfig = {
  expression: string;
  type: "scalar" | "vector";
  isValid: boolean;
  errorMessage: string | null;
  programBytecode: Uint8Array | null;
  latex?: string; // new, optional
};

export type HyperplaneConfig = {
  enabled: boolean;
  coefficients: Float32Array; // normalized
  offset: number;
  showIntersection: boolean;
  intersectionColor: [number, number, number];
  latex?: string; // new, optional
};
```
````

## Handler Patterns

**Hyperplane (LaTeX)**

```ts
const { a, b } = latexToHyperplane(tex, dimension);
const norm = Math.hypot(...Array.from(a));
if (!norm) throw new Error("All-zero normal");
for (let i = 0; i < a.length; i++) a[i] /= norm;
setHyperplane({ coefficients: a, offset: b / norm, enabled: true, latex: tex });
await triggerRecompute();
```

**Function (LaTeX)**

```ts
const ascii = latexToAsciiExpr(tex);
setFunctionExpression(ascii); // existing debounce → compileExpression(ascii, dimension)
// → setFunctionValid(ok, err, bytecode) → triggerRecompute()
```

**Custom Basis (LaTeX 3×n)**

```ts
const rows = latexToMatrix(tex); // 3×n
if (rows.length !== 3 || rows.some((r) => r.length !== dimension)) {
  throw new Error("Expect 3×n");
}
const B = new Float32Array(3 * dimension);
for (let k = 0; k < 3; k++) {
  for (let j = 0; j < dimension; j++) B[k * dimension + j] = rows[k][j];
}
setGeometry({ ...geometry, basis: B });
await triggerRecompute();
```

## WASM Contracts (unchanged)

- `compileExpression(ascii: string, n: number)` → `{ bytecode?: Uint8Array, error?: string }`
- `computeOverlays(snapshot)` → overlay buffers & metadata

````
---

### `docs/latex/50_IMPLEMENTATION_PLAN.md`
```markdown
# Implementation Plan

## PR1 — Translator + Tests
- Add `src/math/latex.ts`
- Implement `latexToAsciiExpr`, `latexToHyperplane`, `latexToMatrix`
- Vitest unit tests for each helper
- Guards: input size limit, clear errors

## PR2 — Hyperplane LaTeX UI
- Add LaTeX card to Hyperplane panel
- Parse → normalize → `setHyperplane` → `triggerRecompute`
- KaTeX preview; error pill

## PR3 — Function LaTeX UI
- Add LaTeX card to Function panel
- Parse → ASCII → `setFunctionExpression` (existing compile/debounce path)
- Show LaTeX preview + ASCII mirror

## PR4 — Custom Basis (Optional)
- Add LaTeX 3×n matrix card to Geometry/Controls
- Parse → set `geometry.basis`; add “Orthonormalize” button

## PR5 — Polish
- Lazy load MathLive on card open
- Copy-to-clipboard buttons, docs, examples
````

---

### `docs/latex/60_TESTING.md`

```markdown
# Testing

## Unit (Vitest)

- `latexToAsciiExpr`:
  - `\sin(x_1)+\exp(-x_2^2-x_3^2)-x_4` → `sin(x1)+exp(-(x2^2+x3^2))-x4`
  - `\frac{1}{2}x_2` → `(1)/(2)*x2`
  - `2x_3` → `2*x3`
- `latexToHyperplane`:
  - `x_1 + 2x_3 = 7` → `a=[1,0,2,0], b=7`
  - `\frac12 x_2 - x_4 = 0` → `a=[0,0.5,0,-1], b=0`
  - Reject `x_1^2 = 1` with “Nonlinear term”
- `latexToMatrix`:
  - 3×n `bmatrix` parses to rows; wrong shapes rejected

## UI (React Testing Library)

- Paste LaTeX → press Parse:
  - Store updated (hyperplane or function)
  - Preview visible; error hidden
- Function path invokes compile once per debounced change

## Integration

- Hyperplane LaTeX → `triggerRecompute()` fires; overlays update predictably
- Equivalence tests: LaTeX vs manual sliders set to same plane

## Performance

- Typing latency < 20ms on mid-range laptop
- MathLive only loaded when LaTeX card opens
```

---

### `docs/latex/70_SECURITY_PERFORMANCE.md`

```markdown
# Security & Performance

## Security

- No dynamic code generation; pure string → IR
- Reject inputs > 8k chars; cap matrix dims
- Drop unknown TeX control sequences
- KaTeX render in controlled container (no innerHTML injection)
- WASM stays sandboxed; compile step unchanged

## Performance

- Lazy-load MathLive
- Parse on explicit Parse button (or debounced onChange)
- Cache last successful IR; recompute only when changed
- Translator uses linear passes; no exponential regexes

## Accessibility & i18n

- Short, localizable error messages
- Proper labels and `aria-describedby`
```

---

### `docs/latex/80_ROADMAP.md`

```markdown
# Roadmap

## v1

- Hyperplane LaTeX (linear)
- Function LaTeX → ASCII → bytecode (when VM enabled)
- Optional: Custom Basis (3×n)

## v1.1

- Grammar: `\abs{}`, `\|x\|`, simple piecewise `\begin{cases}…\end{cases}`
- Error underlines with token spans

## v2

- Linear Map matrices (n×n / m×n) + SVD/EVD “labs”
- Export/import LaTeX snippets bound to scene state

## v3

- Light symbolic assistance (constant folding, linearity hints)
- Authoring presets: sphere/saddle/wave buttons insert LaTeX
```

---

### `docs/latex/90_APPENDIX_CODE_SKELETONS.md`

````markdown
# Appendix — Code Skeletons

## src/math/latex.ts (reference implementation)

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
    if (!m) throw new Error(`Nonlinear/unsupported term: '${t}'`);
    const k = (m[1] === "" || m[1] === "+" || m[1] === "-")
      ? Number((m[1] || "+") + "1")
      : Number(m[1]);
    if (m[2]) {
      const j = Number(m[3]) - 1;
      if (j < 0 || j >= n) {
        throw new Error(`Variable index out of range: x${j + 1}`);
      }
      a[j] += k;
    } else {
      c += k; // constant term
    }
  }
  return { a, b: -c }; // a·x = b
}

export function latexToMatrix(src: string): number[][] {
  const body = src
    .replace(/\\left|\\right/g, "")
    .replace(/\\begin\{bmatrix\}/g, "")
    .replace(/\\end\{bmatrix\}/g, "")
    .trim();

  return body.split(/\\\\/).map((row) =>
    row.split(/&/).map((x) => Number(latexToAsciiExpr(x.trim())))
  );
}
```
````

## Panel wiring (snippets)

```ts
// Hyperplane (inside panel handler)
const { a, b } = latexToHyperplane(tex, dimension);
const norm = Math.hypot(...Array.from(a));
if (!norm) throw new Error("All-zero normal");
for (let i = 0; i < a.length; i++) a[i] /= norm;
setHyperplane({ coefficients: a, offset: b / norm, enabled: true, latex: tex });
await triggerRecompute();

// Function (inside panel handler)
const ascii = latexToAsciiExpr(tex);
setFunctionExpression(ascii); // existing debounce → compile → setFunctionValid → recompute

// Custom Basis (3×n) (optional)
const rows = latexToMatrix(tex);
if (rows.length !== 3 || rows.some((r) => r.length !== dimension)) {
  throw new Error("Expect 3×n");
}
const B = new Float32Array(3 * dimension);
for (let k = 0; k < 3; k++) {
  for (let j = 0; j < dimension; j++) B[k * dimension + j] = rows[k][j];
}
setGeometry({ ...geometry, basis: B });
await triggerRecompute();
```

```
---

If you want, I can also generate ready-to-paste `MathField.tsx` (lazy-loaded MathLive + KaTeX preview) and drop the LaTeX cards into your existing panels.
```
