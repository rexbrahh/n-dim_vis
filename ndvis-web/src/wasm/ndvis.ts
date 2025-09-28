export type NdvisModule = {
  readonly HEAPF32: Float32Array;
  readonly HEAPU32: Uint32Array;
  _ndvis_generate_hypercube: (dimension: number, vertexPtr: number, edgePtr: number) => void;
  _ndvis_compute_pca_with_values: (
    vertexPtr: number,
    vertexCount: number,
    dimension: number,
    basisPtr: number,
    eigenvaluesPtr: number,
  ) => void;
  _malloc: (bytes: number) => number;
  _free: (ptr: number) => void;
};

export type WasmLoader = () => Promise<NdvisModule>;

export type PcaWorkspace = {
  basis: Float32Array;
  eigenvalues: Float32Array;
};

export type NdvisBindings = {
  module: NdvisModule;
  computePca: (vertices: Float32Array, dimension: number) => PcaWorkspace;
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
// When wiring the real WASM module, ensure _ndvis_compute_pca_with_values, _malloc, and _free are exported.
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

  return { module, computePca };
};

// TODO: Replace stubs with real WASM bindings once ndvis wasm module is emitted; ensure basis/eigenvalue buffers are malloc
// and copied before calling `_ndvis_compute_pca_with_values`.

export const loadNdvis: WasmLoader = async () => {
  if (import.meta.env.DEV) {
    console.warn("WASM module not yet wired; returning stub implementation");
  }

  return {
    HEAPF32: new Float32Array(),
    HEAPU32: new Uint32Array(),
    _ndvis_generate_hypercube() {
      /* no-op stub */
    },
    _ndvis_compute_pca_with_values() {
      throw new Error("ndvis wasm PCA not implemented yet");
    },
    _malloc() {
      throw new Error("ndvis wasm malloc not implemented yet");
    },
    _free() {
      /* no-op stub */
    },
  } satisfies NdvisModule;
};
