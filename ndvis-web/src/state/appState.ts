import { computePcaFallback, type PcaWorkspace, createBindings, createFallbackBindings } from "@/wasm/ndvis";
import type { NdvisBindings } from "@/wasm/ndvis";
import { create } from "zustand";

const MAX_DIMENSION = 12;
const MAX_VERTICES = 150000;

export type ProjectionBasis = "standard" | "random" | "pca" | "custom";

export type PcaInsight = {
  basis: Float32Array;
  eigenvalues: Float32Array;
  variance: Float32Array;
};

type RotationPlane = {
  i: number;
  j: number;
  theta: number;
};

export type HyperplaneConfig = {
  enabled: boolean;
  coefficients: Float32Array; // normalized a vector
  offset: number; // scalar b
  showIntersection: boolean;
  intersectionColor: [number, number, number];
  latex?: string; // optional: original LaTeX input
};

export type FunctionConfig = {
  expression: string;
  type: "scalar" | "vector";
  isValid: boolean;
  errorMessage: string | null;
  programBytecode: Uint8Array | null;
  latex?: string; // optional: original LaTeX input
};

export type CalculusConfig = {
  showGradient: boolean;
  showHessian: boolean;
  showTangentPlane: boolean;
  showLevelSets: boolean;
  levelSetValues: number[];
  gradientScale: number;
  probePoint: Float32Array | null;
  adMode: "forward" | "finite-diff";
};

export type ExportConfig = {
  format: "png" | "svg" | "mp4";
  resolution: [number, number];
  fps: number;
  duration: number;
  includeOverlays: boolean;
};

export type OverlayState = {
  sliceGeometry: Float32Array | null;
  levelSetCurves: Float32Array[] | null;
  levelSetPointClouds: Float32Array[] | null;
  gradientVectors: Float32Array | null;
  tangentPatch: Float32Array | null;
};

export type GeometryState = {
  dimension: number;
  vertexCount: number;
  edgeCount: number;
  vertices: Float32Array; // SoA layout (dimension × vertexCount)
  edges: Uint32Array; // pairs (u, v)
  rotationMatrix: Float32Array; // row-major dimension × dimension
  basis: Float32Array; // column-major 3 × dimension
  projectedPositions: Float32Array; // vertexCount × 3
};

export type ComputeStatus = {
  isComputing: boolean;
  lastError: string | null;
  lastComputeTime: number;
};

export type RotationConfig = {
  qrCadence: number; // Re-orthonormalize every N rotation applications (0 = disabled)
  qrThreshold: number; // Drift threshold to trigger QR (Frobenius norm)
  rotationFrameCount: number; // Track how many rotation frames have been applied
  lastDrift: number; // Last computed orthogonality drift
  profilingEnabled: boolean; // Enable rotation performance profiling
};

type AppState = {
  dimension: number;
  setDimension: (dimension: number) => void;
  rotationPlanes: RotationPlane[];
  setRotationPlanes: (planes: RotationPlane[]) => void;
  rotationConfig: RotationConfig;
  setRotationConfig: (config: Partial<RotationConfig>) => void;
  basis: ProjectionBasis;
  setBasis: (basis: ProjectionBasis) => void;
  pcaBasis: Float32Array;
  pcaEigenvalues: Float32Array;
  pcaVariance: Float32Array;
  setPcaResult: (result: PcaWorkspace) => void;

  // Hyperplane state
  hyperplane: HyperplaneConfig;
  setHyperplane: (config: Partial<HyperplaneConfig>) => void;

  // Function state
  functionConfig: FunctionConfig;
  setFunctionExpression: (expression: string) => void;
  setFunctionValid: (isValid: boolean, error: string | null, bytecode: Uint8Array | null) => void;

  // Calculus state
  calculus: CalculusConfig;
  setCalculus: (config: Partial<CalculusConfig>) => void;

  // Export state
  exportConfig: ExportConfig;
  setExportConfig: (config: Partial<ExportConfig>) => void;

  // Overlay state
  overlays: OverlayState;
  setOverlays: (overlays: Partial<OverlayState>) => void;

  geometry: GeometryState;
  setGeometry: (geometry: GeometryState) => void;

  // Compute status
  computeStatus: ComputeStatus;
  setComputeStatus: (status: Partial<ComputeStatus>) => void;

  // Async recompute trigger
  triggerRecompute: () => Promise<void>;
};

