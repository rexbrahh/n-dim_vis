import { computePcaFallback, type PcaWorkspace, createBindings } from "@/wasm/ndvis";
import { create } from "zustand";

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
    const rotationMatrix = applyRotationPlanesNative(
      state.dimension,
      rotationPlanes,
      state.geometry.rotationMatrix,
      state.rotationConfig
    );

    const endTime = state.rotationConfig.profilingEnabled ? performance.now() : 0;

    const drift = computeOrthogonalityDrift(rotationMatrix, state.dimension);

    if (state.rotationConfig.profilingEnabled) {
      console.log(`[Rotation Profile] Applied ${rotationPlanes.length} planes in ${(endTime - startTime).toFixed(3)}ms, drift=${drift.toFixed(6)}`);
    }

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
        projectedPositions: projectVerticesTo3(
          state.geometry.vertices,
          rotationMatrix,
          state.geometry.basis,
          state.dimension,
          state.geometry.vertexCount
        ),
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
        projectedPositions: projectVerticesTo3(
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

const MAX_DIMENSION = 12;
const MAX_VERTICES = 150000;

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
  const projectedPositions = projectVerticesTo3(
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

// WASM bindings singleton - initialized on first use
let wasmBindings: Awaited<ReturnType<typeof createBindings>> | null = null;

// Initialize WASM bindings (call this early in app lifecycle)
export async function initializeWasmBindings() {
  if (!wasmBindings) {
    try {
      wasmBindings = await createBindings();
      console.log("[WASM] ndvis bindings initialized successfully");
    } catch (error) {
      console.warn("[WASM] Failed to initialize ndvis bindings, will use JS fallback", error);
    }
  }
  return wasmBindings;
}

function applyRotationPlanesNative(
  dimension: number,
  planes: RotationPlane[],
  existingMatrix: Float32Array,
  config: RotationConfig
): Float32Array {
  // Copy existing matrix to avoid mutation
  const matrix = new Float32Array(existingMatrix);

  // Try native WASM first, fall back to JS
  let usedWasm = false;
  if (wasmBindings) {
    try {
      usedWasm = wasmBindings.applyRotations(matrix, dimension, planes);
    } catch (error) {
      console.warn("[Rotation] WASM call threw error, falling back to JS", error);
    }
  }
  
  // Fall back to JS if WASM unavailable or failed
  if (!usedWasm) {
    applyRotationPlanesJS(matrix, dimension, planes);
  }

  // Check if QR re-orthonormalization is needed
  const frameCount = config.rotationFrameCount + 1;
  const shouldCheckDrift = config.qrCadence > 0 && frameCount % config.qrCadence === 0;

  if (shouldCheckDrift || config.qrThreshold > 0) {
    const drift = computeOrthogonalityDriftWithWasm(matrix, dimension);

    if (config.profilingEnabled) {
      console.log(`[Rotation Drift] Frame ${frameCount}: drift = ${drift.toFixed(6)}`);
    }

    // Re-orthonormalize if threshold exceeded
    if (drift > config.qrThreshold) {
      reorthonormalizeWithWasm(matrix, dimension);
      if (config.profilingEnabled) {
        console.log(`[Rotation QR] Drift ${drift.toFixed(6)} exceeded threshold ${config.qrThreshold}, re-orthonormalized`);
      }
    }
  }

  return matrix;
}

// Pure JS rotation implementation
function applyRotationPlanesJS(matrix: Float32Array, dimension: number, planes: RotationPlane[]): void {
  for (const plane of planes) {
    const { i, j, theta } = plane;
    if (i >= dimension || j >= dimension) continue;

    const c = Math.cos(theta);
    const s = Math.sin(theta);

    for (let row = 0; row < dimension; row += 1) {
      const idxI = row * dimension + i;
      const idxJ = row * dimension + j;

      const a = matrix[idxI];
      const b = matrix[idxJ];

      matrix[idxI] = c * a - s * b;
      matrix[idxJ] = s * a + c * b;
    }
  }
}

function computeOrthogonalityDriftWithWasm(matrix: Float32Array, dimension: number): number {
  if (wasmBindings) {
    try {
      const drift = wasmBindings.computeOrthogonalityDrift(matrix, dimension);
      if (drift >= 0) {
        return drift;
      }
    } catch {
      // Fall through to JS
    }
  }
  return computeOrthogonalityDrift(matrix, dimension);
}

function reorthonormalizeWithWasm(matrix: Float32Array, dimension: number): void {
  let usedWasm = false;
  if (wasmBindings) {
    try {
      usedWasm = wasmBindings.reorthonormalize(matrix, dimension);
    } catch {
      // Fall through to JS
    }
  }
  
  // Fall back to JS if WASM unavailable or failed
  if (!usedWasm) {
    reorthonormalizeMatrix(matrix, dimension);
  }
}

function computeOrthogonalityDrift(matrix: Float32Array, dimension: number): number {
  // Compute Frobenius norm of (R^T R - I)
  // TODO: Use native WASM ndvis_compute_orthogonality_drift when available
  let drift = 0;

  for (let i = 0; i < dimension; i += 1) {
    for (let j = 0; j < dimension; j += 1) {
      // Compute (R^T R)_ij = sum_k R[k,i] * R[k,j]
      let rtR_ij = 0;
      for (let k = 0; k < dimension; k += 1) {
        rtR_ij += matrix[k * dimension + i] * matrix[k * dimension + j];
      }

      // Subtract I_ij
      if (i === j) {
        rtR_ij -= 1;
      }

      drift += rtR_ij * rtR_ij;
    }
  }

  return Math.sqrt(drift);
}

function reorthonormalizeMatrix(matrix: Float32Array, dimension: number): void {
  // Modified Gram-Schmidt QR decomposition (in-place)
  // TODO: Use native WASM ndvis_reorthonormalize when available
  
  const column = new Float32Array(dimension);

  for (let col = 0; col < dimension; col += 1) {
    // Extract column
    for (let row = 0; row < dimension; row += 1) {
      column[row] = matrix[row * dimension + col];
    }

    // Orthogonalize against previous columns
    for (let prev = 0; prev < col; prev += 1) {
      let dot = 0;
      for (let row = 0; row < dimension; row += 1) {
        dot += matrix[row * dimension + prev] * column[row];
      }
      for (let row = 0; row < dimension; row += 1) {
        column[row] -= dot * matrix[row * dimension + prev];
      }
    }

    // Normalize
    let norm = 0;
    for (let row = 0; row < dimension; row += 1) {
      norm += column[row] * column[row];
    }

    if (norm > 0) {
      const invNorm = 1 / Math.sqrt(norm);
      for (let row = 0; row < dimension; row += 1) {
        matrix[row * dimension + col] = column[row] * invNorm;
      }
    } else {
      // Fallback: use standard basis vector
      for (let row = 0; row < dimension; row += 1) {
        matrix[row * dimension + col] = row === col ? 1 : 0;
      }
    }
  }
}

function projectVerticesTo3(
  vertices: Float32Array,
  rotationMatrix: Float32Array,
  basis: Float32Array,
  dimension: number,
  vertexCount: number
): Float32Array {
  const out = new Float32Array(vertexCount * 3);
  const scratch = new Float32Array(dimension);
  const rotated = new Float32Array(dimension);

  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    for (let axis = 0; axis < dimension; axis += 1) {
      scratch[axis] = vertices[axis * vertexCount + vertex];
    }

    for (let row = 0; row < dimension; row += 1) {
      let sum = 0;
      const rowOffset = row * dimension;
      for (let col = 0; col < dimension; col += 1) {
        sum += rotationMatrix[rowOffset + col] * scratch[col];
      }
      rotated[row] = sum;
    }

    for (let component = 0; component < 3; component += 1) {
      let sum = 0;
      const basisOffset = component * dimension;
      for (let axis = 0; axis < dimension; axis += 1) {
        sum += rotated[axis] * basis[basisOffset + axis];
      }
      out[vertex * 3 + component] = sum;
    }
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
