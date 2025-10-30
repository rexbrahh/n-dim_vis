/**
 * Tests for LaTeX translator
 */

import { describe, it, expect } from "vitest";
import {
  latexToAsciiExpr,
  latexToHyperplane,
  latexToMatrix,
  validateHyperplane,
  normalizeHyperplane,
} from "@/math/latex";

describe("latexToAsciiExpr", () => {
  describe("basic expressions", () => {
    it("converts simple variable expressions", () => {
      expect(latexToAsciiExpr("x_1")).toBe("x1");
      expect(latexToAsciiExpr("x_2")).toBe("x2");
      expect(latexToAsciiExpr("x_{10}")).toBe("x10");
    });

    it("converts addition and subtraction", () => {
      expect(latexToAsciiExpr("x_1 + x_2")).toBe("x1 + x2");
      expect(latexToAsciiExpr("x_1 - x_2")).toBe("x1 - x2");
    });

    it("converts multiplication operators", () => {
      expect(latexToAsciiExpr("2\\cdot x_1")).toBe("2*x1");
      expect(latexToAsciiExpr("x_1 \\times x_2")).toBe("x1 * x2");
      expect(latexToAsciiExpr("3x_2")).toBe("3*x2");
    });
  });

  describe("fractions", () => {
    it("converts simple fractions", () => {
      expect(latexToAsciiExpr("\\frac{1}{2}")).toBe("(1)/(2)");
      expect(latexToAsciiExpr("\\frac{x_1}{2}")).toBe("(x1)/(2)");
    });

    it("converts fractions with expressions", () => {
      expect(latexToAsciiExpr("\\frac{1}{2}x_2")).toBe("(1)/(2)*x2");
      expect(latexToAsciiExpr("\\frac{x_1 + x_2}{x_3}")).toBe("(x1 + x2)/(x3)");
    });
  });

  describe("powers", () => {
    it("converts simple powers", () => {
      expect(latexToAsciiExpr("x_1^2")).toBe("x1^2");
      expect(latexToAsciiExpr("x_2^{3}")).toBe("x2^(3)");
    });

    it("converts power expressions", () => {
      expect(latexToAsciiExpr("x_1^{2} + x_2^{2}")).toBe("x1^(2) + x2^(2)");
    });
  });

  describe("functions", () => {
    it("converts trigonometric functions", () => {
      expect(latexToAsciiExpr("\\sin{x_1}")).toBe("sin(x1)");
      expect(latexToAsciiExpr("\\cos{x_2}")).toBe("cos(x2)");
      expect(latexToAsciiExpr("\\tan{x_3}")).toBe("tan(x3)");
    });

    it("converts exponential and logarithmic functions", () => {
      expect(latexToAsciiExpr("\\exp{x_1}")).toBe("exp(x1)");
      expect(latexToAsciiExpr("\\log{x_2}")).toBe("log(x2)");
      expect(latexToAsciiExpr("\\ln{x_3}")).toBe("log(x3)");
    });

    it("converts sqrt function", () => {
      expect(latexToAsciiExpr("\\sqrt{x_1}")).toBe("sqrt(x1)");
    });

    it("converts nested function calls", () => {
      expect(latexToAsciiExpr("\\sin{\\cos{x_1}}")).toBe("sin(cos(x1))");
    });
  });

  describe("complex expressions from docs", () => {
    it("converts the saddle function example", () => {
      const latex = "\\sin(x_1)+\\exp(-x_2^2-x_3^2)-x_4";
      const expected = "sin(x1)+exp(-x2^2-x3^2)-x4";
      expect(latexToAsciiExpr(latex)).toBe(expected);
    });

    it("converts expressions with multiple operations", () => {
      const latex = "x_1^2 + 2x_2 - \\frac{x_3}{4}";
      const expected = "x1^2 + 2*x2 - (x3)/(4)";
      expect(latexToAsciiExpr(latex)).toBe(expected);
    });

    it("handles \\left and \\right delimiters", () => {
      expect(latexToAsciiExpr("\\left(x_1 + x_2\\right)")).toBe("(x1 + x2)");
    });
  });

  describe("implicit multiplication", () => {
    it("handles number followed by function", () => {
      expect(latexToAsciiExpr("2\\sin(x_1)")).toBe("2*sin(x1)");
      expect(latexToAsciiExpr("3\\cos(x_2)")).toBe("3*cos(x2)");
      expect(latexToAsciiExpr("\\frac{1}{2}\\sin(x_1)")).toBe("(1)/(2)*sin(x1)");
    });

    it("handles number followed by parenthesis", () => {
      expect(latexToAsciiExpr("2(x_1 + 1)")).toBe("2*(x1 + 1)");
      expect(latexToAsciiExpr("3(x_2)")).toBe("3*(x2)");
    });

    it("handles closing paren followed by opening paren", () => {
      expect(latexToAsciiExpr("(x_1)(x_2)")).toBe("(x1)*(x2)");
      expect(latexToAsciiExpr("(x_1 + 1)(x_2 - 1)")).toBe("(x1 + 1)*(x2 - 1)");
    });

    it("handles closing paren followed by function", () => {
      expect(latexToAsciiExpr("(x_1)\\sin(x_2)")).toBe("(x1)*sin(x2)");
    });

    it("handles closing paren followed by variable", () => {
      expect(latexToAsciiExpr("(x_1 + 1)x_2")).toBe("(x1 + 1)*x2");
    });

    it("handles complex mixed implicit multiplication", () => {
      expect(latexToAsciiExpr("2\\sin(x_1)x_2")).toBe("2*sin(x1)*x2");
      expect(latexToAsciiExpr("3(x_1 + 1)(x_2)")).toBe("3*(x1 + 1)*(x2)");
    });
  });

  describe("edge cases", () => {
    it("trims whitespace", () => {
      expect(latexToAsciiExpr("  x_1 + x_2  ")).toBe("x1 + x2");
    });

    it("throws on overly long input", () => {
      const longInput = "x_1".repeat(10000);
      expect(() => latexToAsciiExpr(longInput)).toThrow(/maximum length/);
    });
  });
});

