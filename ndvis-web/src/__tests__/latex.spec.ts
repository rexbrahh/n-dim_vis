import { beforeAll, afterAll, describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";

import createNdcalcModule from "@/wasm/ndcalc/index.js";
import {
  latexToAsciiExpr,
  latexToHyperplane,
  latexToMatrix,
  validateHyperplane,
  normalizeHyperplane,
  __setNdcalcLatexModuleForTests,
} from "@/math/latex";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..", "..");

beforeAll(async () => {
  const wasmBinary = await readFile(path.resolve(projectRoot, "public/wasm/ndcalc_wasm.wasm"));

  const module = await createNdcalcModule({
    locateFile: (file) => {
      if (file.endsWith(".wasm")) {
        return pathToFileURL(path.resolve(projectRoot, "public/wasm", file)).href;
      }
      return pathToFileURL(path.resolve(projectRoot, "src/wasm/ndcalc", file)).href;
    },
    mainScriptUrlOrBlob: pathToFileURL(path.resolve(projectRoot, "src/wasm/ndcalc/ndcalc_wasm.js")).href,
    wasmBinary,
  });

  __setNdcalcLatexModuleForTests(module);
});

afterAll(() => {
  __setNdcalcLatexModuleForTests(null);
});

describe("LaTeX translator bridge", () => {
  it("translates LaTeX expressions to ASCII", async () => {
    await expect(latexToAsciiExpr("x_1 + 2\\sin(x_2)")).resolves.toBe("x1 + 2*sin(x2)");
  });

  it("preserves nested function structure", async () => {
    await expect(latexToAsciiExpr("\\exp(-x_1^2 - x_2^2) + \\sqrt{x_3}"))
      .resolves.toBe("exp(-x1^2 - x2^2) + sqrt(x3)");
  });

  it("throws structured errors with offsets", async () => {
    const longInput = "x_1".repeat(9000);
    await expect(latexToAsciiExpr(longInput)).rejects.toMatchObject({
      name: "LaTeXParseError",
      message: expect.stringMatching(/maximum length/),
      start: 0,
    });
  });

  it("parses linear hyperplanes", async () => {
    const { a, b } = await latexToHyperplane("x_1 + 2x_3 = 7", 4);
    expect(Array.from(a)).toEqual([1, 0, 2, 0]);
    expect(b).toBe(7);
  });

  it("detects nonlinear hyperplanes", async () => {
    await expect(latexToHyperplane("x_1^2 = 1", 2)).rejects.toThrow(/Nonlinear/i);
  });

  it("parses matrices", async () => {
    const src = String.raw`\begin{bmatrix}1&2\\3&4\end{bmatrix}`;
    const matrix = await latexToMatrix(src);
    expect(matrix).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("rejects invalid matrices", async () => {
    const src = String.raw`\begin{bmatrix}1&2\\3&4&5\end{bmatrix}`;
    await expect(latexToMatrix(src)).rejects.toThrow(
      /Inconsistent row lengths/
    );
  });

  it("validates hyperplane normals", async () => {
    await expect(validateHyperplane(new Float32Array([1, 0, 0]))).resolves.toBe(true);
    await expect(validateHyperplane(new Float32Array([0, 0, 0]))).resolves.toBe(false);
  });

  it("normalizes hyperplanes", async () => {
    const result = await normalizeHyperplane(new Float32Array([3, 4]), 5);
    expect(result.a[0]).toBeCloseTo(0.6, 6);
    expect(result.a[1]).toBeCloseTo(0.8, 6);
    expect(result.b).toBeCloseTo(1);
  });

  it("rejects zero normals during normalization", async () => {
    await expect(normalizeHyperplane(new Float32Array([0, 0]), 2)).rejects.toThrow(/zero normal vector/i);
  });
});
