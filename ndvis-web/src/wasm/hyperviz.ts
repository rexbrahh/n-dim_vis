/**
 * HyperViz WASM bindings for calculus operations
 *
 * This module provides the interface to ndcalc-core and extended ndvis-core
 * functionality for hyperplane slicing, function evaluation, and calculus overlays.
 * The ndcalc WASM module is loaded lazily and keeps a single shared context alive
 * across recomputations.
 */

import type {
  HyperplaneConfig,
  FunctionConfig,
  CalculusConfig,
  OverlayState,
  GeometryState,
} from "@/state/appState";

import createNdcalcModule, { ADMode, ErrorCode } from "@/wasm/ndcalc/index.js";

export type HyperVizModule = {
  // Expression parser and bytecode VM
  _hyperviz_parse_expression: (exprPtr: number, exprLen: number, resultPtr: number) => number;
  _hyperviz_eval_scalar: (bytecodePtr: number, inputPtr: number, dimension: number) => number;
  _hyperviz_eval_gradient: (bytecodePtr: number, inputPtr: number, dimension: number, gradientPtr: number) => void;
  _hyperviz_eval_hessian: (bytecodePtr: number, inputPtr: number, dimension: number, hessianPtr: number) => void;

  // Hyperplane slicing
  _hyperviz_slice_hyperplane: (
    vertexPtr: number,
    vertexCount: number,
    dimension: number,
    coeffPtr: number,
    offset: number,
    outputPtr: number
  ) => number;

  // Level set extraction
  _hyperviz_extract_level_sets: (
    bytecodePtr: number,
    dimension: number,
    levelValues: number,
    levelValuesPtr: number,
    outputPtr: number
  ) => number;

  // Memory management
  _malloc: (bytes: number) => number;
  _free: (ptr: number) => void;

  // Heap views
  readonly HEAPF32: Float32Array;
  readonly HEAPU8: Uint8Array;
};

export type ComputeResult = {
  overlays: OverlayState;
  error: string | null;
};

/**
 * Stub implementation - returns mock data until WASM module is available
 */
type NdcalcRuntime = {
  module: ReturnType<typeof createNdcalcModule> extends Promise<infer R> ? R : never;
  ctx: number;
};

const ndcalcProgramCache = new Map<string, number>();
let ndcalcRuntimePromise: Promise<NdcalcRuntime> | null = null;

const getNdcalcRuntime = async (): Promise<NdcalcRuntime> => {
  if (!ndcalcRuntimePromise) {
    ndcalcRuntimePromise = (async () => {
      const module = await createNdcalcModule();
      const ctx = module.contextCreate();
      return { module, ctx };
    })();
  }
  return ndcalcRuntimePromise;
};

export const __setNdcalcRuntimeForTests = (runtime: NdcalcRuntime | null) => {
  if (runtime) {
    ndcalcRuntimePromise = Promise.resolve(runtime);
  } else {
    ndcalcRuntimePromise = null;
  }
  ndcalcProgramCache.clear();
};

const ensureAdMode = (runtime: NdcalcRuntime, mode: CalculusConfig["adMode"], epsilon = 1e-5) => {
  switch (mode) {
    case "forward":
      runtime.module.setADMode(runtime.ctx, ADMode.FORWARD);
      break;
    case "finite-diff":
      runtime.module.setADMode(runtime.ctx, ADMode.FINITE_DIFF);
      runtime.module.setFDEpsilon(runtime.ctx, epsilon);
      break;
    default:
      runtime.module.setADMode(runtime.ctx, ADMode.AUTO);
      break;
  }
};

