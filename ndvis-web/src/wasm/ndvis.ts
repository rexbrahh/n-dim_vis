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
  _ndvis_project_geometry?: (
    verticesPtr: number,
    vertexCount: number,
    dimension: number,
    rotationPtr: number,
    rotationStride: number,
    basisPtr: number,
    basisStride: number,
    outPtr: number,
    outLength: number,
  ) => void;
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
  projectGeometry: (
    vertices: Float32Array,
    dimension: number,
    vertexCount: number,
    rotationMatrix: Float32Array,
    basis: Float32Array,
    out: Float32Array
  ) => boolean;
};

const bytesPerFloat = Float32Array.BYTES_PER_ELEMENT;

const copyArrayToHeap = (module: NdvisModule, array: Float32Array) => {
  if (!module._malloc) {
    return 0;
  }
  const ptr = module._malloc(array.length * bytesPerFloat);
  if (!ptr) {
    return 0;
  }
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

const applyRotationsFallback = (matrix: Float32Array, order: number, planes: RotationPlane[]): void => {
  for (const plane of planes) {
    const { i, j, theta } = plane;
    if (i >= order || j >= order) {
      continue;
    }

    const c = Math.cos(theta);
    const s = Math.sin(theta);

    for (let row = 0; row < order; row += 1) {
      const idxI = row * order + i;
      const idxJ = row * order + j;

      const a = matrix[idxI];
      const b = matrix[idxJ];

      matrix[idxI] = c * a - s * b;
      matrix[idxJ] = s * a + c * b;
    }
  }
};

const computeOrthogonalityDriftFallback = (matrix: Float32Array, dimension: number): number => {
  let drift = 0;

  for (let i = 0; i < dimension; i += 1) {
    for (let j = 0; j < dimension; j += 1) {
      let rtRij = 0;
      for (let k = 0; k < dimension; k += 1) {
        rtRij += matrix[k * dimension + i] * matrix[k * dimension + j];
      }

      if (i === j) {
        rtRij -= 1;
      }

      drift += rtRij * rtRij;
    }
  }

  return Math.sqrt(drift);
};

const reorthonormalizeFallback = (matrix: Float32Array, dimension: number): void => {
  const column = new Float32Array(dimension);

  for (let col = 0; col < dimension; col += 1) {
    for (let row = 0; row < dimension; row += 1) {
      column[row] = matrix[row * dimension + col];
    }

    for (let prev = 0; prev < col; prev += 1) {
      let dot = 0;
      for (let row = 0; row < dimension; row += 1) {
        dot += matrix[row * dimension + prev] * column[row];
      }
      for (let row = 0; row < dimension; row += 1) {
        column[row] -= dot * matrix[row * dimension + prev];
      }
    }

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
      for (let row = 0; row < dimension; row += 1) {
        matrix[row * dimension + col] = row === col ? 1 : 0;
      }
    }
  }
};

const projectGeometryFallback = (
  vertices: Float32Array,
  dimension: number,
  vertexCount: number,
  rotationMatrix: Float32Array,
  basis: Float32Array,
  out: Float32Array
): void => {
  if (out.length < vertexCount * 3) {
    return;
  }

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
};