const deriveVariance = (eigenvalues: Float32Array) => {
  const total = eigenvalues.reduce((sum, value) => sum + Math.max(value, 0), 0);
  const variance = new Float32Array(eigenvalues.length);
  if (total <= 0) {
    return variance;
  }
  eigenvalues.forEach((value, index) => {
    variance[index] = Math.max(value, 0) / total;
  });
  return variance;
};

const initialPca = computePcaFallback(4);

// WASM bindings singleton - seeded with fallback implementation until real module loads
let wasmBindings: NdvisBindings = createFallbackBindings();
let wasmBindingsReady = false;

export async function initializeWasmBindings() {
  if (wasmBindingsReady) {
    return wasmBindings;
  }

  try {
    const bindings = await createBindings();
    wasmBindings = bindings;
    wasmBindingsReady = true;
    console.log("[WASM] ndvis bindings initialized successfully");
  } catch (error) {
    console.warn("[WASM] Failed to initialize ndvis bindings, using fallback implementation", error);
  }

  return wasmBindings;
}

const createDefaultHyperplane = (dimension: number): HyperplaneConfig => ({
  enabled: false,
  coefficients: new Float32Array(dimension).fill(0),
  offset: 0,
  showIntersection: true,
  intersectionColor: [1, 0.5, 0],
});

