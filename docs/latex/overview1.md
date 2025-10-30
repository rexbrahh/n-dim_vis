Below are scoped, ready-to-drop-in Markdown docs. I’ve organized them under a `docs/latex/` folder; feel free to rename.

---

## `docs/latex/README.md`

```markdown
# LaTeX Input: Design & Implementation

**Status:** Proposed\
**Owner(s):**\
**Targets:** Web UI (`ndvis-web`), Zustand store, WASM bindings

## Goals

- Make **LaTeX-centric input** first-class for:
  1. Hyperplanes: \(a \cdot x = b\)
  2. Scalar fields: \(f:\mathbb{R}^n\to\mathbb{R}\)
  3. Optional matrices: 3×n **custom basis** (linear maps later)

- Compile LaTeX → internal representations your app already uses:
  - Hyperplane → `{coefficients: Float32Array, offset: number}`
  - Function → ASCII expression → existing WASM compiler → bytecode
  - Basis → `Float32Array(3*n)` (column-major)

- **Non-goals (v1)**
  - Full TeX engine, arbitrary macros, general CAS
  - PDEs or symbolic simplification

## Why a small parser (not regex)

- Correct parentheses for nested `\frac`/`\sqrt`
- Proper unary minus handling
- Clean error spans for UI highlighting
- Deterministic output and safe numeric evaluation for matrices

## High-level Flow
```

MathField (LaTeX) ──► latex-translator (tokenize + parse + AST) │ │ Hyperplane ──► {a,b} ──► setHyperplane() ──► triggerRecompute() │ ├─ Function ──► ASCII ──► setFunctionExpression() ──► compileExpression() ──► triggerRecompute() │ └─ Matrix ──► Float32Array ──► setGeometry({ basis }) ──► triggerRecompute()

```
## Modules (web)

- `src/math/latex.ts` — tokenizer+parser+printer, hyperplane linearity collector, matrix constant evaluator
- `src/ui/latex/MathField.tsx` — MathLive wrapper (lazy-loaded)
- Panel integrations:
  - `src/panels/HyperplanePanel.tsx` — add LaTeX tab
  - `src/panels/FunctionPanel.tsx` — add LaTeX tab
  - `src/panels/GeometryPanel.tsx` (optional) — Matrix (LaTeX)

## Rollout Plan (PRs)

1. **PR1 — Parser core & tests**
2. **PR2 — Hyperplane LaTeX tab** (normalize `(a,b)`, recompute)
3. **PR3 — Function LaTeX tab** (translate → compile → recompute)
4. **PR4 — Matrix (LaTeX)** (constant-only)
5. **PR5 — Polish** (error spans, KaTeX preview, docs)

See `rollout.md` for acceptance criteria.

## Dependencies

- Render: **KaTeX** (preview)
- Editable input: **MathLive** (dynamic import on first open)
- Test: Vitest/JSDOM

## Security & Perf

- No `eval`; deterministic parser
- MathLive + KaTeX lazy-loaded
- Debounce **compilation**, not translation
```

---

## `docs/latex/architecture.md`

````markdown
# Architecture

## Components & Responsibilities

- **latex-translator (`src/math/latex.ts`)**
  - Tokenize LaTeX subset
  - Parse to AST (recursive descent)
  - Pretty-print to ASCII accepted by your VM
  - Hyperplane linearity collection to `(a,b)`
  - Matrix constant-only evaluation → `Float32Array`
  - Error model with source spans

- **MathField (`src/ui/latex/MathField.tsx`)**
  - Rich math input with MathLive
  - Emits raw LaTeX + selection info
  - On Apply: run translator; if ok, invoke appropriate state setters
  - Status chip: _Parsed ✓ / Error_; Function panel adds _Compile ✓ / Error_

- **Panels**
  - **HyperplanePanel**: `[ Sliders | LaTeX ]`
    - On Apply: `setHyperplane({coefficients, offset, enabled: true, latex })` → `triggerRecompute()`
  - **FunctionPanel**: `[ Text | LaTeX ]`
    - On Apply: `setFunctionExpression(ascii)`; debounce → `compileExpression()` → `setFunctionValid(...)` → `triggerRecompute()`
  - **GeometryPanel (optional)**: Matrix (LaTeX)
    - On Apply: `setGeometry({ basis: Float32Array(3*n) })` → `triggerRecompute()`

## State Integration (Zustand)

Minimal additions:

```ts
// Optional fields to preserve user’s TeX
type FunctionConfig = {
  // existing…
  latex?: string;
};

type HyperplaneConfig = {
  // existing…
  latex?: string;
};
```
````

