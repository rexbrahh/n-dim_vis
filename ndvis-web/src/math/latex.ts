import createNdcalcModule, {
  type NdcalcModule,
  type LatexAsciiResult,
  type LatexHyperplaneResult,
  type LatexMatrixResult,
  type LatexNormalizeResult,
} from "@/wasm/ndcalc/index.js";

export class LaTeXParseError extends Error {
  start?: number;
  end?: number;

  constructor(message: string, start?: number, end?: number) {
    super(message);
    this.name = "LaTeXParseError";
    this.start = start;
    this.end = end;
  }

  toJSON() {
    return {
      message: this.message,
      start: this.start,
      end: this.end,
    };
  }
}

let cachedModule: NdcalcModule | null = null;
let modulePromise: Promise<NdcalcModule> | null = null;

const resolveModule = async (): Promise<NdcalcModule> => {
  if (cachedModule) {
    return cachedModule;
  }
  if (!modulePromise) {
    modulePromise = createNdcalcModule();
    modulePromise
      .then((module) => {
        cachedModule = module;
      })
      .catch((err) => {
        modulePromise = null;
        cachedModule = null;
        throw err;
      });
  }
  return modulePromise;
};

const ensureResultOk = (
  result: LatexAsciiResult | LatexHyperplaneResult | LatexMatrixResult | LatexNormalizeResult
) => {
  if (!result || result.status !== 0) {
    const meta = result?.error ?? {};
    throw new LaTeXParseError(meta.message ?? "LaTeX translation failed", meta.start, meta.end);
  }
};

export const __setNdcalcLatexModuleForTests = (module: NdcalcModule | null) => {
  cachedModule = module;
  modulePromise = module ? Promise.resolve(module) : null;
};

export const ensureLatexModule = async (): Promise<void> => {
  await resolveModule();
};

export async function latexToAsciiExpr(src: string): Promise<string> {
  const module = await resolveModule();
  const result = module.latexToAscii(src);
  ensureResultOk(result);

  if (typeof result.value !== "string") {
    throw new LaTeXParseError("LaTeX translation returned no output");
  }
  return result.value;
}

export async function latexToHyperplane(
  src: string,
  dimension: number
): Promise<{ a: Float32Array; b: number }> {
  const module = await resolveModule();
  const result = module.latexToHyperplane(src, dimension);
  ensureResultOk(result);

  if (!result.coefficients) {
    throw new LaTeXParseError("LaTeX hyperplane translation returned no coefficients");
  }

  const coefficients = result.coefficients instanceof Float32Array
    ? result.coefficients
    : Float32Array.from(result.coefficients);

  return {
    a: coefficients,
    b: typeof result.offset === "number" ? result.offset : 0,
  };
}

export async function latexToMatrix(src: string): Promise<number[][]> {
  const module = await resolveModule();
  const result = module.latexToMatrix(src);
  ensureResultOk(result);

  if (!result.matrix) {
    throw new LaTeXParseError("LaTeX matrix translation returned no rows");
  }
  return result.matrix.map((row) => row.slice());
}

export async function validateHyperplane(a: Float32Array): Promise<boolean> {
  const module = await resolveModule();
  return module.validateHyperplane(a);
}

export async function normalizeHyperplane(
  a: Float32Array,
  b: number
): Promise<{ a: Float32Array; b: number }> {
  const module = await resolveModule();
  const result = module.normalizeHyperplane(a, b);
  ensureResultOk(result);

  if (!result.coefficients) {
    throw new LaTeXParseError("Hyperplane normalization failed");
  }

  const coefficients = result.coefficients instanceof Float32Array
    ? result.coefficients
    : Float32Array.from(result.coefficients);

  return {
    a: coefficients,
    b: typeof result.offset === "number" ? result.offset : b,
  };
}