export const useAppState = create<AppState>((set, get) => ({
  dimension: 4,
  setDimension: (dimension) => {
    const { basis, eigenvalues } = computePcaFallback(dimension);
    const geometry = generateHypercubeGeometry(dimension);

    set((state) => {
      const resizedCoefficients = new Float32Array(dimension);
      resizedCoefficients.set(
        state.hyperplane.coefficients.subarray(0, Math.min(dimension, state.hyperplane.coefficients.length))
      );

      const resizedProbePoint = state.calculus.probePoint
        ? (() => {
            const next = new Float32Array(dimension);
            next.set(state.calculus.probePoint.subarray(0, Math.min(dimension, state.calculus.probePoint.length)));
            return next;
          })()
        : null;

      return {
        dimension,
        pcaBasis: basis,
        pcaEigenvalues: eigenvalues,
        pcaVariance: deriveVariance(eigenvalues),
        hyperplane: {
          ...state.hyperplane,
          coefficients: resizedCoefficients,
        },
        calculus: {
          ...state.calculus,
          probePoint: resizedProbePoint,
        },
        geometry,
        rotationConfig: {
          ...state.rotationConfig,
          rotationFrameCount: 0,
          lastDrift: 0,
        },
      };
    });

    void get().triggerRecompute();
  },
  rotationPlanes: [],
  setRotationPlanes: (rotationPlanes) => set((state) => {
    const startTime = state.rotationConfig.profilingEnabled ? performance.now() : 0;

    // Use native WASM rotation if available, otherwise fall back to JS
    const { matrix: rotationMatrix, drift } = applyRotationPlanesNative(
      state.dimension,
      rotationPlanes,
      state.geometry.rotationMatrix,
      state.rotationConfig
    );

    const endTime = state.rotationConfig.profilingEnabled ? performance.now() : 0;

    if (state.rotationConfig.profilingEnabled) {
      console.log(`[Rotation Profile] Applied ${rotationPlanes.length} planes in ${(endTime - startTime).toFixed(3)}ms, drift=${drift.toFixed(6)}`);
    }

    const projectedPositions = projectGeometryNative(
      state.geometry.vertices,
      rotationMatrix,
      state.geometry.basis,
      state.dimension,
      state.geometry.vertexCount
    );

    return {
      rotationPlanes,
      rotationConfig: {
        ...state.rotationConfig,
        rotationFrameCount: state.rotationConfig.rotationFrameCount + 1,
        lastDrift: drift,
      },
      geometry: {
        ...state.geometry,
        rotationMatrix,
        projectedPositions,
      },
    };
  }),
  rotationConfig: {
    qrCadence: 100, // Re-orthonormalize every 100 frames by default
    qrThreshold: 0.01, // Trigger QR if drift exceeds 0.01
    rotationFrameCount: 0,
    lastDrift: 0,
    profilingEnabled: false,
  },
  setRotationConfig: (config) => set((state) => ({
    rotationConfig: { ...state.rotationConfig, ...config },
  })),
  basis: "standard",
  setBasis: (basis) => set((state) => {
    let nextBasis3: Float32Array;
    
    switch (basis) {
      case "pca":
        nextBasis3 = state.pcaBasis;
        break;
      case "standard":
        nextBasis3 = createStandardBasis3(state.dimension);
        break;
      case "random":
        nextBasis3 = createRandomONB(state.dimension);
        break;
      case "custom":
        nextBasis3 = state.geometry.basis;
        break;
    }

    return {
      basis,
      geometry: {
        ...state.geometry,
        basis: nextBasis3,
        projectedPositions: projectGeometryNative(
          state.geometry.vertices,
          state.geometry.rotationMatrix,
          nextBasis3,
          state.dimension,
          state.geometry.vertexCount
        ),
      },
    };
  }),
  pcaBasis: initialPca.basis,
  pcaEigenvalues: initialPca.eigenvalues,
  pcaVariance: deriveVariance(initialPca.eigenvalues),
  setPcaResult: (result) => set({
    pcaBasis: result.basis,
    pcaEigenvalues: result.eigenvalues,
    pcaVariance: deriveVariance(result.eigenvalues),
  }),

  // Hyperplane state
  hyperplane: createDefaultHyperplane(4),
  setHyperplane: (config) => set((state) => ({
    hyperplane: { ...state.hyperplane, ...config },
  })),

  // Function state
  functionConfig: {
    expression: "",
    type: "scalar",
    isValid: false,
    errorMessage: null,
    programBytecode: null,
  },
  setFunctionExpression: (expression) => set((state) => ({
    functionConfig: { ...state.functionConfig, expression },
  })),
  setFunctionValid: (isValid, errorMessage, programBytecode) => set((state) => ({
    functionConfig: { ...state.functionConfig, isValid, errorMessage, programBytecode },
  })),

  // Calculus state
  calculus: {
    showGradient: false,
    showHessian: false,
    showTangentPlane: false,
    showLevelSets: false,
    levelSetValues: [],
    gradientScale: 1.0,
    probePoint: null,
    adMode: "forward",
  },
  setCalculus: (config) => set((state) => ({
    calculus: { ...state.calculus, ...config },
  })),

  // Export state
  exportConfig: {
    format: "png",
    resolution: [1920, 1080],
    fps: 30,
    duration: 5,
    includeOverlays: true,
  },
  setExportConfig: (config) => set((state) => ({
    exportConfig: { ...state.exportConfig, ...config },
  })),

  // Overlay state
  overlays: {
    sliceGeometry: null,
    levelSetCurves: null,
    levelSetPointClouds: null,
    gradientVectors: null,
    tangentPatch: null,
  },
  setOverlays: (overlays) => set((state) => ({
    overlays: { ...state.overlays, ...overlays },
  })),

  geometry: generateHypercubeGeometry(4),
  setGeometry: (geometry) => set({ geometry }),

  // Compute status
  computeStatus: {
    isComputing: false,
    lastError: null,
    lastComputeTime: 0,
  },
  setComputeStatus: (status) => set((state) => ({
    computeStatus: { ...state.computeStatus, ...status },
  })),

  // Async recompute trigger
  triggerRecompute: async () => {
    const state = get();
    set({ computeStatus: { ...state.computeStatus, isComputing: true, lastError: null } });

    const startTime = performance.now();
    try {
      // Import dynamically to avoid circular dependencies
      const { computeOverlays } = await import("@/wasm/hyperviz");

      const result = await computeOverlays(
        state.geometry,
        state.hyperplane,
        state.functionConfig,
        state.calculus,
        state.dimension
      );

      if (result.error) {
        set({
          computeStatus: {
            isComputing: false,
            lastError: result.error,
            lastComputeTime: performance.now() - startTime,
          },
        });
      } else {
        set({
          overlays: result.overlays,
          computeStatus: {
            isComputing: false,
            lastError: null,
            lastComputeTime: performance.now() - startTime,
          },
        });
      }
    } catch (error) {
      set({
        computeStatus: {
          isComputing: false,
          lastError: error instanceof Error ? error.message : "Unknown compute error",
          lastComputeTime: performance.now() - startTime,
        },
      });
    }
  },
}));