describe("latexToHyperplane", () => {
  describe("basic linear equations", () => {
    it("parses simple 1D equation", () => {
      const { a, b } = latexToHyperplane("x_1 = 5", 4);
      expect(a[0]).toBe(1);
      expect(a[1]).toBe(0);
      expect(a[2]).toBe(0);
      expect(a[3]).toBe(0);
      expect(b).toBe(5);
    });

    it("parses equation from docs: x_1 + 2x_3 = 7", () => {
      const { a, b } = latexToHyperplane("x_1 + 2x_3 = 7", 4);
      expect(a[0]).toBe(1);
      expect(a[1]).toBe(0);
      expect(a[2]).toBe(2);
      expect(a[3]).toBe(0);
      expect(b).toBe(7);
    });

    it("parses equation with fraction: \\frac{1}{2}x_2 - x_4 = 0", () => {
      const { a, b } = latexToHyperplane("\\frac{1}{2}x_2 - x_4 = 0", 4);
      expect(a[0]).toBe(0);
      expect(a[1]).toBeCloseTo(0.5);
      expect(a[2]).toBe(0);
      expect(a[3]).toBe(-1);
      expect(b).toBe(0);
    });
  });

  describe("coefficient handling", () => {
    it("handles negative coefficients", () => {
      const { a, b } = latexToHyperplane("-x_1 + x_2 = 3", 2);
      expect(a[0]).toBe(-1);
      expect(a[1]).toBe(1);
      expect(b).toBe(3);
    });

    it("handles decimal coefficients", () => {
      const { a, b } = latexToHyperplane("0.5x_1 + 1.5x_2 = 2.5", 2);
      expect(a[0]).toBeCloseTo(0.5);
      expect(a[1]).toBeCloseTo(1.5);
      expect(b).toBeCloseTo(2.5);
    });

    it("handles implicit coefficient of 1", () => {
      const { a, b } = latexToHyperplane("x_1 = 1", 1);
      expect(a[0]).toBe(1);
      expect(b).toBe(1);
    });
  });

  describe("both sides with variables", () => {
    it("moves all terms to LHS", () => {
      const { a, b } = latexToHyperplane("x_1 + x_2 = x_3", 3);
      expect(a[0]).toBe(1);
      expect(a[1]).toBe(1);
      expect(a[2]).toBe(-1);
      expect(b).toBe(0);
    });

    it("handles constants on both sides", () => {
      const { a, b } = latexToHyperplane("x_1 + 3 = x_2 + 1", 2);
      expect(a[0]).toBe(1);
      expect(a[1]).toBe(-1);
      expect(b).toBe(-2);
    });
  });

  describe("error handling", () => {
    it("throws on missing equals sign", () => {
      expect(() => latexToHyperplane("x_1 + x_2", 2)).toThrow(/with exactly one '='/);
    });

    it("throws on multiple equals signs", () => {
      expect(() => latexToHyperplane("x_1 = x_2 = 0", 2)).toThrow(/with exactly one '='/);
    });

    it("throws on empty sides", () => {
      expect(() => latexToHyperplane("= 5", 1)).toThrow(/must be non-empty/);
      expect(() => latexToHyperplane("x_1 =", 1)).toThrow(/must be non-empty/);
    });

    it("throws on non-linear terms (powers)", () => {
      expect(() => latexToHyperplane("x_1^2 = 1", 1)).toThrow(/Nonlinear/);
    });

    it("throws on non-linear terms (functions)", () => {
      expect(() => latexToHyperplane("\\sin{x_1} = 0", 1)).toThrow(/Nonlinear/);
    });

    it("throws on non-linear terms (products)", () => {
      expect(() => latexToHyperplane("x_1 \\times x_2 = 0", 2)).toThrow(/Nonlinear/);
    });

    it("throws on variable index out of range", () => {
      expect(() => latexToHyperplane("x_5 = 0", 4)).toThrow(/index out of range/);
      expect(() => latexToHyperplane("x_0 = 0", 4)).toThrow(/index out of range/);
    });

    it("throws on overly long input", () => {
      const longInput = "x_1 + ".repeat(10000) + "x_2 = 0";
      expect(() => latexToHyperplane(longInput, 2)).toThrow(/maximum length/);
    });
  });
});

