/**
 * ndcalc WASM wrapper with TypeScript-friendly API
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

class NdcalcWrapper {
  constructor(module) {
    this.module = module;
    this._stringToPtr = this._stringToPtr.bind(this);
    this._stringArrayToPtr = this._stringArrayToPtr.bind(this);
    this._freeStringArray = this._freeStringArray.bind(this);
  }

  _stringToPtr(str) {
    const len = this.module.lengthBytesUTF8(str) + 1;
    const ptr = this.module._malloc(len);
    this.module.stringToUTF8(str, ptr, len);
    return ptr;
  }

  _stringArrayToPtr(arr) {
    const ptrs = arr.map(str => this._stringToPtr(str));
    const arrayPtr = this.module._malloc(ptrs.length * 4);
    ptrs.forEach((ptr, i) => {
      this.module.setValue(arrayPtr + i * 4, ptr, 'i32');
    });
    return { arrayPtr, ptrs };
  }

  _freeStringArray({ arrayPtr, ptrs }) {
    ptrs.forEach(ptr => this.module._free(ptr));
    this.module._free(arrayPtr);
  }

  contextCreate() {
    return this.module.ccall('wasm_context_create', 'number', [], []);
  }

  contextDestroy(ctx) {
    this.module.ccall('wasm_context_destroy', null, ['number'], [ctx]);
  }

  compile(ctx, expression, variables) {
    const exprPtr = this._stringToPtr(expression);
    const varPtrs = this._stringArrayToPtr(variables);
    const outProgramPtr = this.module._malloc(4);

    const error = this.module.ccall(
      'wasm_compile',
      'number',
      ['number', 'number', 'number', 'number', 'number'],
      [ctx, exprPtr, variables.length, varPtrs.arrayPtr, outProgramPtr]
    );

    const program = this.module.getValue(outProgramPtr, 'i32');

    this.module._free(exprPtr);
    this._freeStringArray(varPtrs);
    this.module._free(outProgramPtr);

    return [error, program];
  }

  programDestroy(program) {
    this.module.ccall('wasm_program_destroy', null, ['number'], [program]);
  }

  eval(program, inputs) {
    const inputPtr = this.module._malloc(inputs.length * 8);
    inputs.forEach((val, i) => {
      this.module.setValue(inputPtr + i * 8, val, 'double');
    });

    const outputPtr = this.module._malloc(8);

    const error = this.module.ccall(
      'wasm_eval',
      'number',
      ['number', 'number', 'number', 'number'],
      [program, inputPtr, inputs.length, outputPtr]
    );

    const result = this.module.getValue(outputPtr, 'double');

    this.module._free(inputPtr);
    this.module._free(outputPtr);

    return [error, result];
  }

  evalBatch(program, inputArrays) {
    const numVars = inputArrays.length;
    const numPoints = inputArrays[0].length;

    // Allocate SoA arrays
    const arrayPtrs = inputArrays.map(arr => {
      const ptr = this.module._malloc(arr.length * 8);
      arr.forEach((val, i) => {
        this.module.setValue(ptr + i * 8, val, 'double');
      });
      return ptr;
    });

    // Array of pointers
    const arrayOfPtrsPtr = this.module._malloc(arrayPtrs.length * 4);
    arrayPtrs.forEach((ptr, i) => {
      this.module.setValue(arrayOfPtrsPtr + i * 4, ptr, 'i32');
    });

    const outputPtr = this.module._malloc(numPoints * 8);

    const error = this.module.ccall(
      'wasm_eval_batch',
      'number',
      ['number', 'number', 'number', 'number', 'number'],
      [program, arrayOfPtrsPtr, numVars, numPoints, outputPtr]
    );

    const results = [];
    for (let i = 0; i < numPoints; i++) {
      results.push(this.module.getValue(outputPtr + i * 8, 'double'));
    }

    arrayPtrs.forEach(ptr => this.module._free(ptr));
    this.module._free(arrayOfPtrsPtr);
    this.module._free(outputPtr);

    return [error, results];
  }

  gradient(program, inputs) {
    const inputPtr = this.module._malloc(inputs.length * 8);
    inputs.forEach((val, i) => {
      this.module.setValue(inputPtr + i * 8, val, 'double');
    });

    const gradientPtr = this.module._malloc(inputs.length * 8);

    const error = this.module.ccall(
      'wasm_gradient',
      'number',
      ['number', 'number', 'number', 'number'],
      [program, inputPtr, inputs.length, gradientPtr]
    );

    const gradient = [];
    for (let i = 0; i < inputs.length; i++) {
      gradient.push(this.module.getValue(gradientPtr + i * 8, 'double'));
    }

    this.module._free(inputPtr);
    this.module._free(gradientPtr);

    return [error, gradient];
  }

  hessian(program, inputs) {
    const n = inputs.length;
    const inputPtr = this.module._malloc(n * 8);
    inputs.forEach((val, i) => {
      this.module.setValue(inputPtr + i * 8, val, 'double');
    });

    const hessianPtr = this.module._malloc(n * n * 8);

    const error = this.module.ccall(
      'wasm_hessian',
      'number',
      ['number', 'number', 'number', 'number'],
      [program, inputPtr, n, hessianPtr]
    );

    const hessian = [];
    for (let i = 0; i < n * n; i++) {
      hessian.push(this.module.getValue(hessianPtr + i * 8, 'double'));
    }

    this.module._free(inputPtr);
    this.module._free(hessianPtr);

    return [error, hessian];
  }

  setADMode(ctx, mode) {
    this.module.ccall('wasm_set_ad_mode', null, ['number', 'number'], [ctx, mode]);
  }

  setFDEpsilon(ctx, epsilon) {
    this.module.ccall('wasm_set_fd_epsilon', null, ['number', 'number'], [ctx, epsilon]);
  }

  errorString(error) {
    const ptr = this.module.ccall('wasm_error_string', 'number', ['number'], [error]);
    return this.module.UTF8ToString(ptr);
  }

  getLastErrorMessage(ctx) {
    const ptr = this.module.ccall('wasm_get_last_error_message', 'number', ['number'], [ctx]);
    return this.module.UTF8ToString(ptr);
  }
}

export default async function createNdcalcModule() {
  const wasmBase = "/wasm/";
  const cacheBuster = import.meta.env?.DEV ? `?dev=${Date.now()}` : "";
  const module = await createNdcalcModuleRaw({
    locateFile: (file) => `${wasmBase}${file}`,
    mainScriptUrlOrBlob: `${wasmBase}ndcalc_wasm.js${cacheBuster}`,
  });
  return new NdcalcWrapper(module);
}
