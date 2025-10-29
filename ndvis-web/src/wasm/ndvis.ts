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
  _malloc?: (bytes: number) => number;
  _free?: (ptr: number) => void;
  __ndvisStub?: boolean;
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
      if (!isolated) {
        if (import.meta.env.DEV) {
          console.warn(
            "SharedArrayBuffer requires cross-origin isolation (COOP/COEP). Falling back to stub ndvis module."
          );
        }
        return createStubModule();
      }
      try {
        const candidates = import.meta.glob("./ndvis-wasm.js");
        const loadFactory = candidates["./ndvis-wasm.js"];
        if (!loadFactory) {
          if (import.meta.env.DEV) {
            console.warn("ndvis wasm bundle not found; using stub implementation");
          }
          return createStubModule();
        }

        const factoryModule = await loadFactory();
        const createModule = (factoryModule as any).default ?? factoryModule;
        const moduleOptions: Record<string, unknown> = {
          locateFile: (file: string, prefix?: string) => {
            if (file.endsWith(".js") || file.endsWith(".wasm")) {
              return new URL(file, import.meta.url).href;
            }
            return (prefix ?? "") + file;
          },
          mainScriptUrlOrBlob: new URL("./ndvis-wasm.js", import.meta.url).href,
          onAbort: (what: unknown) => {
            console.error("ndvis wasm aborted", what);
          },
        };
        const instance = await createModule(moduleOptions);
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