// --- helpers ----------------------------------------------------------------

export function generateHypercubeGeometry(dimension: number): GeometryState {
  const cappedDimension = Math.min(dimension, MAX_DIMENSION);
  const fullVertexCount = 1 << cappedDimension;
  
  const shouldApplyLOD = fullVertexCount > MAX_VERTICES;
  const vertexCount = shouldApplyLOD ? MAX_VERTICES : fullVertexCount;
  const edgeCount = cappedDimension * (vertexCount >> 1);

  const vertices = new Float32Array(cappedDimension * vertexCount);
  
  if (shouldApplyLOD) {
    const step = Math.floor(fullVertexCount / vertexCount);
    for (let i = 0; i < vertexCount; i += 1) {
      const vIndex = i * step;
      for (let axis = 0; axis < cappedDimension; axis += 1) {
        const bit = (vIndex >> axis) & 1;
        vertices[axis * vertexCount + i] = bit === 1 ? 1 : -1;
      }
    }
  } else {
    for (let axis = 0; axis < cappedDimension; axis += 1) {
      const axisOffset = axis * vertexCount;
      for (let v = 0; v < vertexCount; v += 1) {
        const bit = (v >> axis) & 1;
        vertices[axisOffset + v] = bit === 1 ? 1 : -1;
      }
    }
  }

  const edges = new Uint32Array(edgeCount * 2);
  let edgeCursor = 0;
  for (let axis = 0; axis < cappedDimension; axis += 1) {
    const mask = 1 << axis;
    for (let v = 0; v < vertexCount; v += 1) {
      const neighbor = v ^ mask;
      if (v < neighbor && neighbor < vertexCount) {
        edges[edgeCursor++] = v;
        edges[edgeCursor++] = neighbor;
      }
    }
  }

  const rotationMatrix = createIdentityMatrix(cappedDimension);
  const basis = createStandardBasis3(cappedDimension);
  const projectedPositions = projectGeometryNative(
    vertices,
    rotationMatrix,
    basis,
    cappedDimension,
    vertexCount
  );

  return {
    dimension: cappedDimension,
    vertexCount,
    edgeCount: edgeCursor / 2,
    vertices,
    edges,
    rotationMatrix,
    basis,
    projectedPositions,
  };
}

function createIdentityMatrix(dimension: number): Float32Array {
  const matrix = new Float32Array(dimension * dimension);
  for (let i = 0; i < dimension; i += 1) {
    matrix[i * dimension + i] = 1;
  }
  return matrix;
}

function createStandardBasis3(dimension: number): Float32Array {
  const basis = new Float32Array(3 * dimension);
  for (let component = 0; component < 3; component += 1) {
    if (component < dimension) {
      basis[component * dimension + component] = 1;
    }
  }
  return basis;
}

