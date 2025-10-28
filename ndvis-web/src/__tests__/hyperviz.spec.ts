import { describe, it, expect, beforeEach } from "vitest";

import { computeOverlays, __setNdcalcRuntimeForTests } from "@/wasm/hyperviz";
import { generateHypercubeGeometry } from "@/state/appState";
import type { CalculusConfig, FunctionConfig, HyperplaneConfig } from "@/state/appState";
import { ErrorCode } from "@/wasm/ndcalc/index";

type ProgramRecord = {
  expression: string;
  variables: string[];
  fn: (...args: number[]) => number;
};

type StubModule = {
  contextCreate(): number;
  contextDestroy(ctx: number): void;
  compile(ctx: number, expression: string, variables: string[]): [ErrorCode, number];
  programDestroy(program: number): void;
  gradient(program: number, inputs: number[]): [ErrorCode, number[]];
  hessian(program: number, inputs: number[]): [ErrorCode, number[]];
  eval(program: number, inputs: number[]): [ErrorCode, number];
  evalBatch(program: number, inputArrays: number[][]): [ErrorCode, number[]];
  setADMode(ctx: number, mode: number): void;
  setFDEpsilon(ctx: number, epsilon: number): void;
  errorString(error: ErrorCode): string;
  getLastErrorMessage(ctx: number): string;
};

type NdcalcRuntime = {
  module: StubModule;
  ctx: number;
};

let programCounter = 1;
const programs = new Map<number, ProgramRecord>();

const createStubRuntime = (): NdcalcRuntime => {
  programCounter = 1;
  programs.clear();

  const module: StubModule = {
    contextCreate: () => 1,
    contextDestroy: () => {},
    compile: (_ctx, expression, variables) => {
      try {
        const fn = new Function(...variables, `return ${expression.replace(/\^/g, "**")};`) as (...args: number[]) => number;
        const id = programCounter++;
        programs.set(id, { expression, variables, fn });
        return [ErrorCode.OK, id];
      } catch (error) {
        console.error("Stub compile failed", error);
        return [ErrorCode.PARSE, 0];
      }
    },
    programDestroy: () => {},
    gradient: (program, inputs) => {
      const record = programs.get(program);
      if (!record) {
        return [ErrorCode.INVALID_EXPR, []];
      }
      const gradient = numericGradient(record.fn, record.variables.length, inputs);
      return [ErrorCode.OK, gradient];
    },
    hessian: () => [ErrorCode.OK, []],
    eval: (program, inputs) => {
      const record = programs.get(program);
      if (!record) {
        return [ErrorCode.INVALID_EXPR, 0];
      }
      return [ErrorCode.OK, record.fn(...inputs)];
    },
    evalBatch: (program, inputArrays) => {
      const record = programs.get(program);
      if (!record) {
        return [ErrorCode.INVALID_EXPR, []];
      }
      const count = inputArrays[0]?.length ?? 0;
      const results: number[] = [];
      for (let i = 0; i < count; i += 1) {
        const args = inputArrays.map((arr) => arr[i]);
        results.push(record.fn(...args));
      }
      return [ErrorCode.OK, results];
    },
    setADMode: () => {},
    setFDEpsilon: () => {},
    errorString: (error) => ErrorCode[error] ?? "error",
    getLastErrorMessage: () => "",
  };

  return { module, ctx: 1 };
};

const numericGradient = (fn: (...args: number[]) => number, dimension: number, inputs: number[]): number[] => {
  const h = 1e-4;
  const gradient = new Array<number>(dimension).fill(0);
  for (let axis = 0; axis < dimension; axis += 1) {
    const plus = [...inputs];
    const minus = [...inputs];
    plus[axis] += h;
    minus[axis] -= h;
    gradient[axis] = (fn(...plus) - fn(...minus)) / (2 * h);
  }
  return gradient;
};

const createDefaultHyperplane = (dimension: number): HyperplaneConfig => ({
  enabled: true,
  coefficients: new Float32Array([1, ...new Array(dimension - 1).fill(0)]),
  offset: 0,
  showIntersection: true,
  intersectionColor: [1, 0.5, 0],
});

const createFunctionConfig = (expression: string): FunctionConfig => ({
  expression,
  type: "scalar",
  isValid: true,
  errorMessage: null,
  programBytecode: null,
});

const defaultCalculusConfig = (dimension: number): CalculusConfig => ({
  showGradient: false,
  showHessian: false,
  showTangentPlane: false,
  showLevelSets: false,
  levelSetValues: [],
  gradientScale: 1,
  probePoint: new Float32Array(dimension).fill(0),
  adMode: "forward",
});

describe("computeOverlays", () => {
  beforeEach(() => {
    __setNdcalcRuntimeForTests(createStubRuntime());
  });

  it("produces hyperplane slice when enabled", async () => {
    const dimension = 3;
    const geometry = generateHypercubeGeometry(dimension);
    const overlays = await computeOverlays(
      geometry,
      createDefaultHyperplane(dimension),
      createFunctionConfig("x1"),
      defaultCalculusConfig(dimension),
      dimension
    );

    expect(overlays.error).toBeNull();
    expect(overlays.overlays.sliceGeometry).not.toBeNull();
    expect(overlays.overlays.sliceGeometry?.length).toBeGreaterThan(0);
  });

  it("renders gradient arrow and tangent plane", async () => {
    const dimension = 3;
    const geometry = generateHypercubeGeometry(dimension);
    const calculus: CalculusConfig = {
      ...defaultCalculusConfig(dimension),
      showGradient: true,
      showTangentPlane: true,
      gradientScale: 0.5,
      probePoint: new Float32Array([0.25, 0.1, 0]),
    };

    const result = await computeOverlays(
      geometry,
      createDefaultHyperplane(dimension),
      createFunctionConfig("x1"),
      calculus,
      dimension
    );

    expect(result.error).toBeNull();
    expect(result.overlays.gradientVectors).not.toBeNull();
    expect(result.overlays.gradientVectors?.length).toBe(6);
    expect(result.overlays.tangentPatch).not.toBeNull();
    expect(result.overlays.tangentPatch?.length).toBe(12);
  });

  it("extracts level-set segments", async () => {
    const dimension = 3;
    const geometry = generateHypercubeGeometry(dimension);
    const calculus: CalculusConfig = {
      ...defaultCalculusConfig(dimension),
      showLevelSets: true,
      levelSetValues: [0],
    };

    const result = await computeOverlays(
      geometry,
      createDefaultHyperplane(dimension),
      createFunctionConfig("x1"),
      calculus,
      dimension
    );

    expect(result.error).toBeNull();
    expect(result.overlays.levelSetCurves).not.toBeNull();
    expect(result.overlays.levelSetCurves?.[0]?.length).toBeGreaterThan(0);
  });
});
