import createNdvisModuleRaw from "./ndvis-wasm.js";

export type NdvisModule = {
  readonly HEAPF32: Float32Array;
  readonly HEAPU8: Uint8Array;
  readonly HEAPU32: Uint32Array;
  readonly HEAP32: Int32Array;
  _ndvis_generate_hypercube?: (dimension: number, vertexPtr: number, edgePtr: number) => void;
  _ndvis_compute_pca_with_values?: (
    vertexPtr: number,
    vertexCount: number,
    dimension: number,
    basisPtr: number,
    eigenvaluesPtr: number,
  ) => void;
  _ndvis_compute_overlays?: (
    geometryPtr: number,
    hyperplanePtr: number,
    calculusPtr: number,
    buffersPtr: number,
  ) => number;
  _ndvis_apply_rotations?: (
    matrixPtr: number,
    order: number,
    planesPtr: number,
    planeCount: number,
  ) => void;
  _ndvis_compute_orthogonality_drift?: (matrixPtr: number, order: number) => number;
  _ndvis_reorthonormalize?: (matrixPtr: number, order: number) => void;
  _malloc?: (bytes: number) => number;
  _free?: (ptr: number) => void;
  __ndvisStub?: boolean;
};

export type WasmLoader = () => Promise<NdvisModule>;

export type PcaWorkspace = {
  basis: Float32Array;
  eigenvalues: Float32Array;
};

export type RotationPlane = {
  i: number;
  j: number;
  theta: number;
};

export type NdvisBindings = {
  module: NdvisModule;
  computePca: (vertices: Float32Array, dimension: number) => PcaWorkspace;
  applyRotations: (matrix: Float32Array, order: number, planes: RotationPlane[]) => boolean;
  computeOrthogonalityDrift: (matrix: Float32Array, order: number) => number;
  reorthonormalize: (matrix: Float32Array, order: number) => boolean;
};

const bytesPerFloat = Float32Array.BYTES_PER_ELEMENT;

const copyArrayToHeap = (module: NdvisModule, array: Float32Array) => {
  const ptr = module._malloc(array.length * bytesPerFloat);
  module.HEAPF32.set(array, ptr / bytesPerFloat);
  return ptr;
};

const copyHeapToArray = (module: NdvisModule, ptr: number, target: Float32Array) => {
  const view = module.HEAPF32.subarray(ptr / bytesPerFloat, ptr / bytesPerFloat + target.length);
  target.set(view);
};

const textEncoder = new TextEncoder();
const usePthreads = import.meta.env?.VITE_NDVIS_USE_PTHREADS === "1";

const ensureUtf8Helpers = (module: NdvisModule) => {
  const mutableModule = module as NdvisModule & {
    stringToUTF8?: (value: string, ptr: number, maxBytesToWrite: number) => void;
    lengthBytesUTF8?: (value: string) => number;
  };

  if (!mutableModule.lengthBytesUTF8) {
    mutableModule.lengthBytesUTF8 = (value) => textEncoder.encode(value).length;
  }

  if (!mutableModule.stringToUTF8) {
    mutableModule.stringToUTF8 = (value, ptr, maxBytesToWrite) => {
      if (maxBytesToWrite <= 0) {
        return;
      }
      const encoded = textEncoder.encode(value);
      const bytesToWrite = Math.min(encoded.length, Math.max(0, maxBytesToWrite - 1));
      module.HEAPU8.subarray(ptr, ptr + bytesToWrite).set(encoded.subarray(0, bytesToWrite));
      module.HEAPU8[ptr + bytesToWrite] = 0;
    };
  }
};

export const createPcaWorkspace = (dimension: number): PcaWorkspace => ({
  basis: new Float32Array(dimension * 3),
  eigenvalues: new Float32Array(dimension),
});

export const computePcaFallback = (dimension: number): PcaWorkspace => {
  const workspace = createPcaWorkspace(dimension);
  for (let component = 0; component < 3; component += 1) {
    for (let axis = 0; axis < dimension; axis += 1) {
      workspace.basis[component * dimension + axis] = component === axis ? 1 : 0;
    }
  }
  if (dimension > 0) {
    workspace.eigenvalues[0] = 1;
  }
  return workspace;
};