No ABI changes. The WASM APIs remain:

- `compileExpression(ascii, n)` → bytecode | error
- `computeOverlays(...)` (existing entry point)

## Data Flow Diagram

```mermaid
flowchart LR
  A[MathField (LaTeX)] --> B[latex-translator]
  B -->|Hyperplane| C{valid?}
  C -- yes --> D[setHyperplane + normalize] --> E[triggerRecompute]
  B -->|Function ASCII| F[setFunctionExpression] --> G[compileExpression] --> H[setFunctionValid] --> E
  B -->|Matrix F32| I[setGeometry(basis)] --> E
  C -- no --> J[Error spans to UI]
```

## Error Handling

- Translator errors: `{message, start, end}` for UI highlighting
- Compiler errors: already surfaced by FunctionPanel; reuse same mechanism
- Dimension guard:

  - If hyperplane references `x_k` with `k>n` → translator error
  - On dimension change, revalidate stored `latex`

## A11y & UX

- Keep keyboard behavior consistent:

  - **Enter**: parse
  - **Ctrl/Cmd+Enter**: parse + apply + recompute
- Preserve existing ARIA roles and focus rings
- Avoid live compilation on every keystroke; compile on Apply or debounced changes

````
---

## `docs/latex/parser-spec.md`

```markdown
# LaTeX Translator Specification

**File:** `src/math/latex.ts`

## Scope of Grammar (v1)

- Variables: `x_1, x_2, …, x_n`  → identifiers `x1, x2, …`
- Numbers: decimal + scientific (`1.2e-3`)
- Constants: `\pi`, `e`
- Operators: `+ - * / ^`
- Grouping: `()`, `{}` (semantic), `[]` (treated as `()`)
- Macros: `\frac{A}{B}`, `\sqrt{A}`, `\sin`, `\cos`, `\tan`, `\exp`, `\log`, `\ln`
- Spacers ignored: `\left`, `\right`, `\,` and general whitespace
- **Implicit multiplication** recognized where unambiguous:
  - number·var, var·(expr), (expr)·var, number·(expr), (expr)·number
- **Hyperplane linearity** required for equality forms (see below)
- **Matrix cells**: constant-only expressions (no variables)

## Tokenization

Tokens (with source positions):
- `NUM`, `ID(x_k)`, `CONST(pi|e)`
- `PLUS`, `MINUS`, `STAR`, `SLASH`, `CARET`
- `LPAREN`, `RPAREN`, `LBRACE`, `RBRACE`, `LBRACK`, `RBRACK`
- `FRAC`, `SQRT`, `FUNC(sin|cos|tan|exp|log|ln)`
- `EQUALS` (only for hyperplane mode)

Normalize Unicode minus `−` to `-`.

## Grammar (EBNF)
````

Expr := AddSub AddSub := MulDiv ( ( "+" | "-" ) MulDiv )* MulDiv := Pow ( ( "_" | "/" | IMPL ) Pow )_ Pow := Unary ( "^" Pow )? Unary := ( "+" | "-" )? Primary Primary := Number | Var | FuncApp | Frac | Sqrt | "(" Expr ")" | "{" Expr "}" // for macro groups

FuncApp := FUNC "(" Expr ")" | FUNC "{" Expr "}"

Frac := "\frac" "{" Expr "}" "{" Expr "}" Sqrt := "\sqrt" "{" Expr "}"

Var := "x" "_" "{" DIGITS "}" | "x" "_" DIGITS Number := NUM | CONST

````
- **IMPL** denotes implicit multiplication insertion between tokens where allowed.

## AST Nodes (TypeScript)

```ts
type Node =
  | {k:'const', v:number}
  | {k:'var', j:number}                   // j ∈ [1..n]
  | {k:'unary', op:'+'|'-', arg:Node}
  | {k:'bin', op:'+'|'-'|'*'|'/'|'^', left:Node, right:Node}
  | {k:'call', fn:'sin'|'cos'|'tan'|'exp'|'log'|'sqrt', arg:Node};
````

## Pretty Printer (ASCII)

- Precedence-aware, inserts parentheses only when needed.
- Maps `\ln` → `log`, `\pi` → numeric, `e` → numeric.
- Example: `\sin(x_1)+\exp(-x_2^2 - x_3^2)-x_4` → `sin(x1)+exp(-(x2^2+x3^2))-x4`

## Hyperplane Linearity

Given `LHS = RHS`, parse both `Expr` → `AST`. Define `collect(node)` that returns `{ok, a: Float64Array, c:number}`.

Rules:

- `const k` → `{a=0, c=k, ok=true}`
- `var xj` → `{a=e_j, c=0, ok=true}`
- `unary ±u` → scale sign on collected values
- `bin +,-` → elementwise combine
- `bin *`:

  - const×linear → scale `(a,c)`
  - linear×const → scale `(a,c)`
  - else → `ok=false`
- `bin /`:

  - linear / const → scale by `1/const` if const ≠ 0
  - else → `ok=false`
- `bin ^`:

  - `xj^1` → linear; `const^k` → const
  - else → `ok=false`
- `call` → `ok=false`

Then `lhs - rhs = 0` ⇒ `(a, c)` with `a·x + c = 0`; rewrite to `a·x = -c`. **Normalize** to unit normal `(â, b̂)`.

Errors:

- Nonlinear term
- Out-of-range variable index
- Division by zero
- Missing `=`

## Matrix Evaluation

- Parse each cell with the same grammar.
- **Reject** any variable usage in matrix cells.
- Evaluate to a number (double), then pack to `Float32Array`.
- Dimensions guard (3×n for basis editor in v1).

## Public API (TS)

```ts
export type ParseOk = { ascii: string };
export type ParseErr = { message: string; start?: number; end?: number };

export function latexExprToAscii(latex: string): ParseOk | ParseErr;

export type Hyperplane = { a: Float32Array; b: number };
export function latexHyperplane(
  latex: string,
  n: number,
): Hyperplane | ParseErr;

export function latexMatrixToF32(
  latex: string,
  rows: number,
  cols: number,
): Float32Array | ParseErr;
```

## Error Model

- All errors carry `message` and best-effort `start/end` byte offsets in the original LaTeX.
- Mismatched braces/parentheses surfaces the open token’s position.

## Complexity

- Tokenization: O(len)
- Parsing: O(len) (no backtracking)
- Pretty-printing: O(nodes)
- Linearity check: O(nodes)

````
---

## `docs/latex/ui-integration.md`

```markdown
# UI Integration

## MathField (`src/ui/latex/MathField.tsx`)

**Props**
```ts
type Props = {
  value?: string;
  onChange?: (tex: string) => void;
  onApply?: (tex: string) => void;  // Enter / Apply button
  onError?: (err: {message:string; start?:number; end?:number}) => void;
  placeholder?: string;
  ariaLabel?: string;
};
````

**Behavior**

- Lazy-load MathLive on first render (dynamic `import('mathlive')`)
- Provide a basic toolbar (fraction, sqrt, subscript)
- Keyboard:

  - Enter → `onApply`
  - Ctrl/Cmd+Enter → `onApply` and focus next actionable button
- Emits raw LaTeX; no parsing inside the component

## Hyperplane Panel

**UI**

- Tabs: `[ Sliders | LaTeX ]`
- Fields: LaTeX input + preview + status chip

**Apply flow**

```ts
const res = latexHyperplane(tex, dimension);
if ("message" in res) {
  showError(res);
  return;
}
const { a, b } = res;
const mag = Math.hypot(...a);
if (mag === 0) {
  showError("Zero normal");
  return;
}
const coeffs = Float32Array.from(a, (x) => x / mag);
setHyperplane({
  coefficients: coeffs,
  offset: b / mag,
  enabled: true,
  latex: tex,
});
await triggerRecompute();
```

**Status**

- _Parsed ✓_ or _Error_ with underline
- After recompute: reuse existing overlay error surfacing

## Function Panel

**UI**

- Tabs: `[ Text | LaTeX ]`
- On Apply: translate → ASCII; call `setFunctionExpression(ascii)`
- Debounce compile as you already do, then:

  - On success: `setFunctionValid(true, null, bytecode)`; status _Compile ✓_
  - On fail: status _Compile error: msg_

**Note**

- Do not compile per keystroke; compile on Apply or debounced

## Geometry Panel (optional Matrix)

**UI**

- Card: “Custom basis (LaTeX 3×n)”
- On Apply:

```ts
const arr = latexMatrixToF32(tex, 3, dimension);
if ("message" in (arr as any)) {
  showError(arr as any);
  return;
}
setGeometry({ ...geometry, basis: arr as Float32Array });
await triggerRecompute();
```

- Guard: if dimension changes, revalidate shape (3×n) and content

## Rendering

- KaTeX preview in each panel:

  - Render only post-parse to avoid flicker
  - Preload KaTeX CSS with `<link rel="preload">`

## Accessibility

- ARIA labels on inputs and Apply buttons
- Error messages associated via `aria-describedby`
- Maintain focus order and keyboard hints

````
---

