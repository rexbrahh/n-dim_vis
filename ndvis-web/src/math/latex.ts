/**
 * LaTeX to ASCII expression translator for ndvis
 *
 * Converts a safe subset of LaTeX math notation to ASCII expressions
 * compatible with the ndcalc VM and hyperplane/matrix specifications.
 */

/**
 * Error thrown when LaTeX parsing fails, includes position information for debugging.
 */
export class LaTeXParseError extends Error {
  start?: number;
  end?: number;

  constructor(message: string, start?: number, end?: number) {
    super(message);
    this.name = "LaTeXParseError";
    this.start = start;
    this.end = end;
  }

  toJSON() {
    return {
      message: this.message,
      start: this.start,
      end: this.end,
    };
  }
}

const MAX_INPUT_LENGTH = 8192;

const FN_MAP = new Map([
  ["\\sin", "sin"],
  ["\\cos", "cos"],
  ["\\tan", "tan"],
  ["\\exp", "exp"],
  ["\\log", "log"],
  ["\\ln", "log"],
  ["\\sqrt", "sqrt"],
]);

/**
 * Converts LaTeX expression to ASCII format compatible with ndcalc VM.
 *
 * Supported LaTeX:
 * - Variables: x_1, x_2, ..., x_{10}
 * - Numbers: integers, decimals
 * - Binary ops: +, -, *, \cdot, \times, /, \frac{u}{v}
 * - Powers: x^2, x^{k}
 * - Functions: \sin, \cos, \tan, \exp, \log, \ln, \sqrt{...}
 * - Grouping: (), [], {}, \left...\right
 *
 * @param src LaTeX source string
 * @returns ASCII expression string (e.g., "sin(x1) + x2^2")
 * @throws {Error} If input exceeds length limit or contains unsupported syntax
 */
export function latexToAsciiExpr(src: string): string {
  if (src.length > MAX_INPUT_LENGTH) {
    throw new LaTeXParseError(
      `Input exceeds maximum length of ${MAX_INPUT_LENGTH} characters`,
      0,
      src.length
    );
  }

  let s = src.trim();

  // Remove \left and \right delimiters
  s = s.replace(/\\left|\\right/g, "");

  // Variables: x_{10} → x10, x_2 → x2
  s = s.replace(/x_\{(\d+)\}/g, "x$1");
  s = s.replace(/x_(\d+)/g, "x$1");

  // Convert fractions: \frac{u}{v} → (u)/(v)
  s = s.replace(/\\frac\s*\{([^}]*)\}\s*\{([^}]*)\}/g, "($1)/($2)");

  // Powers: ^{k} → ^(k) - do this before processing braces in functions
  s = s.replace(/\^\{([^}]+)\}/g, "^($1)");

  // Convert functions: \sin{...} → sin(...), \cos{...} → cos(...), etc.
  for (const [latex, ascii] of FN_MAP) {
    const escapedLatex = latex.replace(/\\/g, "\\\\");
    // Handle \sin{...} style
    s = s.replace(new RegExp(`${escapedLatex}\\s*\\{([^}]*)\\}`, "g"), `${ascii}($1)`);
    // Handle \sin(...) style (already has parentheses, just remove backslash+name)
    s = s.replace(new RegExp(`${escapedLatex}\\s*\\(`, "g"), `${ascii}(`);
  }

  // Binary operators: \cdot, \times → * (remove surrounding whitespace)
  s = s.replace(/\s*\\cdot\s*/g, "*");
  s = s.replace(/\s*\\times\s*/g, " * ");
  
  // Normalize multiple spaces to single space
  s = s.replace(/\s+/g, " ");

  // Implicit multiplication - comprehensive cases:
  // 1. number followed by variable: 2x1 → 2*x1
  s = s.replace(/(\d)\s*(x\d+)/g, "$1*$2");
  
  // 2. number followed by function: 2sin → 2*sin
  s = s.replace(/(\d)\s*(sin|cos|tan|exp|log|sqrt)\s*\(/g, "$1*$2(");
  
  // 3. number followed by open paren: 2( → 2*(
  s = s.replace(/(\d)\s*\(/g, "$1*(");
  
  // 4. closing paren followed by variable: )x1 → )*x1
  s = s.replace(/(\))\s*(x\d+)/g, "$1*$2");
  
  // 5. closing paren followed by function: )sin → )*sin
  s = s.replace(/(\))\s*(sin|cos|tan|exp|log|sqrt)\s*\(/g, "$1*$2(");
  
  // 6. closing paren followed by open paren: )( → )*(
  s = s.replace(/(\))\s*\(/g, "$1*(");

  return s;
}

