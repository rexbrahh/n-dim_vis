import { describe, it, expect, vi, afterEach } from "vitest";

import type { HyperplaneConfig, FunctionConfig, CalculusConfig } from "@/state/appState";

vi.mock("./ndvis-wasm.js", () => ({
  default: () =>
    Promise.resolve({
      _malloc: () => 0,
      _free: () => {},
      HEAPF32: new Float32Array(),
      HEAPU8: new Uint8Array(),
      HEAPU32: new Uint32Array(),
      HEAP32: new Int32Array(),
    }),
}));

const bytesPerFloat = Float32Array.BYTES_PER_ELEMENT;

const createNdcalcStub = () => ({
  ErrorCode: {
    OK: 0,
    PARSE: 1,
    INVALID_EXPR: 2,
    EVAL: 3,
    OUT_OF_MEMORY: 4,
    INVALID_DIMENSION: 5,
    NULL_POINTER: 6,
  },
  ADMode: {
    AUTO: 0,
    FORWARD: 1,
    FINITE_DIFF: 2,
  },
  default: () =>
    Promise.resolve({
      contextCreate: () => 1,
      contextDestroy: () => {},
      compile: () => [0, 1],
      programDestroy: () => {},
      gradient: () => [0, []],
      hessian: () => [0, []],
      eval: () => [0, 0],
      evalBatch: () => [0, []],
      setADMode: () => {},
      setFDEpsilon: () => {},
      programSetADMode: () => {},
      programSetFDEpsilon: () => {},
      errorString: () => "OK",
      getLastErrorMessage: () => "",
    }),
});

const createNdvisModuleStub = () => {
  const memory = new ArrayBuffer(1 << 20); // 1 MiB scratch memory
  let offset = 0x1000;

  return {
    HEAPF32: new Float32Array(memory),
    HEAPU8: new Uint8Array(memory),
    HEAPU32: new Uint32Array(memory),
    HEAP32: new Int32Array(memory),
    _malloc: (bytes: number) => {
      const aligned = (bytes + 7) & ~7;
      const ptr = offset;
      offset += aligned;
      return ptr;
    },
    _free: () => {
      /* arena frees in LIFO order; noop is fine for test */
    },
  } as unknown as {
    HEAPF32: Float32Array;
    HEAPU8: Uint8Array;
    HEAPU32: Uint32Array;
    HEAP32: Int32Array;
    _malloc: (bytes: number) => number;
    _free: (ptr: number) => void;
    _ndvis_compute_overlays?: (
      geometryPtr: number,
      hyperplanePtr: number,
      calculusPtr: number,
      buffersPtr: number,
    ) => number;
  };
};

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.doUnmock("@/wasm/ndvis");
  vi.doUnmock("@/wasm/ndcalc/index.js");
});

describe("hyperviz wasm integration", () => {
  it("prefers the WASM overlay path when bindings are available", async () => {
    const moduleStub = createNdvisModuleStub();
    const sliceData = new Float32Array([1, 0, 0, -1, 0, 0]);
    const computeSpy = vi.fn((geometryPtr: number, hyperplanePtr: number, calculusPtr: number, buffersPtr: number) => {
      const base = buffersPtr >> 2;
      const slicePositionsPtr = moduleStub.HEAPU32[base + 2];
      const sliceCapacity = moduleStub.HEAPU32[base + 3];
      const sliceCountPtr = moduleStub.HEAPU32[base + 4];

      if (slicePositionsPtr && sliceCountPtr) {
        const floatsIndex = slicePositionsPtr / bytesPerFloat;
        const sliceCount = Math.min(sliceCapacity, 2);
        moduleStub.HEAPU32[sliceCountPtr >> 2] = sliceCount;
        moduleStub.HEAPF32.set(sliceData.subarray(0, sliceCount * 3), floatsIndex);
      }

      return 0;
    });
    moduleStub._ndvis_compute_overlays = computeSpy;

    vi.doMock("@/wasm/ndcalc/index.js", () => createNdcalcStub());

    vi.doMock("@/wasm/ndvis", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/wasm/ndvis")>();
      const fallback = actual.createFallbackBindings();
      return {
        ...actual,
        createBindings: async () => ({
          ...fallback,
          module: moduleStub,
          computePca: (_vertices: Float32Array, dimension: number) => actual.computePcaFallback(dimension),
        }),
      };
    });

    const [{ computeOverlays }, { generateHypercubeGeometry }] = await Promise.all([
      import("@/wasm/hyperviz"),
      import("@/state/appState"),
    ]);

    const dimension = 3;
    const geometry = generateHypercubeGeometry(dimension);

    const hyperplane: HyperplaneConfig = {
      enabled: true,
      showIntersection: true,
      intersectionColor: [1, 1, 1],
      coefficients: new Float32Array([1, 0, 0]),
      offset: 0,
    } as HyperplaneConfig;

    const functionConfig: FunctionConfig = {
      expression: "",
      type: "scalar",
      isValid: false,
      errorMessage: null,
      programBytecode: null,
    };

    const calculus: CalculusConfig = {
      showGradient: false,
      showHessian: false,
      showTangentPlane: false,
      showLevelSets: false,
      levelSetValues: [],
      gradientScale: 1,
      probePoint: null,
      adMode: "forward",
    };

    const result = await computeOverlays(geometry, hyperplane, functionConfig, calculus, dimension);

    expect(result.error).toBeNull();
    expect(computeSpy).toHaveBeenCalledTimes(1);
    expect(result.overlays.sliceGeometry).not.toBeNull();
    expect(Array.from(result.overlays.sliceGeometry ?? [])).toEqual(Array.from(sliceData));
  });
});