export const computeOverlays = async (
  geometry: GeometryState,
  hyperplane: HyperplaneConfig,
  functionConfig: FunctionConfig,
  calculus: CalculusConfig,
  dimension: number
): Promise<ComputeResult> => {
  // Simulate async computation
  await new Promise((resolve) => setTimeout(resolve, 50));

  const overlays: OverlayState = {
    sliceGeometry: null,
    levelSetCurves: null,
    gradientVectors: null,
    tangentPatch: null,
  };

  try {
    if (hyperplane.enabled && hyperplane.showIntersection) {
      overlays.sliceGeometry = sliceHyperplaneCpu(geometry, hyperplane);
    }

  const expression = functionConfig.expression.trim();
  const needsCalculus =
    functionConfig.isValid &&
    expression.length > 0 &&
    (calculus.showGradient || calculus.showTangentPlane || (calculus.showLevelSets && calculus.levelSetValues.length > 0));

    if (needsCalculus) {
      const runtime = await getNdcalcRuntime();
      ensureAdMode(runtime, calculus.adMode);

      const variables = Array.from({ length: dimension }, (_, i) => `x${i + 1}`);
      const cacheKey = `${expression}::${dimension}`;
      let program = getCachedProgram(runtime, cacheKey);

      if (!program) {
        const [compileErr, compiledProgram] = runtime.module.compile(runtime.ctx, expression, variables);

        if (compileErr !== ErrorCode.OK || compiledProgram === 0) {
          const message =
            runtime.module.getLastErrorMessage(runtime.ctx) || runtime.module.errorString(compileErr);
          return { overlays, error: message };
        }
        storeProgramInCache(cacheKey, compiledProgram);
        program = compiledProgram;
      }

      try {
        if (calculus.showGradient && calculus.probePoint) {
          const probe = ensureSizedArray(calculus.probePoint, dimension);
          const [gradErr, gradient] = runtime.module.gradient(program, Array.from(probe));
          if (gradErr !== ErrorCode.OK) {
            const message = runtime.module.errorString(gradErr);
            return { overlays, error: message };
          }

          overlays.gradientVectors = createGradientOverlay(
            geometry,
            probe,
            gradient,
            calculus.gradientScale
          );
        }

        if (calculus.showTangentPlane && calculus.probePoint) {
          const probe = ensureSizedArray(calculus.probePoint, dimension);
          const [gradErr, gradient] = runtime.module.gradient(program, Array.from(probe));
          if (gradErr === ErrorCode.OK) {
            overlays.tangentPatch = createTangentPatch(geometry, probe, gradient);
          }
        }

        if (calculus.showLevelSets && calculus.levelSetValues.length > 0) {
          overlays.levelSetCurves = await computeLevelSets(runtime, program, geometry, calculus.levelSetValues);
        }
      } finally {
        releaseProgram(runtime, cacheKey, program);
      }
    }

    return { overlays, error: null };
  } catch (error) {
    return {
      overlays,
      error: error instanceof Error ? error.message : "Computation failed",
    };
  }
};

const sliceHyperplaneCpu = (geometry: GeometryState, hyperplane: HyperplaneConfig): Float32Array | null => {
  const { coefficients, offset } = hyperplane;
  if (coefficients.length === 0) {
    return null;
  }

  const { vertices, vertexCount, edgeCount, edges } = geometry;
  const dimension = coefficients.length;

  const vertexA = new Float32Array(dimension);
  const vertexB = new Float32Array(dimension);
  const intersectionND = new Float32Array(dimension);

  const intersections: number[] = [];

  const readVertex = (target: Float32Array, index: number) => {
    for (let axis = 0; axis < dimension; axis += 1) {
      target[axis] = vertices[axis * vertexCount + index];
    }
  };

  const dot = (lhs: Float32Array, rhs: Float32Array) => {
    let sum = 0;
    for (let axis = 0; axis < dimension; axis += 1) {
      sum += lhs[axis] * rhs[axis];
    }
    return sum;
  };

  for (let edge = 0; edge < edgeCount; edge += 1) {
    const v0Index = edges[edge * 2];
    const v1Index = edges[edge * 2 + 1];

    readVertex(vertexA, v0Index);
    readVertex(vertexB, v1Index);

    const d0 = dot(coefficients, vertexA) - offset;
    const d1 = dot(coefficients, vertexB) - offset;

    if (d0 === 0 && d1 === 0) {
      continue; // Edge lies on plane; skip until we handle polylines properly
    }

    if (d0 === 0 || d1 === 0 || d0 * d1 < 0) {
      const denom = d0 - d1;
      const t = Math.abs(denom) > 1e-6 ? d0 / denom : 0;

      for (let axis = 0; axis < dimension; axis += 1) {
        intersectionND[axis] = vertexA[axis] + t * (vertexB[axis] - vertexA[axis]);
      }

      const projected = projectPointTo3(geometry, intersectionND);
      intersections.push(projected[0], projected[1], projected[2]);
    }
  }

  if (intersections.length === 0) {
    return null;
  }

  return Float32Array.from(intersections);
};

