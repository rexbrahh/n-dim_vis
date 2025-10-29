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
import { createBindings as createNdvisBindings, type NdvisBindings } from "@/wasm/ndvis";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8");
const bytesPerFloat = Float32Array.BYTES_PER_ELEMENT;
const bytesPerUint32 = Uint32Array.BYTES_PER_ELEMENT;
const ensureNdcalcUtf8Helpers = (
  moduleOrWrapper: StubModule | (ReturnType<typeof createNdcalcModule> extends Promise<infer R> ? R : never)
) => {
  const target: any = (moduleOrWrapper as any).module ?? moduleOrWrapper;
  const heap: Uint8Array | undefined = target.HEAPU8 ?? (moduleOrWrapper as any).HEAPU8;

  if (!target.lengthBytesUTF8) {
    target.lengthBytesUTF8 = (value: string) => textEncoder.encode(value).length;
  }

  if (!target.stringToUTF8) {
    if (heap) {
      target.stringToUTF8 = (value: string, ptr: number, maxBytesToWrite: number) => {
        if (maxBytesToWrite <= 0) {
          return;
        }
        const encoded = textEncoder.encode(value);
        const bytesToWrite = Math.min(encoded.length, Math.max(0, maxBytesToWrite - 1));
        heap.subarray(ptr, ptr + bytesToWrite).set(encoded.subarray(0, bytesToWrite));
        heap[ptr + bytesToWrite] = 0;
      };
    } else {
      target.stringToUTF8 = () => {
        /* stub runtime; nothing to copy */
      };
    }
  }

  if (!target.UTF8ToString) {
    if (heap) {
      target.UTF8ToString = (ptr: number) => {
        let end = ptr;
        while (heap[end] !== 0) {
          end += 1;
        }
        return textDecoder.decode(heap.subarray(ptr, end));
      };
    } else {
      target.UTF8ToString = () => "";
    }
  }
};

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
      ensureNdcalcUtf8Helpers(module);
      const ctx = module.contextCreate();
      return { module, ctx };
    })();
  }
  return ndcalcRuntimePromise;
};

