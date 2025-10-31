/**
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
  const cacheBuster = isDev ? `?dev=${Date.now()}` : "";
  const scriptUrl = new URL("./ndcalc_wasm.js", import.meta.url).href;

  const module = await createNdcalcModuleRaw({
    locateFile: (file) => {
      if (file.endsWith(".wasm")) {
        return `${wasmBase}${file}${cacheBuster}`;
      }
      return new URL(`./ndcalc/${file}`, import.meta.url).href;
    },
    mainScriptUrlOrBlob: scriptUrl,
    ...options,
  });

  return new NdcalcWrapper(module);
}