describe("latexToMatrix", () => {
  describe("basic matrices", () => {
    it("parses 2x2 matrix", () => {
      const latex = "\\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\end{bmatrix}";
      const result = latexToMatrix(latex);
      expect(result).toEqual([
        [1, 2],
        [3, 4],
      ]);
    });

    it("parses 3x4 matrix (basis example)", () => {
      const latex = "\\begin{bmatrix} 1 & 0 & 0 & 0 \\\\ 0 & 1 & 0 & 0 \\\\ 0 & 0 & 1 & 0 \\end{bmatrix}";
      const result = latexToMatrix(latex);
      expect(result).toEqual([
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
      ]);
    });

    it("parses single row matrix", () => {
      const latex = "\\begin{bmatrix} 1 & 2 & 3 \\end{bmatrix}";
      const result = latexToMatrix(latex);
      expect(result).toEqual([[1, 2, 3]]);
    });

    it("parses single column matrix", () => {
      const latex = "\\begin{bmatrix} 1 \\\\ 2 \\\\ 3 \\end{bmatrix}";
      const result = latexToMatrix(latex);
      expect(result).toEqual([[1], [2], [3]]);
    });
  });

  describe("numeric entries", () => {
    it("handles negative numbers", () => {
      const latex = "\\begin{bmatrix} -1 & 2 \\\\ 3 & -4 \\end{bmatrix}";
      const result = latexToMatrix(latex);
      expect(result).toEqual([
        [-1, 2],
        [3, -4],
      ]);
    });

    it("handles decimal numbers", () => {
      const latex = "\\begin{bmatrix} 0.5 & 1.5 \\\\ 2.25 & 3.75 \\end{bmatrix}";
      const result = latexToMatrix(latex);
      expect(result).toEqual([
        [0.5, 1.5],
        [2.25, 3.75],
      ]);
    });

    it("handles expressions in entries", () => {
      const latex = "\\begin{bmatrix} \\frac{1}{2} & 2 \\end{bmatrix}";
      const result = latexToMatrix(latex);
      expect(result[0][0]).toBeCloseTo(0.5);
      expect(result[0][1]).toBe(2);
    });
  });

  describe("delimiters", () => {
    it("handles \\left and \\right", () => {
      const latex = "\\left\\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\end{bmatrix}\\right";
      const result = latexToMatrix(latex);
      expect(result).toEqual([
        [1, 2],
        [3, 4],
      ]);
    });
  });

  describe("error handling", () => {
    it("throws on empty matrix", () => {
      expect(() => latexToMatrix("\\begin{bmatrix} \\end{bmatrix}")).toThrow(/Empty matrix/);
      expect(() => latexToMatrix("")).toThrow(/Empty matrix/);
    });

    it("throws on empty cell", () => {
      expect(() => latexToMatrix("\\begin{bmatrix} 1 &  \\\\ 3 & 4 \\end{bmatrix}")).toThrow(/Empty cell/);
    });

    it("throws on invalid numbers", () => {
      expect(() => latexToMatrix("\\begin{bmatrix} abc & 2 \\end{bmatrix}")).toThrow(/Invalid number/);
    });

    it("throws on inconsistent row lengths", () => {
      expect(() => latexToMatrix("\\begin{bmatrix} 1 & 2 \\\\ 3 & 4 & 5 \\end{bmatrix}")).toThrow(
        /Inconsistent row lengths/
      );
    });

    it("throws on overly long input", () => {
      const longInput = "\\begin{bmatrix} " + "1 & ".repeat(10000) + "2 \\end{bmatrix}";
      expect(() => latexToMatrix(longInput)).toThrow(/maximum length/);
    });
  });
});