export const __setNdcalcRuntimeForTests = (runtime: NdcalcRuntime | null) => {
  if (runtime) {
    ensureNdcalcUtf8Helpers(runtime.module);
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

const overlayErrorMessages: Record<number, string> = {
  1: "Invalid overlay inputs",
  2: "Overlay output buffer missing",
  3: "Expression evaluation failed",
  4: "Gradient computation failed",
};

let ndvisBindingsPromise: Promise<NdvisBindings> | null = null;

const getNdvisBindings = async (): Promise<NdvisBindings | null> => {
  try {
    if (!ndvisBindingsPromise) {
      ndvisBindingsPromise = createNdvisBindings();
    }
    const bindings = await ndvisBindingsPromise;
    if (!bindings.module._ndvis_compute_overlays || !bindings.module._malloc || !bindings.module._free) {
      return null;
    }
    return bindings;
  } catch {
    return null;
  }
};

class WasmArena {
  private allocations: number[] = [];

  constructor(private readonly module: NdvisBindings["module"]) {}

  alloc(byteLength: number): number {
    if (byteLength <= 0) {
      return 0;
    }
    const ptr = this.module._malloc!(byteLength);
    if (!ptr) {
      throw new Error("ndvis wasm malloc failed");
    }
    this.allocations.push(ptr);
    return ptr;
  }

  copyFloat32(array: Float32Array): number {
    if (array.length === 0) {
      return 0;
    }
    const ptr = this.alloc(array.length * bytesPerFloat);
    this.module.HEAPF32.set(array, ptr / bytesPerFloat);
    return ptr;
  }

  copyUint32(array: Uint32Array): number {
    if (array.length === 0) {
      return 0;
    }
    const ptr = this.alloc(array.length * bytesPerUint32);
    this.module.HEAPU32.set(array, ptr / bytesPerUint32);
    return ptr;
  }

  copyUint8(array: Uint8Array): number {
    if (array.length === 0) {
      return 0;
    }
    const ptr = this.alloc(array.length);
    this.module.HEAPU8.set(array, ptr);
    return ptr;
  }

  freeAll() {
    for (let i = this.allocations.length - 1; i >= 0; i -= 1) {
      this.module._free!(this.allocations[i]);
    }
    this.allocations = [];
  }
}

type WasmOverlayAttempt = { success: true; overlays: OverlayState } | { success: false; error: string } | null;

const createEmptyOverlays = (): OverlayState => ({
  sliceGeometry: null,
  levelSetCurves: null,
  gradientVectors: null,
  tangentPatch: null,
});

const computeOverlaysWithWasm = async (
  geometry: GeometryState,
  hyperplane: HyperplaneConfig,
  functionConfig: FunctionConfig,
  calculus: CalculusConfig,
  dimension: number
): Promise<WasmOverlayAttempt> => {
  const bindings = await getNdvisBindings();
  if (!bindings) {
    return null;
  }

  const module = bindings.module;
  const computeFn = module._ndvis_compute_overlays;
  if (typeof computeFn !== "function" || !module._malloc || !module._free) {
    return null;
  }

  const expression = functionConfig.expression.trim();
  const calculusEnabled =
    functionConfig.isValid &&
    expression.length > 0 &&
    (calculus.showGradient || calculus.showTangentPlane || (calculus.showLevelSets && calculus.levelSetValues.length > 0));

  const wantsSlice = hyperplane.enabled && hyperplane.showIntersection;
  const wantsGradient = calculusEnabled && calculus.showGradient && Boolean(calculus.probePoint);
  const wantsTangent = calculusEnabled && calculus.showTangentPlane && Boolean(calculus.probePoint);
  const wantsLevelSets = calculusEnabled && calculus.showLevelSets && calculus.levelSetValues.length > 0;
  const needsCalculus = wantsGradient || wantsTangent || wantsLevelSets;

  const arena = new WasmArena(module);

  try {
    const verticesPtr = arena.copyFloat32(geometry.vertices);
    const edgesPtr = arena.copyUint32(geometry.edges);
    const rotationPtr = arena.copyFloat32(geometry.rotationMatrix);
    const basisPtr = arena.copyFloat32(geometry.basis);

    const coeffPtr = hyperplane.coefficients.length ? arena.copyFloat32(hyperplane.coefficients) : 0;

    let expressionPtr = 0;
    let expressionLength = 0;
    if (needsCalculus) {
      const encoded = textEncoder.encode(expression);
      expressionLength = encoded.length;
      expressionPtr = arena.alloc(encoded.length + 1);
      module.HEAPU8.set(encoded, expressionPtr);
      module.HEAPU8[expressionPtr + encoded.length] = 0;
    }

    let probePtr = 0;
    if (wantsGradient || wantsTangent) {
      const probe = ensureSizedArray(calculus.probePoint, dimension);
      probePtr = arena.copyFloat32(probe);
    }

    let levelValuesPtr = 0;
    let levelSetCapacity = 0;
    if (wantsLevelSets) {
      levelSetCapacity = calculus.levelSetValues.length;
      const values = new Float32Array(levelSetCapacity);
      for (let i = 0; i < levelSetCapacity; i += 1) {
        values[i] = calculus.levelSetValues[i];
      }
      levelValuesPtr = arena.copyFloat32(values);
    }

    const sliceCapacity = geometry.edgeCount;
    const slicePositionsPtr = wantsSlice && sliceCapacity > 0 ? arena.alloc(sliceCapacity * 3 * bytesPerFloat) : 0;
    const sliceCountPtr = wantsSlice ? arena.alloc(bytesPerUint32) : 0;
    if (sliceCountPtr) {
      module.HEAPU32[sliceCountPtr >> 2] = 0;
    }

    const gradientPtr = wantsGradient ? arena.alloc(6 * bytesPerFloat) : 0;
    const tangentPtr = wantsTangent ? arena.alloc(12 * bytesPerFloat) : 0;

    let levelCurvesPtr = 0;
    let levelSizesPtr = 0;
    let levelCountPtr = 0;
    const levelCurveBuffers: { ptr: number; length: number }[] = [];
    if (wantsLevelSets) {
      const curveCapacity = Math.max(geometry.edgeCount, 1) * 3;
      levelCurvesPtr = arena.alloc(levelSetCapacity * bytesPerUint32);
      levelSizesPtr = arena.alloc(levelSetCapacity * bytesPerUint32);
      levelCountPtr = arena.alloc(bytesPerUint32);
      module.HEAPU32[levelCountPtr >> 2] = 0;

      const curvePtrBase = levelCurvesPtr >> 2;
      const sizePtrBase = levelSizesPtr >> 2;
      for (let i = 0; i < levelSetCapacity; i += 1) {
        const curvePtr = arena.alloc(curveCapacity * bytesPerFloat);
        module.HEAPU32[curvePtrBase + i] = curvePtr;
        module.HEAPU32[sizePtrBase + i] = curveCapacity;
        levelCurveBuffers.push({ ptr: curvePtr, length: curveCapacity });
      }
    }

    const geometryStructPtr = arena.alloc(7 * bytesPerUint32);
    const geometryBase = geometryStructPtr >> 2;
    module.HEAPU32[geometryBase + 0] = verticesPtr;
    module.HEAPU32[geometryBase + 1] = geometry.vertexCount;
    module.HEAPU32[geometryBase + 2] = geometry.dimension;
    module.HEAPU32[geometryBase + 3] = edgesPtr;
    module.HEAPU32[geometryBase + 4] = geometry.edgeCount;
    module.HEAPU32[geometryBase + 5] = rotationPtr;
    module.HEAPU32[geometryBase + 6] = basisPtr;

    const hyperplaneStructPtr = arena.alloc(4 * bytesPerUint32);
    const hyperplaneBase = hyperplaneStructPtr >> 2;
    module.HEAPU32[hyperplaneBase + 0] = coeffPtr;
    module.HEAPU32[hyperplaneBase + 1] = geometry.dimension;
    module.HEAPF32[hyperplaneBase + 2] = hyperplane.offset;
    module.HEAP32[hyperplaneBase + 3] = hyperplane.enabled ? 1 : 0;

    const calculusStructPtr = arena.alloc(9 * bytesPerUint32);
    const calculusBase = calculusStructPtr >> 2;
    module.HEAPU32[calculusBase + 0] = expressionPtr;
    module.HEAPU32[calculusBase + 1] = expressionLength;
    module.HEAPU32[calculusBase + 2] = probePtr;
    module.HEAPU32[calculusBase + 3] = levelValuesPtr;
    module.HEAPU32[calculusBase + 4] = levelSetCapacity;
    module.HEAP32[calculusBase + 5] = wantsGradient ? 1 : 0;
    module.HEAP32[calculusBase + 6] = wantsTangent ? 1 : 0;
    module.HEAP32[calculusBase + 7] = wantsLevelSets ? 1 : 0;
    module.HEAPF32[calculusBase + 8] = calculus.gradientScale;

    const buffersStructPtr = arena.alloc(11 * bytesPerUint32);
    const buffersBase = buffersStructPtr >> 2;
    module.HEAPU32[buffersBase + 0] = 0; // projected_vertices (unused)
    module.HEAPU32[buffersBase + 1] = geometry.vertexCount;
    module.HEAPU32[buffersBase + 2] = slicePositionsPtr;
    module.HEAPU32[buffersBase + 3] = sliceCapacity;
    module.HEAPU32[buffersBase + 4] = sliceCountPtr;
    module.HEAPU32[buffersBase + 5] = gradientPtr;
    module.HEAPU32[buffersBase + 6] = tangentPtr;
    module.HEAPU32[buffersBase + 7] = levelCurvesPtr;
    module.HEAPU32[buffersBase + 8] = levelSizesPtr;
    module.HEAPU32[buffersBase + 9] = wantsLevelSets ? levelSetCapacity : 0;
    module.HEAPU32[buffersBase + 10] = levelCountPtr;

    const result = computeFn(geometryStructPtr, hyperplaneStructPtr, calculusStructPtr, buffersStructPtr);
    if (result !== 0) {
      const message = overlayErrorMessages[result] ?? "Overlay computation failed";
      return { success: false, error: message };
    }

    const overlays: OverlayState = createEmptyOverlays();

    if (wantsSlice && sliceCountPtr && slicePositionsPtr) {
      const sliceCount = module.HEAPU32[sliceCountPtr >> 2];
      if (sliceCount > 0) {
        const sliceView = module.HEAPF32.subarray(
          slicePositionsPtr / bytesPerFloat,
          slicePositionsPtr / bytesPerFloat + sliceCount * 3
        );
        overlays.sliceGeometry = Float32Array.from(sliceView);
      }
    }

    if (wantsGradient && gradientPtr) {
      const gradientView = module.HEAPF32.subarray(gradientPtr / bytesPerFloat, gradientPtr / bytesPerFloat + 6);
      overlays.gradientVectors = Float32Array.from(gradientView);
    }

    if (wantsTangent && tangentPtr) {
      const tangentView = module.HEAPF32.subarray(tangentPtr / bytesPerFloat, tangentPtr / bytesPerFloat + 12);
      overlays.tangentPatch = Float32Array.from(tangentView);
    }

    if (wantsLevelSets && levelCountPtr && levelCurvesPtr && levelSizesPtr) {
      const curveCount = module.HEAPU32[levelCountPtr >> 2];
      if (curveCount > 0) {
        const curves: Float32Array[] = [];
        const curvePtrBase = levelCurvesPtr >> 2;
        const sizePtrBase = levelSizesPtr >> 2;
        for (let i = 0; i < Math.min(curveCount, levelCurveBuffers.length); i += 1) {
          const curvePtr = module.HEAPU32[curvePtrBase + i];
          const floatCount = module.HEAPU32[sizePtrBase + i];
          if (curvePtr && floatCount > 0) {
            const curveView = module.HEAPF32.subarray(
              curvePtr / bytesPerFloat,
              curvePtr / bytesPerFloat + floatCount
            );
            curves.push(Float32Array.from(curveView));
          }
        }
        overlays.levelSetCurves = curves.length > 0 ? curves : null;
      }
    }

    if (wantsSlice && !overlays.sliceGeometry) {
      overlays.sliceGeometry = new Float32Array();
    }

    return { success: true, overlays };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Overlay computation failed";
    if (message.includes("not implemented")) {
      return null;
    }
    return { success: false, error: message };
  } finally {
    arena.freeAll();
  }
};

const computeOverlaysCpu = async (
  geometry: GeometryState,
  hyperplane: HyperplaneConfig,
  functionConfig: FunctionConfig,
  calculus: CalculusConfig,
  dimension: number
): Promise<ComputeResult> => {
  await new Promise((resolve) => setTimeout(resolve, 50));

  const overlays = createEmptyOverlays();

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

export const computeOverlays = async (
  geometry: GeometryState,
  hyperplane: HyperplaneConfig,
  functionConfig: FunctionConfig,
  calculus: CalculusConfig,
  dimension: number
): Promise<ComputeResult> => {
  const wasmAttempt = await computeOverlaysWithWasm(geometry, hyperplane, functionConfig, calculus, dimension);
  if (wasmAttempt) {
    if (wasmAttempt.success) {
      return { overlays: wasmAttempt.overlays, error: null };
    }
    return { overlays: createEmptyOverlays(), error: wasmAttempt.error };
  }

  return computeOverlaysCpu(geometry, hyperplane, functionConfig, calculus, dimension);
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