export const createBindings = async (): Promise<NdvisBindings> => {
  const module = await loadNdvis();
  
  const computePca = (vertices: Float32Array, dimension: number): PcaWorkspace => {
    if (!module._ndvis_compute_pca_with_values || !module._malloc || !module._free) {
      console.warn("ndvis WASM module missing PCA exports; falling back to identity basis");
      return computePcaFallback(dimension);
    }

    const workspace = createPcaWorkspace(dimension);
    const vertexPtr = copyArrayToHeap(module, vertices);
    const basisPtr = module._malloc(workspace.basis.length * bytesPerFloat);
    const eigenPtr = module._malloc(workspace.eigenvalues.length * bytesPerFloat);

    if (!vertexPtr || !basisPtr || !eigenPtr) {
      console.warn("ndvis WASM malloc failed; using fallback PCA");
      if (vertexPtr) module._free(vertexPtr);
      if (basisPtr) module._free(basisPtr);
      if (eigenPtr) module._free(eigenPtr);
      return computePcaFallback(dimension);
    }

    module._ndvis_compute_pca_with_values(vertexPtr, vertices.length / dimension, dimension, basisPtr, eigenPtr);
    copyHeapToArray(module, basisPtr, workspace.basis);
    copyHeapToArray(module, eigenPtr, workspace.eigenvalues);

    module._free(vertexPtr);
    module._free(basisPtr);
    module._free(eigenPtr);
    return workspace;
  };

  const applyRotations = (matrix: Float32Array, order: number, planes: RotationPlane[]): boolean => {
    if (!module._ndvis_apply_rotations || !module._malloc || !module._free) {
      return false; // Signal failure so caller can fall back to JS
    }

    const matrixPtr = copyArrayToHeap(module, matrix);
    const planesSize = planes.length * 12; // 12 bytes per plane (u32, u32, f32)
    const planesPtr = module._malloc?.(planesSize);

    if (!matrixPtr || !planesPtr) {
      if (matrixPtr) module._free?.(matrixPtr);
      if (planesPtr) module._free?.(planesPtr);
      return false;
    }

    // Pack planes as u32, u32, f32 (12 bytes per plane, no padding)
    const planesView = new Uint32Array(planes.length * 3);
    const planesFloatView = new Float32Array(planesView.buffer);
    for (let p = 0; p < planes.length; p += 1) {
      planesView[p * 3] = planes[p].i;
      planesView[p * 3 + 1] = planes[p].j;
      planesFloatView[p * 3 + 2] = planes[p].theta;
    }
    module.HEAPU32.set(planesView, planesPtr / 4);

    module._ndvis_apply_rotations(matrixPtr, order, planesPtr, planes.length);

    // Copy result back
    copyHeapToArray(module, matrixPtr, matrix);

    module._free(matrixPtr);
    module._free(planesPtr);
    return true; // Success
  };

  const computeOrthogonalityDrift = (matrix: Float32Array, order: number): number => {
    if (!module._ndvis_compute_orthogonality_drift || !module._malloc || !module._free) {
      return -1; // Signal to caller to use JS fallback
    }

    const matrixPtr = copyArrayToHeap(module, matrix);
    if (!matrixPtr) {
      return -1;
    }

    const drift = module._ndvis_compute_orthogonality_drift(matrixPtr, order);
    module._free(matrixPtr);
    return drift;
  };

  const reorthonormalize = (matrix: Float32Array, order: number): boolean => {
    if (!module._ndvis_reorthonormalize || !module._malloc || !module._free) {
      return false; // Signal failure so caller can fall back to JS
    }

    const matrixPtr = copyArrayToHeap(module, matrix);
    if (!matrixPtr) {
      return false;
    }

    module._ndvis_reorthonormalize(matrixPtr, order);
    copyHeapToArray(module, matrixPtr, matrix);
    module._free(matrixPtr);
    return true; // Success
  };

  return { module, computePca, applyRotations, computeOrthogonalityDrift, reorthonormalize };
};

const createStubModule = (): NdvisModule => ({
  HEAPF32: new Float32Array(),
  HEAPU8: new Uint8Array(),
  HEAPU32: new Uint32Array(),
  HEAP32: new Int32Array(),
  _ndvis_generate_hypercube() {
    /* no-op stub */
  },
  __ndvisStub: true,
});

let modulePromise: Promise<NdvisModule> | null = null;

export const loadNdvis: WasmLoader = async () => {
  if (!modulePromise) {
    modulePromise = (async () => {
      const isolated = typeof crossOriginIsolated === "boolean" ? crossOriginIsolated : true;
      if (usePthreads && !isolated) {
        if (import.meta.env.DEV) {
          console.warn(
            "SharedArrayBuffer requires cross-origin isolation (COOP/COEP). Falling back to stub ndvis module."
          );
        }
        return createStubModule();
      }
      try {
        const wasmBase = "/wasm/";
        const cacheBuster = import.meta.env.DEV ? `?dev=${Date.now()}` : "";
        const scriptUrl = new URL("./ndvis-wasm.js", import.meta.url).href;
        const moduleOptions: Record<string, unknown> = {
          locateFile: (file: string) => {
            if (file.endsWith(".wasm")) {
              return `${wasmBase}${file}${cacheBuster}`;
            }
            return new URL(`./${file}`, import.meta.url).href;
          },
          mainScriptUrlOrBlob: scriptUrl,
          onAbort: (what: unknown) => {
            console.error("ndvis wasm aborted", what);
          },
        };
        if (usePthreads) {
          moduleOptions.worker = true;
        }
        const instance = await createNdvisModuleRaw(moduleOptions);
        ensureUtf8Helpers(instance as NdvisModule);
        return instance as NdvisModule;
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn("Failed to load ndvis wasm module; falling back to stub", error);
        }
        return createStubModule();
      }
    })();
  }

  return modulePromise;
};
