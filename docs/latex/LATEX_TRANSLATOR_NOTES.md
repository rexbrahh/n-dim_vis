# LaTeX Translator Implementation Notes

## Summary

The LaTeX translator (`src/math/latex.ts`) has been successfully implemented with comprehensive test coverage (60 tests, all passing).

## Recent Updates (Post-Review)

### Implicit Multiplication Enhancements
Extended implicit multiplication to handle all common cases:
- `2\sin(x_1)` → `2*sin(x1)` (number followed by function)
- `2(x_1 + 1)` → `2*(x1 + 1)` (number followed by parenthesis)
- `(x_1)(x_2)` → `(x1)*(x2)` (closing paren followed by opening paren)
- `(x_1)\sin(x_2)` → `(x1)*sin(x2)` (closing paren followed by function)
- `\frac{1}{2}\sin(x_1)` → `(1)/(2)*sin(x1)` (complex combinations)

### Error Handling Improvements
Replaced generic `Error` with structured `LaTeXParseError` class:
- Includes `{message, start, end}` for position tracking
- Enables UI to highlight problematic spans
- Better debugging experience for users

### Test & Build Quality
- All lint errors fixed (eslint clean)
- WASM module mocks added for test isolation
- Both `npm run lint` and `npm test -- --run` now pass cleanly

## Supported LaTeX Features

### Variables
- `x_1`, `x_2`, ..., `x_n` → `x1`, `x2`, ..., `xn`
- `x_{10}` → `x10` (multi-digit subscripts)

### Arithmetic Operations
- Addition: `+`
- Subtraction: `-`
- Multiplication: `*`, `\cdot`, `\times`
- Division: `/`, `\frac{u}{v}` → `(u)/(v)`

### Powers
- `x^2` → `x^2`
- `x^{n}` → `x^(n)`

### Functions
- Trigonometric: `\sin`, `\cos`, `\tan`
- Exponential/Log: `\exp`, `\log`, `\ln`
- Other: `\sqrt{...}`

### Grouping
- Parentheses: `()`, `\left(...\right)`
- Brackets: `[]`
- Braces: `{}`

### Matrices
- `\begin{bmatrix}...\end{bmatrix}` with `&` for columns and `\\` for rows
- Supports numeric entries and simple expressions (like `\frac{1}{2}`)

## Unsupported Patterns (v1)

### 1. Advanced Math Constructs
- **Absolute value**: `\abs{x}`, `|x|` - Not yet implemented
- **Norms**: `\|x\|` - Not yet implemented
- **Piecewise functions**: `\begin{cases}...\end{cases}` - Not yet implemented
- **Integrals/Derivatives**: `\int`, `\frac{d}{dx}` - Not mathematical expressions for the VM
- **Summation/Product**: `\sum`, `\prod` - Would need bounded evaluation

### 2. Complex Fractions
- **Nested fractions**: `\frac{\frac{1}{2}}{\frac{3}{4}}` - Works but may be confusing
- **Fractions in exponents**: `x^{\frac{1}{2}}` - Works but converts to decimal

### 3. Special Constants
- **Pi**: `\pi` - Not converted to numeric value
- **Euler's number**: `e` - Not recognized (use `\exp(1)`)
- **Other constants**: `\infty`, `\epsilon` - Not supported

### 4. Advanced Functions
- **Hyperbolic**: `\sinh`, `\cosh`, `\tanh` - Not in function map
- **Inverse trig**: `\arcsin`, `\arccos`, `\arctan` - Not in function map
- **Other**: `\floor`, `\ceil`, `\min`, `\max` - Not in function map

### 5. Hyperplane-Specific Limitations
- **Non-linear terms**: `x^2`, `\sin(x)`, `x*y` - Explicitly rejected for hyperplanes
- **Implicit forms**: `x^2 + y^2 = 1` - Must be linear for hyperplane parsing

### 6. Matrix Limitations
- **Non-numeric entries**: Variables like `x_1` in matrix entries - Not evaluated
- **Large matrices**: Input limited to 8192 characters total

## API Reference

### `latexToAsciiExpr(src: string): string`
Converts LaTeX expression to ASCII format compatible with ndcalc VM.

**Example:**
```typescript
latexToAsciiExpr("\\sin(x_1) + \\exp(-x_2^2)") 
// → "sin(x1) + exp(-x2^2)"
```

### `latexToHyperplane(src: string, n: number): {a: Float32Array, b: number}`
Parses linear LaTeX equation into hyperplane coefficients.

**Example:**
```typescript
latexToHyperplane("x_1 + 2x_3 = 7", 4)
// → {a: [1, 0, 2, 0], b: 7}
```

**Throws:** If equation contains non-linear terms or variables out of range.

### `latexToMatrix(src: string): number[][]`
Parses LaTeX bmatrix into 2D number array.

**Example:**
```typescript
latexToMatrix("\\begin{bmatrix} 1 & 0 \\\\ 0 & 1 \\end{bmatrix}")
// → [[1, 0], [0, 1]]
```

### Helper Functions
- `validateHyperplane(a: Float32Array): boolean` - Checks if normal vector is non-zero
- `normalizeHyperplane(a: Float32Array, b: number)` - Normalizes to unit normal vector

## Error Handling

All functions throw descriptive errors for:
- Input exceeding 8192 character limit
- Malformed LaTeX syntax
- Non-linear terms in hyperplanes
- Variable indices out of range
- Invalid matrix dimensions
- Non-numeric matrix entries

Errors include:
- `message`: Human-readable error description
- Context information (e.g., row/column for matrices, term causing issue)

## Testing

Comprehensive test suite in `src/__tests__/latex.spec.ts`:
- 54 tests covering all supported features
- Success cases from documentation examples
- Edge cases and error conditions
- Integration smoke tests

Run tests: `npm test -- --run src/__tests__/latex.spec.ts`

## Future Enhancements (v2)

Potential additions for future versions:
1. Support for `\abs{x}` → `abs(x)`
2. Support for piecewise functions
3. More function mappings (hyperbolic, inverse trig)
4. Symbolic constant recognition (`\pi` → `3.14159...`)
5. Error position tracking for better debugging
6. Partial derivative notation for calculus panel

## Usage in UI

The translator is designed to be integrated into:
1. **HyperplanePanel**: Parse LaTeX → update `HyperplaneConfig`
2. **FunctionPanel**: Parse LaTeX → ASCII → compile to bytecode
3. **ControlsPanel**: Parse matrix → custom projection basis

See `docs/latex/` for full integration specifications.
