/**
 * ndcalc - n-dimensional calculus VM and automatic differentiation
 * WASM module TypeScript declarations
 */

export enum ErrorCode {
  OK = 0,
  PARSE = 1,
  INVALID_EXPR = 2,
  EVAL = 3,
  OUT_OF_MEMORY = 4,
  INVALID_DIMENSION = 5,
  NULL_POINTER = 6
}

export enum ADMode {
  AUTO = 0,
  FORWARD = 1,
  FINITE_DIFF = 2
}

export interface NdcalcModule {
  /**
   * Create a new computation context
   */
  contextCreate(): number;

  /**
   * Destroy a context
   */
  contextDestroy(ctx: number): void;

  /**
   * Compile an expression to bytecode
   * @param ctx Context handle
   * @param expression Mathematical expression string
   * @param variables Array of variable names
   * @returns [error_code, program_handle]
   */
  compile(ctx: number, expression: string, variables: string[]): [ErrorCode, number];

  /**
   * Destroy a compiled program
   */
  programDestroy(program: number): void;

  /**
   * Evaluate expression at a point
   * @param program Program handle
   * @param inputs Input values (same order as variable names)
   * @returns [error_code, result]
   */
  eval(program: number, inputs: number[]): [ErrorCode, number];

  /**
   * Evaluate expression at multiple points (SoA layout)
   * @param program Program handle
   * @param inputArrays Array of arrays, one per variable
   * @returns [error_code, results]
   */
  evalBatch(program: number, inputArrays: number[][]): [ErrorCode, number[]];

  /**
   * Compute gradient using automatic differentiation
   * @param program Program handle
   * @param inputs Input values
   * @returns [error_code, gradient]
   */
  gradient(program: number, inputs: number[]): [ErrorCode, number[]];

  /**
   * Compute Hessian matrix
   * @param program Program handle
   * @param inputs Input values
   * @returns [error_code, hessian] (row-major)
   */
  hessian(program: number, inputs: number[]): [ErrorCode, number[]];

  /**
   * Set automatic differentiation mode (context-level, affects new compilations)
   */
  setADMode(ctx: number, mode: ADMode): void;

  /**
   * Set finite difference epsilon (context-level, affects new compilations)
   */
  setFDEpsilon(ctx: number, epsilon: number): void;

  /**
   * Set automatic differentiation mode (program-level, runtime)
   */
  programSetADMode(program: number, mode: ADMode): void;

  /**
   * Set finite difference epsilon (program-level, runtime)
   */
  programSetFDEpsilon(program: number, epsilon: number): void;

  /**
   * Get error string for error code
   */
  errorString(error: ErrorCode): string;

  /**
   * Get last error message from context
   */
  getLastErrorMessage(ctx: number): string;
}

/**
 * Create WASM module instance
 */
export default function createNdcalcModule(): Promise<NdcalcModule>;
