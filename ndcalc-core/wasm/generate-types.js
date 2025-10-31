#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "dist");
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const typeDefinitions = `/**
 * ndcalc - n-dimensional calculus VM and automatic differentiation
 * WASM module TypeScript declarations (auto-generated)
 */

export enum ErrorCode {
  OK = 0,
  PARSE = 1,
  INVALID_EXPR = 2,
  EVAL = 3,
  OUT_OF_MEMORY = 4,
  INVALID_DIMENSION = 5,
  NULL_POINTER = 6,
}

export enum ADMode {
  AUTO = 0,
  FORWARD = 1,
  FINITE_DIFF = 2,
}

export type CompileResult = [ErrorCode, number];
export type EvalResult = [ErrorCode, number];
export type EvalBatchResult = [ErrorCode, number[]];
export type GradientResult = [ErrorCode, number[]];
export type HessianResult = [ErrorCode, number[][]];

export interface LatexError {
  status: number;
  message: string;
  start: number;
  end: number;
}

export interface LatexAsciiResult {
  status: number;
  value?: string;
  error?: LatexError;
}

export interface LatexHyperplaneResult {
  status: number;
  coefficients?: Float32Array;
  offset?: number;
  error?: LatexError;
}

export interface LatexMatrixResult {
  status: number;
  matrix?: number[][];
  error?: LatexError;
}

export interface LatexNormalizeResult {
  status: number;
  coefficients?: Float32Array;
  offset?: number;
  error?: LatexError;
}

export interface NdcalcModule {
  readonly module: unknown;
  contextCreate(): number;
  contextDestroy(ctx: number): void;
  compile(ctx: number, expression: string, variables: string[]): CompileResult;
  programDestroy(program: number): void;
  eval(program: number, inputs: number[]): EvalResult;
  evalBatch(program: number, inputs: number[][]): EvalBatchResult;
  gradient(program: number, inputs: number[]): GradientResult;
  hessian(program: number, inputs: number[]): HessianResult;
  setADMode(ctx: number, mode: ADMode): void;
  setFDEpsilon(ctx: number, epsilon: number): void;
  programSetADMode(program: number, mode: ADMode): void;
  programSetFDEpsilon(program: number, epsilon: number): void;
  errorString(code: ErrorCode | number): string;
  getLastErrorMessage(ctx: number): string;
  latexToAscii(latex: string): LatexAsciiResult;
  latexToHyperplane(latex: string, dimension: number): LatexHyperplaneResult;
  latexToMatrix(latex: string): LatexMatrixResult;
  validateHyperplane(coefficients: Float32Array | number[]): boolean;
  normalizeHyperplane(coefficients: Float32Array | number[], offset: number): LatexNormalizeResult;
}

export default function createNdcalcModule(options?: Record<string, unknown>): Promise<NdcalcModule>;
`;