/**
 * Parses a linear LaTeX equation into hyperplane coefficients and offset.
 *
 * Input must be of form: a_1 x_1 + ... + a_n x_n = b
 * Only linear terms are allowed (no x^2, sin(x), x*y, etc.)
 *
 * @param src LaTeX equation string with '='
 * @param n Dimension of the space
 * @returns {a, b} where a is the normalized coefficient vector and b is the offset
 * @throws {Error} If equation is non-linear, malformed, or variables are out of range
 */
export function latexToHyperplane(
  src: string,
  n: number
): { a: Float32Array; b: number } {
  if (src.length > MAX_INPUT_LENGTH) {
    throw new LaTeXParseError(
      `Input exceeds maximum length of ${MAX_INPUT_LENGTH} characters`,
      0,
      src.length
    );
  }

  // Split on '=' to get LHS and RHS
  const eqIndex = src.indexOf("=");
  const parts = src.split("=");
  if (parts.length !== 2) {
    throw new LaTeXParseError(
      "Expected an equation with exactly one '='",
      0,
      src.length
    );
  }

  const [lhsRaw, rhsRaw] = parts.map((s) => s.trim());
  if (!lhsRaw || !rhsRaw) {
    const emptyStart = !lhsRaw ? 0 : eqIndex + 1;
    const emptyEnd = !lhsRaw ? eqIndex : src.length;
    throw new LaTeXParseError(
      "Both sides of the equation must be non-empty",
      emptyStart,
      emptyEnd
    );
  }

  // Convert both sides to ASCII
  const lhs = latexToAsciiExpr(lhsRaw);
  const rhs = latexToAsciiExpr(rhsRaw);

  // Move everything to LHS: (lhs) - (rhs) = 0
  const expr = `(${lhs})-(${rhs})`;

  // Parse linear terms
  const a = new Float32Array(n);
  let c = 0; // constant term

  // Normalize whitespace
  let processed = expr.replace(/\s+/g, "");

  // Handle subtraction of grouped expressions by distributing the minus sign
  // Replace -(anything) with +(-1)*(anything), then expand
  while (processed.includes("-(")) {
    // Find the matching closing paren
    const startIdx = processed.indexOf("-(");
    let parenCount = 0;
    let endIdx = startIdx + 2;
    
    for (; endIdx < processed.length; endIdx++) {
      if (processed[endIdx] === "(") parenCount++;
      if (processed[endIdx] === ")") {
        if (parenCount === 0) break;
        parenCount--;
      }
    }
    
    // Get the content inside the parens
    const inside = processed.substring(startIdx + 2, endIdx);
    
    // Negate all signs in the inside: + becomes -, - becomes +
    let negated = inside.replace(/\+/g, "§").replace(/-/g, "+").replace(/§/g, "-");
    // If it doesn't start with a sign, add -
    if (!/^[+-]/.test(negated)) {
      negated = "-" + negated;
    }
    
    // Replace the -(expr) with the negated version
    processed = processed.substring(0, startIdx) + "+" + negated + processed.substring(endIdx + 1);
  }

  // Now remove all remaining parentheses
  processed = processed.replace(/[()]/g, "");

  // Evaluate division operations
  processed = processed.replace(/(\d+\.?\d*)\/(\d+\.?\d*)/g, (match, num, den) => {
    return String(Number(num) / Number(den));
  });

  // Tokenize by splitting on + and -
  const normalized = processed.replace(/-/g, "+-");
  const tokens = normalized
    .split("+")
    .map((t) => t.trim())
    .filter(Boolean);

  for (const token of tokens) {
    const t = token.trim();
    if (!t) continue;

    // Try to match: [coefficient]*x[index] or just constant
    // Pattern: optional sign, optional number (including decimals), optional *, optional x and digit
    const match = t.match(/^([+-]?\d*\.?\d*)\*?(x(\d+))?$/);

    if (!match) {
      // Try to find the token position in the original source for better error reporting
      const tokenPos = src.indexOf(token.replace(/[()]/g, ""));
      throw new LaTeXParseError(
        `Nonlinear or unsupported term: '${token}'. Only linear combinations are allowed for hyperplanes.`,
        tokenPos >= 0 ? tokenPos : 0,
        tokenPos >= 0 ? tokenPos + token.length : src.length
      );
    }

    const coeffStr = match[1];
    const hasVariable = Boolean(match[2]);
    const varIndexStr = match[3];

    // Parse coefficient
    let coeff: number;
    if (coeffStr === "" || coeffStr === "+") {
      coeff = 1;
    } else if (coeffStr === "-") {
      coeff = -1;
    } else {
      coeff = Number(coeffStr);
      if (!Number.isFinite(coeff)) {
        throw new LaTeXParseError(`Invalid coefficient: '${coeffStr}'`);
      }
    }

    if (hasVariable) {
      const varIndex = Number(varIndexStr) - 1; // Convert to 0-based
      if (varIndex < 0 || varIndex >= n) {
        throw new LaTeXParseError(
          `Variable index out of range: x${varIndex + 1} (dimension is ${n})`
        );
      }
      a[varIndex] += coeff;
    } else {
      // Constant term
      if (coeff !== 0) {
        c += coeff;
      }
    }
  }

  // Result: sum(a_i * x_i) + c = 0
  // Rearrange to: sum(a_i * x_i) = -c
  // Standard form: a · x = b where b = -c
  let b = -c;
  
  // Handle -0 case (JavaScript quirk)
  if (Object.is(b, -0)) {
    b = 0;
  }

  return { a, b };
}

