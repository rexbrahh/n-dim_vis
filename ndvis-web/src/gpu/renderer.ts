export type RendererMode = "webgpu" | "webgl2" | "canvas";

export type RendererHandle = {
  mode: RendererMode;
  dispose: () => void;
};

export const createRenderer = async (): Promise<RendererHandle> => {
  // Placeholder detection logic; real implementation will probe for WebGPU.
  const supportsWebGPU = typeof navigator !== "undefined" && "gpu" in navigator;
  const supportsWebGL2 = (() => {
    if (typeof document === "undefined") {
      return false;
    }
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2");
    return context !== null;
  })();

  if (supportsWebGPU) {
    return { mode: "webgpu", dispose: () => {} } satisfies RendererHandle;
  }

  if (supportsWebGL2) {
    return { mode: "webgl2", dispose: () => {} } satisfies RendererHandle;
  }

  return { mode: "canvas", dispose: () => {} } satisfies RendererHandle;
};