## `docs/latex/testing.md`

```markdown
# Testing Plan

**Framework**: Vitest + @testing-library/react

## Unit: Parser (latex.ts)

**Happy path**
- `x_1 + 2x_3 = 7` → `a=[1,0,2,...]; b=7`
- `\frac12 x_2 - x_4 = 0` → `a=[0,0.5,0,-1,...]; b=0`
- `-(x_1) + 3 = \frac{\pi}{2}` → `a=[-1,0,...]; b≈1.57079632679 - 3`
- `\sin(x_1)+\exp(-x_2^2-x_3^2)-x_4` → ASCII `sin(x1)+exp(-(x2^2+x3^2))-x4`
- Matrix: `\begin{bmatrix} 1 & \frac12 \\ -\sqrt{2}/2 & \pi \end{bmatrix}` → `[1,0.5,-0.70710678,3.14159265]`

**Rejections**
- Hyperplane: `x_1 x_2 = 1` (nonlinear)
- Hyperplane: `\sin(x_1)=0` (nonlinear)
- Hyperplane: `x_1^2 = 1` (nonlinear)
- Matrix: any variable presence
- Mismatched braces/parentheses
- Variable index out-of-range for given `n`

**Edge cases**
- Nested: `\frac{1}{1+\frac{1}{2}}`
- Unicode minus `−`
- Implicit multiplication: `(x_1)(x_2)` → allowed in function expressions, still rejected by linearity in hyperplanes

## Unit: Pretty Printer

- Parentheses correctness for precedence:
  - `-(x1+x2)` → `-(x1+x2)`
  - `x1^2^3` → `x1^(2^3)` (right-assoc)
  - `1/(1+x1^2)` → `(1)/(1+(x1^2))`

## Integration: Panels

- **HyperplanePanel**
  - Paste LaTeX → Apply → `setHyperplane` called with normalized `(a,b)` → `triggerRecompute` fired
  - Error span rendered when translator rejects

- **FunctionPanel**
  - Paste LaTeX → Apply → `setFunctionExpression` called → `compileExpression` (mock) → success & error states

- **Matrix**
  - Paste 3×n LaTeX → Apply → `setGeometry(...basis)` → recompute
  - Dimension change invalidates previous basis

## E2E (optional / smoke)

- Load app → enter LaTeX for hyperplane & function → see overlays update
- Basic perf check: typing in MathField doesn’t jank main thread (lazy load confirmed)

## Coverage Goals

- Parser branches ≥ 90%
- UI integrations for success/error paths ≥ 80%
````

---

## `docs/latex/rollout.md`

```markdown
# Rollout & PR Breakdown

## PR1 — Parser Core

**Changes**

- `src/math/latex.ts`: tokenizer, parser, pretty printer, linearity collector, matrix evaluator
- Tests: `src/math/latex.spec.ts`

**Acceptance**

- All unit tests in `testing.md` (parser section) pass
- Bundle size impact ≤ ~5–8 KB gzipped

## PR2 — Hyperplane LaTeX

**Changes**

- Panel tab + Apply flow + KaTeX preview
- Status chip (“Parsed ✓ / Error”)
- Dimension guard

**Acceptance**

- Valid LaTeX normalizes `(a,b)` and triggers recompute
- Error spans visible; aria-described error announced

## PR3 — Function LaTeX

**Changes**

- Panel tab + Apply flow
- Debounced compilation; status chips (“Parsed ✓ / Compile ✓”)

**Acceptance**

- Correct ASCII fed to compiler
- Compiler errors shown; success path triggers recompute

## PR4 — Matrix (LaTeX)

**Changes**

- Optional: Geometry panel card
- Constant-only numeric evaluation; shape guard 3×n

**Acceptance**

- Basis updates the projection when applied
- Variables in matrix → clear error; no state changes

## PR5 — Polish

**Changes**

- Error span underlines (token offsets)
- KaTeX preload; UI docs entry

**Acceptance**

- No regressions; UX verified across browsers

## Telemetry (optional)

- Count Apply attempts, parse success/fail, compile success/fail
- Dimension mismatch occurrences
```

---

## `docs/latex/api.md`

````markdown
# API Reference (Translator)

**File:** `src/math/latex.ts`

```ts
export type ParseOk = { ascii: string };
export type ParseErr = { message: string; start?: number; end?: number };

export function latexExprToAscii(latex: string): ParseOk | ParseErr;

export type Hyperplane = { a: Float32Array; b: number };
export function latexHyperplane(
  latex: string,
  n: number,
): Hyperplane | ParseErr;