describe("validateHyperplane", () => {
  it("returns true for valid normal vectors", () => {
    expect(validateHyperplane(new Float32Array([1, 0, 0, 0]))).toBe(true);
    expect(validateHyperplane(new Float32Array([1, 2, 3]))).toBe(true);
    expect(validateHyperplane(new Float32Array([0.5, 0.5]))).toBe(true);
  });

  it("returns false for zero normal vector", () => {
    expect(validateHyperplane(new Float32Array([0, 0, 0]))).toBe(false);
    expect(validateHyperplane(new Float32Array([0]))).toBe(false);
  });
});

describe("normalizeHyperplane", () => {
  it("normalizes a simple vector", () => {
    const a = new Float32Array([3, 4]);
    const b = 10;
    const result = normalizeHyperplane(a, b);

    expect(result.a[0]).toBeCloseTo(0.6);
    expect(result.a[1]).toBeCloseTo(0.8);
    expect(result.b).toBeCloseTo(2);

    // Check that norm is 1
    const norm = Math.sqrt(result.a[0] ** 2 + result.a[1] ** 2);
    expect(norm).toBeCloseTo(1);
  });

  it("normalizes a 4D vector", () => {
    const a = new Float32Array([1, 0, 2, 0]);
    const b = 7;
    const result = normalizeHyperplane(a, b);

    const norm = Math.sqrt(
      result.a[0] ** 2 + result.a[1] ** 2 + result.a[2] ** 2 + result.a[3] ** 2
    );
    expect(norm).toBeCloseTo(1);
    expect(result.a[0]).toBeCloseTo(1 / Math.sqrt(5));
    expect(result.a[2]).toBeCloseTo(2 / Math.sqrt(5));
  });

  it("throws on zero normal vector", () => {
    const a = new Float32Array([0, 0, 0]);
    expect(() => normalizeHyperplane(a, 5)).toThrow(/zero normal vector/);
  });
});

describe("integration: LaTeX to VM pipeline (smoke tests)", () => {
  it("generates valid ASCII for common functions", () => {
    // These should not throw and should produce plausible ASCII
    const examples = [
      "\\sin(x_1)",
      "x_1^2 + x_2^2",
      "\\exp(-x_1^2)",
      "\\frac{x_1 + x_2}{2}",
      "\\sqrt{x_1^2 + x_2^2}",
    ];

    for (const latex of examples) {
      const ascii = latexToAsciiExpr(latex);
      expect(ascii).toBeTruthy();
      expect(typeof ascii).toBe("string");
      // Basic sanity: should not contain backslashes
      expect(ascii).not.toContain("\\");
    }
  });

  it("produces ASCII that can be validated by mock compiler", () => {
    // Mock compiler that checks for basic validity
    const mockCompileExpression = (expr: string, dimension: number): { error: string | null } => {
      // Check for required variables
      const variables = Array.from({ length: dimension }, (_, i) => `x${i + 1}`);
      const hasVariable = variables.some((v) => expr.includes(v));
      
      if (!hasVariable) {
        return { error: `Expression must use at least one variable: ${variables.join(", ")}` };
      }
      
      // Check for common syntax issues
      if (expr.includes("\\")) {
        return { error: "LaTeX commands should have been converted to ASCII" };
      }
      
      if (expr.trim() === "") {
        return { error: "Empty expression" };
      }
      
      return { error: null };
    };

    const testCases = [
      { latex: "\\sin(x_1) + x_2^2", dim: 4 },
      { latex: "\\exp(-x_1^2 - x_2^2)", dim: 4 },
      { latex: "x_1 + 2x_2 - \\frac{x_3}{4}", dim: 4 },
    ];

    for (const { latex, dim } of testCases) {
      const ascii = latexToAsciiExpr(latex);
      const result = mockCompileExpression(ascii, dim);
      expect(result.error).toBeNull();
    }
  });

  it("generates valid hyperplanes for typical inputs", () => {
    const examples = [
      { latex: "x_1 = 0", n: 4 },
      { latex: "x_1 + x_2 = 1", n: 4 },
      { latex: "2x_1 - x_3 = 5", n: 4 },
    ];

    for (const { latex, n } of examples) {
      const { a, b } = latexToHyperplane(latex, n);
      expect(a).toBeInstanceOf(Float32Array);
      expect(a.length).toBe(n);
      expect(typeof b).toBe("number");
      expect(Number.isFinite(b)).toBe(true);
    }
  });

  it("generates valid matrices for typical inputs", () => {
    const examples = [
      "\\begin{bmatrix} 1 & 0 \\\\ 0 & 1 \\end{bmatrix}",
      "\\begin{bmatrix} 1 & 0 & 0 \\\\ 0 & 1 & 0 \\\\ 0 & 0 & 1 \\end{bmatrix}",
    ];

    for (const latex of examples) {
      const matrix = latexToMatrix(latex);
      expect(Array.isArray(matrix)).toBe(true);
      expect(matrix.length).toBeGreaterThan(0);
      expect(Array.isArray(matrix[0])).toBe(true);
    }
  });
});
