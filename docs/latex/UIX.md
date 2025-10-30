# LaTeX Input — UI/UX

## Panels

### Hyperplane panel

- Card: **Equation (LaTeX)**
  - MathField (editable) + "Parse" button
  - Preview (KaTeX) shown on success
  - Status pill: ✓ valid / ✖ error (message inline)
  - On success:
    1. Translate → `{a,b}`
    2. Normalize `a` (unit length); scale `b` accordingly
    3. `setHyperplane({coefficients: a, offset: b, enabled: true, latex: raw})`
    4. `triggerRecompute()`

- The existing numeric controls remain; users can toggle between them.

### Function panel

- Card: **Expression (LaTeX)**
  - MathField + "Parse"
  - On success:
    - `ascii = latexToAsciiExpr(tex)`
    - `setFunctionExpression(ascii)` (existing debounce → compile → setFunctionValid)
  - Preview (KaTeX) of the LaTeX and a monospace mirror of ASCII

### Geometry / Controls (optional)

- Card: **Custom projection basis (LaTeX 3×n)**
  - MathField for `bmatrix`
  - On success: pack to `Float32Array(3*n)` and set `geometry.basis`
  - Warn if matrix not 3×n; button “Orthonormalize” (MGS)

## Interaction

- Keyboard: `Enter` = Parse; `Ctrl/Cmd+Enter` = Parse + Recompute
- Clipboard: paste LaTeX; strip newlines safely
- Accessibility: label + aria-describedby for error; focus outline matches app
- Internationalization: error messages are short, easily localizable