// Constant-only matrix expressions; throws if vars appear
export function latexMatrixToF32(
  latex: string,
  rows: number,
  cols: number,
): Float32Array | ParseErr;
```
````

**Notes**

- `start/end` are byte offsets into the original LaTeX; use to underline error spans
- `latexHyperplane` validates linearity; will reject nonlinear inputs
- `latexMatrixToF32` forbids variables for v1; future versions may allow symbolic inputs with evaluation later in the pipeline

````
---

## `docs/latex/open-questions.md`

```markdown
# Open Questions

1. **Implicit multiplication breadth**: keep limited set (number·var, var·(expr), …) or expand?
2. **Absolute value & norms**: do we add `\lvert x\rvert`, `\|x\|` now or later?
3. **Piecewise functions**: syntax (`\begin{cases}`) for v2?
4. **Matrix shapes**: allow n×n linear maps in v1, or defer?
5. **Internationalization**: error messages only in English for now?

**Default**: keep v1 strict; expand after usage data.
````

---

### Notes

- These docs assume your current Web UI and store structure; no WASM ABI changes required.
- If you want, I can also generate code skeletons (`src/math/latex.ts`, `MathField.tsx`, minimal panel patches) in a follow-up.

Below is a set of repo‑ready Markdown docs you can drop under `docs/latex/`. They’re split by scope and written to be directly actionable.

---

## `docs/latex/README.md`

```markdown
# LaTeX Input for HyperViz — Overview

This set of documents defines how to make **LaTeX-centric input** first‑class in HyperViz, wired into the existing Zustand store, WASM bindings, and panels.

**Why**

- Users can type math naturally.
- We compile LaTeX → ASCII expression → existing WASM compiler/VM → overlays.
- Hyperplanes and matrices become less error‑prone to enter.

**What’s included**

- [Goals & Scope](./GOALS_SCOPE.md)
- [Architecture](./ARCHITECTURE.md)
- [Parser Spec](./PARSER_SPEC.md)
- [API Contracts](./API_CONTRACTS.md)
- [UI Integration](./UI_INTEGRATION.md)
- [Errors & Validation](./ERRORS_VALIDATION.md)
- [Testing Plan](./TESTING.md)
- [Rollout Plan](./ROLLOUT.md)
- [Performance & Security](./PERF_SECURITY.md)

**Non‑goals (v1)**

- Full TeX engine/CAS.
- Arbitrary TeX macros.
- General PDE solvers.
```

---

## `docs/latex/GOALS_SCOPE.md`

```markdown
# Goals & Scope

## Primary Goals

1. **Hyperplane input via LaTeX**\
   Accept equations like `x_1 + 2x_3 = 7`, parse and validate as linear.\
   Output normalized `(a, b)` for `a·x = b`.

2. **Scalar function input via LaTeX**\
   Accept scalar fields `f: R^n → R` like `\sin(x_1) + \exp(-x_2^2)`.\
   Translate to ASCII the existing compiler accepts (e.g., `sin(x1)+exp(-(x2^2))`).

3. **Optional: 3×n basis matrix via LaTeX**\
   Accept `\begin{bmatrix} ... \end{bmatrix}` with **constant-only** cells.\
   Write to `geometry.basis` (column-major 3×n).

## Explicit Non‑Goals (v1)

- Symbolic simplification or algebraic manipulation.
- User-defined functions/macros.
- Matrices with variables.
- Implicit vector norms, piecewise, integrals (can be v2+).

## Acceptance Criteria

- Hyperplane LaTeX tab: valid linear equations apply immediately; invalid show precise errors.
- Function LaTeX tab: successful parse + compile or a clear error from either stage.
- Matrix LaTeX tab (optional): constants evaluate; variables rejected with a clear error.
- No ABI changes to the WASM layer.
- Unit and integration tests cover listed cases; CI green.
```

---

## `docs/latex/ARCHITECTURE.md`

```markdown
# Architecture

## High-Level Flow (Web)
```

MathField (LaTeX) ↓ latex-translator (subset parser) ├── Hyperplane: AST → linear collector → (a, b) ├── Function: AST → ASCII → compileExpression() (existing) └── Matrix: AST(cell) → constant eval → Float32Array ↓ Zustand store mutations (setHyperplane / setFunctionExpression / setGeometry) ↓ triggerRecompute() // existing async recompute pipeline ↓ Overlays + errors updated in store, panels subscribe

