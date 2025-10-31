/**
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