const createBindingFromModule = (module: NdvisModule): NdvisBindings => {
  const malloc = module._malloc;
  const free = module._free;
  const hasAlloc = typeof malloc === "function" && typeof free === "function";
  const isStub = module.__ndvisStub === true;

  const computePca = (vertices: Float32Array, dimension: number): PcaWorkspace => {
    if (!module._ndvis_compute_pca_with_values || !hasAlloc) {
      if (!isStub && import.meta.env.DEV) {
        console.warn("ndvis WASM module missing PCA exports; falling back to identity basis");
      }
      return computePcaFallback(dimension);
    }

    const workspace = createPcaWorkspace(dimension);
    const vertexPtr = copyArrayToHeap(module, vertices);
    const basisPtr = malloc!(workspace.basis.length * bytesPerFloat);
    const eigenPtr = malloc!(workspace.eigenvalues.length * bytesPerFloat);

    if (!vertexPtr || !basisPtr || !eigenPtr) {
      if (import.meta.env.DEV) {
        console.warn("ndvis WASM malloc failed; using fallback PCA");
      }
      if (vertexPtr) free!(vertexPtr);
      if (basisPtr) free!(basisPtr);
      if (eigenPtr) free!(eigenPtr);
      return computePcaFallback(dimension);
    }

    module._ndvis_compute_pca_with_values(vertexPtr, vertices.length / dimension, dimension, basisPtr, eigenPtr);
    copyHeapToArray(module, basisPtr, workspace.basis);
    copyHeapToArray(module, eigenPtr, workspace.eigenvalues);

    free!(vertexPtr);
    free!(basisPtr);
    free!(eigenPtr);
    return workspace;
  };

  const applyRotations = (matrix: Float32Array, order: number, planes: RotationPlane[]): boolean => {
    if (!module._ndvis_apply_rotations || !hasAlloc || isStub) {
      applyRotationsFallback(matrix, order, planes);
      return true;
    }

    const matrixPtr = copyArrayToHeap(module, matrix);
    const planesPtr = malloc!(planes.length * 12);

    if (!matrixPtr || !planesPtr) {
      if (matrixPtr) free!(matrixPtr);
      if (planesPtr) free!(planesPtr);
      applyRotationsFallback(matrix, order, planes);
      return false;
    }

    const planesView = new Uint32Array(planes.length * 3);
    const planesFloatView = new Float32Array(planesView.buffer);
    for (let p = 0; p < planes.length; p += 1) {
      planesView[p * 3] = planes[p].i;
      planesView[p * 3 + 1] = planes[p].j;
      planesFloatView[p * 3 + 2] = planes[p].theta;
    }
    module.HEAPU32.set(planesView, planesPtr / 4);

    module._ndvis_apply_rotations(matrixPtr, order, planesPtr, planes.length);
    copyHeapToArray(module, matrixPtr, matrix);

    free!(matrixPtr);
    free!(planesPtr);
    return true;
  };

  const computeOrthogonalityDrift = (matrix: Float32Array, order: number): number => {
    if (!module._ndvis_compute_orthogonality_drift || !hasAlloc || isStub) {
      return computeOrthogonalityDriftFallback(matrix, order);
    }

    const matrixPtr = copyArrayToHeap(module, matrix);
    if (!matrixPtr) {
      return computeOrthogonalityDriftFallback(matrix, order);
    }

    const drift = module._ndvis_compute_orthogonality_drift(matrixPtr, order);
    free!(matrixPtr);
    return drift;
  };

  const reorthonormalize = (matrix: Float32Array, order: number): boolean => {
    if (!module._ndvis_reorthonormalize || !hasAlloc || isStub) {
      reorthonormalizeFallback(matrix, order);
      return true;
    }

    const matrixPtr = copyArrayToHeap(module, matrix);
    if (!matrixPtr) {
      reorthonormalizeFallback(matrix, order);
      return false;
    }

    module._ndvis_reorthonormalize(matrixPtr, order);
    copyHeapToArray(module, matrixPtr, matrix);
    free!(matrixPtr);
    return true;
  };

  const projectGeometry = (
    vertices: Float32Array,
    dimension: number,
    vertexCount: number,
    rotationMatrix: Float32Array,
    basis: Float32Array,
    out: Float32Array
  ): boolean => {
    if (!module._ndvis_project_geometry || !hasAlloc || isStub) {
      projectGeometryFallback(vertices, dimension, vertexCount, rotationMatrix, basis, out);
      return true;
    }

    const vertexPtr = copyArrayToHeap(module, vertices);
    const rotationPtr = copyArrayToHeap(module, rotationMatrix);
    const basisPtr = copyArrayToHeap(module, basis);
    const outPtr = malloc!(out.length * bytesPerFloat);

    if (!vertexPtr || !rotationPtr || !basisPtr || !outPtr) {
      if (vertexPtr) free!(vertexPtr);
      if (rotationPtr) free!(rotationPtr);
      if (basisPtr) free!(basisPtr);
      if (outPtr) free!(outPtr);
      projectGeometryFallback(vertices, dimension, vertexCount, rotationMatrix, basis, out);
      return false;
    }

    module._ndvis_project_geometry(
      vertexPtr,
      vertexCount,
      dimension,
      rotationPtr,
      dimension,
      basisPtr,
      dimension,
      outPtr,
      out.length
    );

    copyHeapToArray(module, outPtr, out);

    free!(vertexPtr);
    free!(rotationPtr);
    free!(basisPtr);
    free!(outPtr);
    return true;
  };

  return { module, computePca, applyRotations, computeOrthogonalityDrift, reorthonormalize, projectGeometry };
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

export const createFallbackBindings = (): NdvisBindings => createBindingFromModule(createStubModule());

export const createBindings = async (): Promise<NdvisBindings> => {
  const module = await loadNdvis();
  return createBindingFromModule(module);
};