```
## Modules
- `src/math/latex.ts` — tokenizer + recursive‑descent parser + converters.
- `src/ui/latex/MathField.tsx` — wrapper for MathLive (lazy import) + KaTeX preview.
- Minimal changes in `HyperplanePanel.tsx`, `FunctionPanel.tsx`, and (optional) `GeometryPanel.tsx`.

## Key Principles
- **Small, explicit grammar** (subset of LaTeX).
- **AST‑based translation** (no brittle regex chains).
- **Separation of concerns**: translate → compile (function), validate linearity (hyperplane), constant‑evaluate (matrix).
- **No WASM ABI changes**. Existing `compileExpression` and recompute flow remain intact.

## State Model Additions (non‑breaking)
- `FunctionConfig.latex?: string`
- `HyperplaneConfig.latex?: string`

Other state fields and mutations unchanged.
```

---

## `docs/latex/PARSER_SPEC.md`

```markdown
# Parser Spec (subset LaTeX → AST → ASCII / numeric)

## Tokenization

Recognize:

- Identifiers: `x`, `x_1`, `x_{12}`
- Numbers: decimal + scientific notation
- Operators: `+ - * / ^`
- Grouping: `(` `)` `{` `}`
- Macros: `\frac`, `\sqrt`, `\sin`, `\cos`, `\tan`, `\exp`, `\log`, `\ln`
- Constants: `\pi`, `e`
- Spacers to ignore: `\left`, `\right`
- Unicode minus `−` normalized to `-`

## Grammar (EBNF)
```

Expr := Term (('+' | '-') Term)* Term := Factor (('_' | '/') Factor)_ Factor := Prefix? Power Prefix := '+' | '-' Power := Primary ('^' Power)? // right-associative Primary := Number | Variable | '(' Expr ')' | Macro | ImplicitMul // see below Macro := '\frac' '{' Expr '}' '{' Expr '}' | '\sqrt' '{' Expr '}' | FuncName Arg FuncName := '\sin' | '\cos' | '\tan' | '\exp' | '\log' | '\ln' Arg := '(' Expr ')' | '{' Expr '}' Variable := 'x' '_' Number | 'x' '_' '{' Number '}' | 'x' Number | 'x' Number := [0-9]+ ('.' [0-9]*)? ( [eE] [+-]? [0-9]+ )?

