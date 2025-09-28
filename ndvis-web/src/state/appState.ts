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

export const useAppState = create<AppState>((set) => ({
  dimension: 4,
  setDimension: (dimension) => {
    const { basis, eigenvalues } = computePcaFallback(dimension);
    set({
      dimension,
      pcaBasis: basis,
      pcaEigenvalues: eigenvalues,
      pcaVariance: deriveVariance(eigenvalues),
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
}));