const projectPointTo3 = (geometry: GeometryState, point: Float32Array): [number, number, number] => {
  const { dimension } = geometry;
  const rotated = new Float32Array(dimension);

  for (let row = 0; row < dimension; row += 1) {
    let sum = 0;
    const rowOffset = row * dimension;
    for (let col = 0; col < dimension; col += 1) {
      sum += geometry.rotationMatrix[rowOffset + col] * point[col];
    }
    rotated[row] = sum;
  }

  const result: [number, number, number] = [0, 0, 0];
  for (let component = 0; component < 3; component += 1) {
    let sum = 0;
    const basisOffset = component * dimension;
    for (let axis = 0; axis < dimension; axis += 1) {
      sum += rotated[axis] * geometry.basis[basisOffset + axis];
    }
    result[component] = sum;
  }

  return result;
};

const ensureSizedArray = (input: Float32Array | null, dimension: number): Float32Array => {
  const result = new Float32Array(dimension);
  if (input) {
    result.set(input.subarray(0, Math.min(dimension, input.length)));
  }
  return result;
};

const createGradientOverlay = (
  geometry: GeometryState,
  probePoint: Float32Array,
  gradient: number[],
  scale: number
): Float32Array => {
  const dimension = geometry.dimension;
  const normalized = ensureSizedArray(Float32Array.from(gradient), dimension);

  let norm = 0;
  for (let i = 0; i < dimension; i += 1) {
    const value = normalized[i];
    norm += value * value;
  }
  norm = Math.sqrt(norm);
  if (norm === 0) {
    return null;
  }
  for (let i = 0; i < dimension; i += 1) {
    normalized[i] /= norm;
  }

  const endPointND = new Float32Array(dimension);
  for (let i = 0; i < dimension; i += 1) {
    endPointND[i] = probePoint[i] + normalized[i] * scale;
  }

  const start = projectPointTo3(geometry, probePoint);
  const end = projectPointTo3(geometry, endPointND);

  return Float32Array.from([...start, ...end]);
};

const createTangentPatch = (
  geometry: GeometryState,
  probePoint: Float32Array,
  gradient: number[],
  size = 0.5
): Float32Array => {
  const dimension = geometry.dimension;
  const grad = ensureSizedArray(Float32Array.from(gradient), dimension);

  if (dimension < 2) {
    return null;
  }

  let gradNorm = 0;
  for (let i = 0; i < dimension; i += 1) {
    gradNorm += grad[i] * grad[i];
  }
  gradNorm = Math.sqrt(gradNorm);
  if (gradNorm === 0) {
    return null;
  }
  for (let i = 0; i < dimension; i += 1) {
    grad[i] /= gradNorm;
  }

  let minIndex = 0;
  for (let i = 1; i < dimension; i += 1) {
    if (Math.abs(grad[i]) < Math.abs(grad[minIndex])) {
      minIndex = i;
    }
  }
  const secondIndex = (minIndex + 1) % dimension;

  const tangentU = new Float32Array(dimension);
  tangentU[minIndex] = 1;
  const dotGU = grad[minIndex];
  for (let i = 0; i < dimension; i += 1) {
    tangentU[i] -= dotGU * grad[i];
  }
  let normU = 0;
  for (let i = 0; i < dimension; i += 1) {
    normU += tangentU[i] * tangentU[i];
  }
  normU = Math.sqrt(normU);
  if (normU === 0) {
    return null;
  }
  for (let i = 0; i < dimension; i += 1) {
    tangentU[i] /= normU;
  }

  const tangentV = new Float32Array(dimension);
  tangentV[secondIndex] = 1;
  const dotGV = grad[secondIndex];
  for (let i = 0; i < dimension; i += 1) {
    tangentV[i] -= dotGV * grad[i];
  }
  let dotUV = 0;
  for (let i = 0; i < dimension; i += 1) {
    dotUV += tangentU[i] * tangentV[i];
  }
  for (let i = 0; i < dimension; i += 1) {
    tangentV[i] -= dotUV * tangentU[i];
  }
  let normV = 0;
  for (let i = 0; i < dimension; i += 1) {
    normV += tangentV[i] * tangentV[i];
  }
  normV = Math.sqrt(normV);
  if (normV === 0) {
    return null;
  }
  for (let i = 0; i < dimension; i += 1) {
    tangentV[i] /= normV;
  }

  const corners = [
    [+size, +size],
    [-size, +size],
    [-size, -size],
    [+size, -size],
  ];

  const vertices3: number[] = [];
  for (const [u, v] of corners) {
    const ndPoint = new Float32Array(dimension);
    for (let i = 0; i < dimension; i += 1) {
      ndPoint[i] = probePoint[i] + u * tangentU[i] + v * tangentV[i];
    }
    const projected = projectPointTo3(geometry, ndPoint);
    vertices3.push(...projected);
  }

  return Float32Array.from(vertices3);
};