/**
 * Parses a LaTeX matrix (bmatrix) into a 2D number array.
 *
 * Supports: \begin{bmatrix} a & b & c \\ d & e & f \end{bmatrix}
 *
 * @param src LaTeX matrix string
 * @returns 2D array of numbers (row-major)
 * @throws {Error} If matrix syntax is invalid or entries cannot be parsed
 */
export function latexToMatrix(src: string): number[][] {
  if (src.length > MAX_INPUT_LENGTH) {
    throw new LaTeXParseError(
      `Input exceeds maximum length of ${MAX_INPUT_LENGTH} characters`,
      0,
      src.length
    );
  }

  // Remove \left, \right, \begin{bmatrix}, \end{bmatrix}
  const body = src
    .replace(/\\left|\\right/g, "")
    .replace(/\\begin\{bmatrix\}/g, "")
    .replace(/\\end\{bmatrix\}/g, "")
    .trim();

  if (!body) {
    throw new LaTeXParseError("Empty matrix", 0, src.length);
  }

  // Split by \\ to get rows
  const rowStrings = body.split(/\\\\/);

  const rows: number[][] = [];
  for (let i = 0; i < rowStrings.length; i++) {
    const rowStr = rowStrings[i].trim();
    if (!rowStr) continue;

    // Split by & to get columns
    const colStrings = rowStr.split(/&/);
    const row: number[] = [];

    for (let j = 0; j < colStrings.length; j++) {
      const cellStr = colStrings[j].trim();
      if (!cellStr) {
        throw new LaTeXParseError(`Empty cell at row ${i + 1}, column ${j + 1}`);
      }

      // Convert LaTeX expression to ASCII, then evaluate to number
      const ascii = latexToAsciiExpr(cellStr);
      
      // Try to evaluate simple expressions
      let value: number;
      try {
        // For simple cases, try direct number conversion
        value = Number(ascii);
        
        // If that failed but the expression looks like it might be evaluable (like (1)/(2))
        if (!Number.isFinite(value) && /^[\d+\-*/().]+$/.test(ascii)) {
          // Use Function constructor to safely evaluate arithmetic expressions
          // This is safe because we've validated the input contains only numbers and operators
          value = Function(`"use strict"; return (${ascii})`)();
        }
      } catch {
        throw new LaTeXParseError(
          `Invalid number at row ${i + 1}, column ${j + 1}: '${cellStr}'`
        );
      }

      if (!Number.isFinite(value)) {
        throw new LaTeXParseError(
          `Invalid number at row ${i + 1}, column ${j + 1}: '${cellStr}'`
        );
      }

      row.push(value);
    }

    if (row.length > 0) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    throw new LaTeXParseError("Matrix has no rows", 0, src.length);
  }

  // Validate that all rows have the same number of columns
  const colCount = rows[0].length;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].length !== colCount) {
      throw new LaTeXParseError(
        `Inconsistent row lengths: row 1 has ${colCount} columns, row ${i + 1} has ${rows[i].length} columns`
      );
    }
  }

  return rows;
}

/**
 * Validates a hyperplane by checking that the normal vector is non-zero.
 *
 * @param a Coefficient vector
 * @returns true if valid (non-zero normal), false otherwise
 */
export function validateHyperplane(a: Float32Array): boolean {
  let normSquared = 0;
  for (let i = 0; i < a.length; i++) {
    normSquared += a[i] * a[i];
  }
  return normSquared > 0;
}

/**
 * Normalizes a hyperplane coefficient vector to unit length.
 *
 * @param a Coefficient vector (modified in place)
 * @param b Offset scalar
 * @returns Normalized {a, b} where ||a|| = 1
 * @throws {Error} If the normal vector is zero
 */
export function normalizeHyperplane(
  a: Float32Array,
  b: number
): { a: Float32Array; b: number } {
  let norm = 0;
  for (let i = 0; i < a.length; i++) {
    norm += a[i] * a[i];
  }
  norm = Math.sqrt(norm);

  if (norm === 0) {
    throw new LaTeXParseError("Cannot normalize zero normal vector");
  }

  for (let i = 0; i < a.length; i++) {
    a[i] /= norm;
  }
  b /= norm;

  return { a, b };
}