function applyRotationPlanesNative(
  dimension: number,
  planes: RotationPlane[],
  existingMatrix: Float32Array,
  config: RotationConfig
): { matrix: Float32Array; drift: number } {
  const matrix = new Float32Array(existingMatrix);

  try {
    wasmBindings.applyRotations(matrix, dimension, planes);
  } catch (error) {
    console.warn("[Rotation] applyRotations failed; continuing with fallback result", error);
  }

  const frameCount = config.rotationFrameCount + 1;
  const shouldCheckDrift = config.qrCadence > 0 && frameCount % config.qrCadence === 0;

  let drift = wasmBindings.computeOrthogonalityDrift(matrix, dimension);

  if (config.profilingEnabled && (shouldCheckDrift || config.qrThreshold > 0)) {
    console.log(`[Rotation Drift] Frame ${frameCount}: drift = ${drift.toFixed(6)}`);
  }

  const thresholdTriggered = config.qrThreshold > 0 && drift > config.qrThreshold;
  const cadenceTriggered = config.qrThreshold <= 0 && shouldCheckDrift && drift > 0;

  if (thresholdTriggered || cadenceTriggered) {
    try {
      wasmBindings.reorthonormalize(matrix, dimension);
    } catch (error) {
      console.warn("[Rotation] reorthonormalize failed; leaving matrix as-is", error);
    }

    if (config.profilingEnabled) {
      const reason = thresholdTriggered ? `threshold ${config.qrThreshold}` : "cadence";
      console.log(`[Rotation QR] Drift ${drift.toFixed(6)} triggered ${reason}, re-orthonormalized`);
    }

    drift = wasmBindings.computeOrthogonalityDrift(matrix, dimension);
  }

  return { matrix, drift };
}

function projectGeometryNative(
  vertices: Float32Array,
  rotationMatrix: Float32Array,
  basis: Float32Array,
  dimension: number,
  vertexCount: number
): Float32Array {
  const out = new Float32Array(vertexCount * 3);
  try {
    const ok = wasmBindings.projectGeometry(vertices, dimension, vertexCount, rotationMatrix, basis, out);
    if (!ok && import.meta.env.DEV) {
      console.warn("[Geometry] projectGeometry returned false; output may be stale");
      const fallback = createFallbackBindings();
      fallback.projectGeometry(vertices, dimension, vertexCount, rotationMatrix, basis, out);
    }
  } catch (error) {
    console.warn("[Geometry] projectGeometry threw error; returning zeroed output", error);
    const fallback = createFallbackBindings();
    fallback.projectGeometry(vertices, dimension, vertexCount, rotationMatrix, basis, out);
  }
  return out;
}

function createRandomONB(dimension: number): Float32Array {
  const basis = new Float32Array(3 * dimension);
  const rng = () => Math.random() * 2 - 1;

  for (let component = 0; component < 3; component += 1) {
    const offset = component * dimension;
    
    for (let axis = 0; axis < dimension; axis += 1) {
      basis[offset + axis] = rng();
    }

    for (let prev = 0; prev < component; prev += 1) {
      let dot = 0;
      for (let axis = 0; axis < dimension; axis += 1) {
        dot += basis[prev * dimension + axis] * basis[offset + axis];
      }
      for (let axis = 0; axis < dimension; axis += 1) {
        basis[offset + axis] -= dot * basis[prev * dimension + axis];
      }
    }

    let norm = 0;
    for (let axis = 0; axis < dimension; axis += 1) {
      norm += basis[offset + axis] * basis[offset + axis];
    }
    norm = Math.sqrt(norm);
    if (norm > 1e-6) {
      for (let axis = 0; axis < dimension; axis += 1) {
        basis[offset + axis] /= norm;
      }
    }
  }

  return basis;
}