const computeLevelSets = async (
  runtime: NdcalcRuntime,
  program: number,
  geometry: GeometryState,
  values: number[]
): Promise<Float32Array[] | null> => {
  if (!values.length) {
    return null;
  }

  const inputArrays: number[][] = [];
  for (let axis = 0; axis < geometry.dimension; axis += 1) {
    const arr = new Array<number>(geometry.vertexCount);
    for (let v = 0; v < geometry.vertexCount; v += 1) {
      arr[v] = geometry.vertices[axis * geometry.vertexCount + v];
    }
    inputArrays.push(arr);
  }

  const [evalErr, vertexValues] = runtime.module.evalBatch(program, inputArrays);
  if (evalErr !== ErrorCode.OK || !vertexValues) {
    return null;
  }

  const curves: Float32Array[] = [];
  for (const value of values) {
    const segments: number[] = [];

    for (let edge = 0; edge < geometry.edgeCount; edge += 1) {
      const v0 = geometry.edges[edge * 2];
      const v1 = geometry.edges[edge * 2 + 1];

      const f0 = vertexValues[v0] - value;
      const f1 = vertexValues[v1] - value;

      if (f0 === 0 && f1 === 0) {
        continue;
      }

      if (f0 === 0 || f1 === 0 || f0 * f1 < 0) {
        const denom = f0 - f1;
        const t = Math.abs(denom) > 1e-6 ? f0 / denom : 0;

        const intersection = new Float32Array(geometry.dimension);
        for (let axis = 0; axis < geometry.dimension; axis += 1) {
          const a = geometry.vertices[axis * geometry.vertexCount + v0];
          const b = geometry.vertices[axis * geometry.vertexCount + v1];
          intersection[axis] = a + t * (b - a);
        }

        const projected = projectPointTo3(geometry, intersection);
        segments.push(...projected);
      }
    }

    if (segments.length > 0) {
      curves.push(Float32Array.from(segments));
    }
  }

  return curves.length ? curves : null;
};

/**
 * Parse and validate expression via ndcalc-core WASM.
 */
export const compileExpression = async (
  expression: string,
  dimension: number
): Promise<{ bytecode: Uint8Array | null; error: string | null }> => {
  try {
    const trimmed = expression.trim();
    if (!trimmed) {
      return { bytecode: null, error: "Empty expression" };
    }

    // Check for valid variable references
    const validVariables = Array.from({ length: dimension }, (_, i) => `x${i + 1}`);
    const hasValidVariables = validVariables.some((v) => trimmed.includes(v));

    if (!hasValidVariables) {
      return {
        bytecode: null,
        error: `Expression must use at least one variable: ${validVariables.join(", ")}`,
      };
    }

    const runtime = await getNdcalcRuntime();
    ensureAdMode(runtime, "forward");

    const variables = Array.from({ length: dimension }, (_, i) => `x${i + 1}`);
    const cacheKey = `${trimmed}::${dimension}`;
    let program = getCachedProgram(runtime, cacheKey);
    if (!program) {
      const [compileErr, compiledProgram] = runtime.module.compile(runtime.ctx, trimmed, variables);

      if (compileErr !== ErrorCode.OK || compiledProgram === 0) {
        const message =
          runtime.module.getLastErrorMessage(runtime.ctx) || runtime.module.errorString(compileErr);
        return { bytecode: null, error: message };
      }
      storeProgramInCache(cacheKey, compiledProgram);
      program = compiledProgram;
    }

    return { bytecode: null, error: null };
  } catch (error) {
    return {
      bytecode: null,
      error: error instanceof Error ? error.message : "Parse error",
    };
  }
};

/**
 * Placeholder loader for future ndvis WASM entry points.
 */
export const loadHyperViz = async (): Promise<HyperVizModule | null> => {
  if (import.meta.env.DEV) {
    console.warn("HyperViz WASM module not yet available; using stub implementation");
  }
  // Return null to indicate module not loaded - calling code should use stub functions
  return null;
};
const getCachedProgram = (
  runtime: NdcalcRuntime,
  key: string
): number | undefined => ndcalcProgramCache.get(key);

const storeProgramInCache = (
  key: string,
  program: number
) => {
  ndcalcProgramCache.set(key, program);
};

const releaseProgram = (runtime: NdcalcRuntime, key: string, program: number) => {
  if (!ndcalcProgramCache.has(key)) {
    runtime.module.programDestroy(program);
  }
};