```
### Implicit Multiplication
Allowed forms, converted to explicit `*` during AST build:
- `Number Variable`  → `Number * Variable`
- `) Variable`       → `(…) * Variable`
- `Variable (`       → `Variable * ( … )`
- `) (`              → `(…) * ( … )`

Disallowed for **hyperplane linearity** if it creates nonlinearity (e.g., `x_1 x_2`).

## Output Forms

### 1) Function (ASCII)
- Pretty‑print to the compiler’s ASCII:
  - `\frac{A}{B}` → `(A)/(B)`
  - `\sqrt{A}` → `sqrt(A)`
  - macros → function calls without backslashes
  - `x_{k}` → `xk`
  - Insert parentheses to preserve precedence.
- Preserve unary minus and right‑assoc exponentiation.

### 2) Hyperplane (linear)
- Parse `lhs = rhs` → build ASTs for both.
- **Collect linear coefficients** by structural rules:

Collector returns `({ok, a[0..n-1], c})` for node `N`:
```

Const k: ok, a=0, c=k Var x_j: ok, a=e_j, c=0 Add/Sub u,v: ok if both ok → elementwise +/- of (a,c) Mul u,v: if U.ok && V.ok: if U.a==0 → scale(V, U.c) else if V.a==0 → scale(U, V.c) else → not ok (nonlinear) else → not ok Pow u, Const 1: collect(u) Pow Const k: ok, a=0, c=pow(Const,k) Pow _ _ : not ok Func _ : not ok

```
- Combine: `lhs - rhs` → `(a, c)` with `a·x + c = 0` ⇒ `b = -c`.
- Normalize `(a, b)` to unit normal.

### 3) Matrix (constants only)
- Parse cells with the same grammar, **reject variables**.
- Evaluate numeric value:
  - Allowed: numbers, `\pi`, `e`, `+ - * / ^`, `\frac`, `\sqrt`, and listed functions with constant args.
  - Domain checks: `sqrt` input must be ≥ 0; `log/ln` input > 0.
- Write to `Float32Array` row-major or column‑major as required by the geometry state (3×n column‑major).

## Error Model
- On tokenizer/parse error: `{message, start?, end?}` (character offsets in source).
- On linearity violation, domain errors, out‑of‑range variable indices: same error shape.
```

---

## `docs/latex/API_CONTRACTS.md`

````markdown
# API Contracts (TypeScript)

## Module: src/math/latex.ts

```ts
export type ParseOk = { ascii: string };
export type ParseErr = { message: string; start?: number; end?: number };

export function latexExprToAscii(latex: string): ParseOk | ParseErr;

export type HyperplaneResult =
  | { a: Float32Array; b: number } // normalized to ||a|| = 1
  | ParseErr;

export function latexHyperplane(latex: string, n: number): HyperplaneResult;

export type MatrixResult =
  | Float32Array // constant-evaluated
  | ParseErr;

export function latexMatrixToF32(
  latex: string,
  rows: number,
  cols: number,
): MatrixResult;
```
````

## State (non‑breaking additions)

```ts
// FunctionConfig: add an optional LaTeX mirror
export type FunctionConfig = {
  // existing fields...
  latex?: string;
};

// HyperplaneConfig: add an optional LaTeX mirror
export type HyperplaneConfig = {
  // existing fields...
  latex?: string;
};
```

## Panel Callbacks (illustrative)

```ts
// Hyperplane panel
function onApplyHyperplaneLaTeX(tex: string, n: number) {
  const res = latexHyperplane(tex, n);
  if ("message" in res) return showError(res);
  const { a, b } = res;
  setHyperplane({ coefficients: a, offset: b, enabled: true, latex: tex });
  return triggerRecompute();
}

// Function panel
function onApplyFunctionLaTeX(tex: string) {
  const r = latexExprToAscii(tex);
  if ("message" in r) return showError(r);
  setFunctionExpression(r.ascii); // existing debounce → compileExpression() → setFunctionValid()
  setFunctionConfig({ latex: tex });
}

// Geometry: 3×n basis
function onApplyBasisMatrixLaTeX(tex: string, n: number) {
  const arr = latexMatrixToF32(tex, 3, n);
  if ("message" in (arr as any)) return showError(arr as any);
  setGeometry({ basis: arr as Float32Array });
  return triggerRecompute();
}
```

````
---

## `docs/latex/UI_INTEGRATION.md`

```markdown
# UI Integration

## Components
- `src/ui/latex/MathField.tsx`: thin wrapper around MathLive (lazy import).
  - Props: `{ value?: string; onChange(tex), onSubmit?(), onValidate?(ok,msg?) }`
- Use KaTeX for read-only preview (on successful parse).

## Panels

### Hyperplane Panel
Add a **LaTeX** tab next to existing sliders.
- Field: MathField (LaTeX)
- Actions:
  - Parse immediately (no debounce), show status chip.
  - On “Apply” or Enter: call `latexHyperplane()`. On success: `setHyperplane()`, `triggerRecompute()`.
- Validation guard:
  - Variable indices `x_k` must satisfy `1 ≤ k ≤ n`.
  - Linearity enforced by collector.

### Function Panel
Add a **LaTeX** tab above the ASCII textarea.
- Field: MathField (LaTeX)
- Actions:
  - Translate on change; if ok, store `FunctionConfig.latex`.
  - Debounce the **compile step only** (ASCII string) via existing flow.
- Status chips: “Parsed ✓” and “Compiled ✓/error”.

### Geometry Panel (optional)
Add **Basis (LaTeX Matrix)**.
- Field: textarea or MathField (if desired).
- On Apply:
  - `latexMatrixToF32(tex, 3, dimension)` → set `geometry.basis` (column‑major 3×n).
  - Reject variables and non-constant expressions.

## UX Details
- Enter = parse & apply; Ctrl/Cmd+Enter = parse & apply & trigger recompute (if different).
- Error spans: underline offending range if `start/end` provided.
- Lazy load MathLive on first open of any LaTeX tab to keep initial bundle small.
````

---

## `docs/latex/ERRORS_VALIDATION.md`

````markdown
# Errors & Validation

## Error Shape

```ts
type ParseErr = { message: string; start?: number; end?: number };
```
````

## Common Errors and Messages

- **Tokenizer**: unknown token → `Unknown symbol '\abc'` (span)
- **Braces/Parentheses**: `Mismatched braces` or `Unexpected ')'` (span)
- **Function Arguments**: `Expected argument for \sin` (span)
- **Hyperplane Linearity**: `Nonlinear term 'x1*x2' not allowed in hyperplane`
- **Variable Index**: `x7 out of range for dimension n=4`
- **Matrix Variables**: `Matrix cells must be constant-only`
- **Domain**:

  - `sqrt` argument negative → `sqrt domain error: value < 0`
  - `log/ln` argument non-positive → `log domain error: value ≤ 0`

## Validation Guards

- **Dimension change**:

  - Hyperplane LaTeX must be revalidated; disable “Apply” if indices exceed `n`.
  - Function LaTeX → recompile; compiler errors propagate as usual.
- **Matrix shape**: enforce exact `3×n` for basis input in v1.

````
---

## `docs/latex/TESTING.md`

```markdown
# Testing Plan

## Unit Tests (Vitest)

### Parser: expressions → ASCII
- `\sin(x_1)+\exp(-x_2^2 - x_3^2)-x_4`
  → `sin(x1)+exp(-(x2^2+x3^2))-x4`
- `\frac{1}{1+x_1^2}` → `(1)/(1+(x1^2))`
- `\sqrt{x_2}` → `sqrt(x2)`
- Nested fraction: `\frac{1}{1+\frac{1}{2}}`
- Unary minus: `-(x_1) + 3`
- Constants: `\pi/2`, `e^2`

### Hyperplane linearity
- `x_1 + 2x_3 = 7` → `a=[1,0,2,...], b=7`
- `\frac12 x_2 - x_4 = 0` → `a=[0,0.5,0,-1,...], b=0`
- `-(x_1) + 3 = \frac{\pi}{2}` → proper `a,b`
- Reject: `x_1 x_2 = 1`, `x_1^2 = 1`, `\sin(x_1) = 0`

### Matrix evaluation
- `\begin{bmatrix} 1 & \frac12 \\ -\sqrt{2}/2 & \pi \end{bmatrix}`
  → `[1, 0.5, -0.70710678..., 3.14159265...]`
- Reject variables in cells.

### Error spans
- Mismatched braces → span around the unmatched brace.
- Unknown macro → span on macro name.

## Integration Tests
- Hyperplane tab: type valid LaTeX → on Apply → store updated, recompute fired, overlays present.
- Function tab: type valid LaTeX → ASCII set → compile invoked; success/error chip matches.
- Matrix tab: constant matrix applies; variable matrix rejected.

## Performance Sanity
- Parser throughput ≥ 100k chars/sec on desktop.
- MathLive lazy load successful (network panel shows chunked load); no layout shift.

## CI
- Add test suite `latex.spec.ts` and UI specs.
- Ensure coverage thresholds for lexer/parser and collectors.
````

---

## `docs/latex/ROLLOUT.md`

```markdown
# Rollout Plan

## Milestones & PRs

**PR1 — Parser + Tests**

- `src/math/latex.ts` (tokenizer, parser, AST → ASCII, linear collector, const evaluator).
- Unit tests for expressions, hyperplane, matrices, error spans.

**PR2 — Hyperplane LaTeX**

- Hyperplane panel tab + basic KaTeX preview.
- Hook `latexHyperplane` → `setHyperplane` → `triggerRecompute`.
- Error UI (inline with spans).

**PR3 — Function LaTeX**

- Function panel tab.
- Hook `latexExprToAscii` → `setFunctionExpression` (existing debounce → compile).
- Status chips: Parsed & Compiled.

**PR4 — Matrix (LaTeX) (optional)**

- Geometry tab addition.
- `latexMatrixToF32` → `geometry.basis`.
- Shape and constant-only validation.

**PR5 — Polish**

- Better inline error highlighting.
- Keyboard shortcuts (Enter / Cmd+Enter).
- Docs page and examples.

## Feature Flag

- Wrap LaTeX tabs behind `ENABLE_LATEX=true` for initial rollouts.

## Acceptance Gate

- All acceptance criteria satisfied (see Goals & Scope).
- No regressions in existing ASCII paths.
```

---

## `docs/latex/PERF_SECURITY.md`

```markdown
# Performance & Security

## Performance

- Parser is O(n) over input size; allocations are minimal.
- Debounce only the **compile** step for functions; translation is cheap.
- Load MathLive lazily on first open; prefetch KaTeX CSS/fonts.

## Security & Robustness

- No `eval` or dynamic code generation.
- Explicit grammar; reject unknown macros.
- Matrix cells: constant-only; variables are errors.
- Domain checks for `sqrt`, `log`, `ln`.
- Input size guardrails:
  - Max LaTeX length per field (e.g., 10k chars).
  - Max matrix dims for v1 (exactly 3×n).

## Telemetry (optional)

- Track parse errors (types, spans) to inform grammar extensions.
- Track compile success/latency separately from parse.
```

---

### Notes

- These docs assume existing state APIs: `setHyperplane`, `setFunctionExpression`, `triggerRecompute`, and the compile step that returns bytecode and errors.
- If you want, I can also provide a starter `src/math/latex.ts` implementation (≈200–250 LOC) that follows this spec so you can land **PR1** immediately.
