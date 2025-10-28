import { computePcaFallback, type PcaWorkspace } from "@/wasm/ndvis";
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
};

export type FunctionConfig = {
  expression: string;
  type: "scalar" | "vector";
  isValid: boolean;
  errorMessage: string | null;
  programBytecode: Uint8Array | null;
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
  gradientVectors: Float32Array | null;
  tangentPatch: Float32Array | null;
};

export type ComputeStatus = {
  isComputing: boolean;
  lastError: string | null;
  lastComputeTime: number;
};

type AppState = {
  dimension: number;
  setDimension: (dimension: number) => void;
  rotationPlanes: RotationPlane[];
  setRotationPlanes: (planes: RotationPlane[]) => void;
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
      };
    });
  },
  rotationPlanes: [],
  setRotationPlanes: (rotationPlanes) => set({ rotationPlanes }),
  basis: "standard",
  setBasis: (basis) => set({ basis }),
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
    gradientVectors: null,
    tangentPatch: null,
  },
  setOverlays: (overlays) => set((state) => ({
    overlays: { ...state.overlays, ...overlays },
  })),

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