const wrapperSource = `/**
 * Auto-generated ndcalc WASM wrapper
 */

import createNdcalcModuleRaw from "./ndcalc_wasm.js";

export const ErrorCode = Object.freeze({
  OK: 0,
  PARSE: 1,
  INVALID_EXPR: 2,
  EVAL: 3,
  OUT_OF_MEMORY: 4,
  INVALID_DIMENSION: 5,
  NULL_POINTER: 6,
});

export const ADMode = Object.freeze({
  AUTO: 0,
  FORWARD: 1,
  FINITE_DIFF: 2,
});

const toFloat32Array = (values) => {
  if (!values) return undefined;
  if (values instanceof Float32Array) {
    return values;
  }
  return Float32Array.from(values);
};

const toNumberArray = (values) => {
  if (!values) return [];
  return Array.isArray(values) ? values : Array.from(values);
};

const toNestedNumberArrays = (arrays) => {
  if (!Array.isArray(arrays)) return [];
  return arrays.map((entry) => toNumberArray(entry));
};

class NdcalcWrapper {
  constructor(module) {
    this.module = module;
  }

  contextCreate() {
    return this.module.contextCreate();
  }

  contextDestroy(ctx) {
    this.module.contextDestroy(ctx);
  }

  compile(ctx, expression, variables) {
    const normalizedVariables = Array.isArray(variables)
      ? variables
      : Array.from(variables ?? []);
    const result = this.module.compile(ctx, expression, normalizedVariables);
    const program = typeof result.program === "number" ? result.program : 0;
    return [result.error, program];
  }

  programDestroy(program) {
    this.module.programDestroy(program);
  }

  eval(program, inputs) {
    const normalized = toNumberArray(inputs);
    const result = this.module.eval(program, normalized);
    return [result.error, result.value];
  }

  evalBatch(program, inputArrays) {
    const normalized = Array.isArray(inputArrays)
      ? inputArrays.map((entry) => toNumberArray(entry))
      : [];
    const result = this.module.evalBatch(program, normalized);
    return [result.error, Array.isArray(result.values) ? result.values.slice() : []];
  }

  gradient(program, inputs) {
    const normalized = toNumberArray(inputs);
    const result = this.module.gradient(program, normalized);
    return [result.error, Array.isArray(result.gradient) ? result.gradient.slice() : []];
  }

  hessian(program, inputs) {
    const normalized = toNumberArray(inputs);
    const result = this.module.hessian(program, normalized);
    const matrix = toNestedNumberArrays(result.hessian);
    return [result.error, matrix];
  }

  setADMode(ctx, mode) {
    this.module.setADMode(ctx, mode);
  }

  setFDEpsilon(ctx, epsilon) {
    this.module.setFDEpsilon(ctx, epsilon);
  }

  programSetADMode(program, mode) {
    this.module.programSetADMode(program, mode);
  }

  programSetFDEpsilon(program, epsilon) {
    this.module.programSetFDEpsilon(program, epsilon);
  }

  errorString(code) {
    return this.module.errorString(code);
  }

  getLastErrorMessage(ctx) {
    return this.module.getLastErrorMessage(ctx);
  }

  latexToAscii(latex) {
    return this.module.latexToAscii(latex);
  }

  latexToHyperplane(latex, dimension) {
    const result = this.module.latexToHyperplane(latex, dimension);
    if (result && Array.isArray(result.coefficients)) {
      result.coefficients = toFloat32Array(result.coefficients);
    }
    return result;
  }

  latexToMatrix(latex) {
    return this.module.latexToMatrix(latex);
  }

  validateHyperplane(coefficients) {
    if (coefficients instanceof Float32Array) {
      return this.module.validateHyperplane(Array.from(coefficients));
    }
    return this.module.validateHyperplane(coefficients);
  }

  normalizeHyperplane(coefficients, offset) {
    const coeffs = coefficients instanceof Float32Array ? Array.from(coefficients) : coefficients;
    const result = this.module.normalizeHyperplane(coeffs, offset);
    if (result && Array.isArray(result.coefficients)) {
      result.coefficients = toFloat32Array(result.coefficients);
    }
    return result;
  }
}

export default async function createNdcalcModule(options = {}) {
  const wasmBase = "/wasm/";
  const isDev = typeof import.meta !== "undefined" && import.meta.env?.DEV;
  const cacheBuster = isDev ? \`?dev=\${Date.now()}\` : "";
  const scriptUrl = new URL("./ndcalc_wasm.js", import.meta.url).href;

  const module = await createNdcalcModuleRaw({
    locateFile: (file) => {
      if (file.endsWith(".wasm")) {
        return \`\${wasmBase}\${file}\${cacheBuster}\`;
      }
      return new URL(\`./ndcalc/\${file}\`, import.meta.url).href;
    },
    mainScriptUrlOrBlob: scriptUrl,
    ...options,
  });

  return new NdcalcWrapper(module);
}
`;

fs.writeFileSync(path.join(distDir, "ndcalc.d.ts"), typeDefinitions.trimStart());
fs.writeFileSync(path.join(distDir, "index.js"), wrapperSource.trimStart());

console.log("TypeScript declarations generated in dist/ndcalc.d.ts");
console.log("JavaScript wrapper generated in dist/index.js");
