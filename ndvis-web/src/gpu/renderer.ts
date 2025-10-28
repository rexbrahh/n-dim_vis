import type { NdvisBindings } from "../wasm/ndvis";
import * as WebGPU from "./webgpu-renderer";
import * as WebGL2 from "./webgl2-renderer";

export type RendererMode = "webgpu" | "webgl2" | "canvas";

export type RotationPlane = {
  i: number;
  j: number;
  theta: number;
};

export type GeometryConfig = {
  dimension: number;
  vertexCount: number;
  edgeCount?: number;
};

export type RenderBuffers = {
  vertices: Float32Array;
  rotationMatrix: Float32Array;
  basis: Float32Array;
  positions3d: Float32Array;
  edges?: Uint32Array;
};

export type HyperplaneConfig = {
  aNormal: Float32Array;
  b: number;
  maxIntersections: number;
};

export type RendererHandle = {
  mode: RendererMode;
  dispose: () => void;
  applyRotations: (planes: RotationPlane[]) => void;
  projectTo3D: (buffers: RenderBuffers, config: GeometryConfig) => Promise<Float32Array>;
  sliceHyperplane?: (
    buffers: RenderBuffers,
    config: GeometryConfig,
    hyperplane: HyperplaneConfig
  ) => Promise<{ intersections: Float32Array; count: number }>;
};

type WebGPURendererState = {
  context: WebGPU.WebGPUContext;
  pipelines: WebGPU.ComputePipelines;
  gpuBuffers: WebGPU.GeometryBuffers | null;
  hyperplaneBuffers: WebGPU.HyperplaneBuffers | null;
};

export const createRenderer = async (
  canvas: HTMLCanvasElement,
  wasm: NdvisBindings
): Promise<RendererHandle> => {
  // Try WebGPU first
  const webgpuContext = await WebGPU.initWebGPU();
  if (webgpuContext) {
    const pipelines = WebGPU.createComputePipelines(webgpuContext.device);
    const state: WebGPURendererState = {
      context: webgpuContext,
      pipelines,
      gpuBuffers: null,
      hyperplaneBuffers: null,
    };

    return {
      mode: "webgpu",
      dispose: () => {
        state.gpuBuffers?.vertices.destroy();
        state.gpuBuffers?.rotationMatrix.destroy();
        state.gpuBuffers?.basis.destroy();
        state.gpuBuffers?.positions3d.destroy();
        state.gpuBuffers?.edges?.destroy();
        state.hyperplaneBuffers?.aNormal.destroy();
        state.hyperplaneBuffers?.intersections.destroy();
        state.hyperplaneBuffers?.intersectionCount.destroy();
      },
      applyRotations: (planes: RotationPlane[]) => {
        if (!state.gpuBuffers) return;
        WebGPU.applyGivensRotations(
          state.context,
          state.pipelines.rotateGivens,
          state.gpuBuffers.rotationMatrix,
          Math.sqrt(state.gpuBuffers.rotationMatrix.size / Float32Array.BYTES_PER_ELEMENT),
          planes
        );
      },
      projectTo3D: async (buffers: RenderBuffers, config: GeometryConfig) => {
        // Create or update GPU buffers
        if (!state.gpuBuffers) {
          state.gpuBuffers = WebGPU.createGeometryBuffers(
            state.context.device,
            config.dimension,
            config.vertexCount,
            config.edgeCount
          );
        }

        // Upload data
        state.context.queue.writeBuffer(state.gpuBuffers.vertices, 0, buffers.vertices);
        state.context.queue.writeBuffer(state.gpuBuffers.rotationMatrix, 0, buffers.rotationMatrix);
        state.context.queue.writeBuffer(state.gpuBuffers.basis, 0, buffers.basis);

        if (buffers.edges && state.gpuBuffers.edges) {
          state.context.queue.writeBuffer(state.gpuBuffers.edges, 0, buffers.edges);
        }

        // Execute projection
        WebGPU.projectVerticesTo3D(
          state.context,
          state.pipelines.projectTo3d,
          state.gpuBuffers,
          config.dimension,
          config.vertexCount
        );

        // Read back results (zero-copy alternative via mapped buffers can be added)
        return await WebGPU.readBuffer(
          state.context,
          state.gpuBuffers.positions3d,
          config.vertexCount * 3 * Float32Array.BYTES_PER_ELEMENT
        );
      },
      sliceHyperplane: async (
        buffers: RenderBuffers,
        config: GeometryConfig,
        hyperplane: HyperplaneConfig
      ) => {
        if (!config.edgeCount || !buffers.edges) {
          throw new Error("Edge data required for hyperplane slicing");
        }

        if (!state.gpuBuffers) {
          state.gpuBuffers = WebGPU.createGeometryBuffers(
            state.context.device,
            config.dimension,
            config.vertexCount,
            config.edgeCount
          );
        }

        if (!state.hyperplaneBuffers) {
          state.hyperplaneBuffers = WebGPU.createHyperplaneBuffers(
            state.context.device,
            config.dimension,
            hyperplane.maxIntersections
          );
        }

        // Upload geometry
        state.context.queue.writeBuffer(state.gpuBuffers.vertices, 0, buffers.vertices);
        state.context.queue.writeBuffer(state.gpuBuffers.edges!, 0, buffers.edges);

        // Upload hyperplane
        state.context.queue.writeBuffer(state.hyperplaneBuffers.aNormal, 0, hyperplane.aNormal);

        // Execute slice
        WebGPU.sliceWithHyperplane(
          state.context,
          state.pipelines.sliceHyperplane,
          state.gpuBuffers,
          state.hyperplaneBuffers,
          config.dimension,
          config.vertexCount,
          config.edgeCount,
          hyperplane.maxIntersections,
          hyperplane.b
        );

        // Read results
        const [intersections, countBuffer] = await Promise.all([
          WebGPU.readBuffer(
            state.context,
            state.hyperplaneBuffers.intersections,
            config.dimension * hyperplane.maxIntersections * Float32Array.BYTES_PER_ELEMENT
          ),
          WebGPU.readBuffer(
            state.context,
            state.hyperplaneBuffers.intersectionCount,
            Uint32Array.BYTES_PER_ELEMENT
          ),
        ]);

        return {
          intersections,
          count: new Uint32Array(countBuffer.buffer)[0],
        };
      },
    };
  }

  // Fallback to WebGL2
  const webgl2Context = await WebGL2.initWebGL2(canvas, wasm);
  if (webgl2Context) {
    return {
      mode: "webgl2",
      dispose: () => {},
      applyRotations: (planes: RotationPlane[]) => {
        if (planes.length === 0) {
          return;
        }
        console.warn("WebGL2 renderer defers Givens rotations to CPU projection.");
      },
      projectTo3D: async (buffers: RenderBuffers, config: GeometryConfig) => {
        // Use CPU/WASM fallback
        WebGL2.projectVerticesTo3D(
          buffers.vertices,
          config.dimension,
          config.vertexCount,
          buffers.rotationMatrix,
          buffers.basis,
          buffers.positions3d
        );
        return buffers.positions3d;
      },
      sliceHyperplane: async (
        buffers: RenderBuffers,
        config: GeometryConfig,
        hyperplane: HyperplaneConfig
      ) => {
        if (!config.edgeCount || !buffers.edges) {
          throw new Error("Edge data required for hyperplane slicing");
        }

        const intersections = new Float32Array(config.dimension * hyperplane.maxIntersections);
        const count = WebGL2.sliceWithHyperplane(
          buffers.vertices,
          config.dimension,
          config.vertexCount,
          buffers.edges,
          config.edgeCount,
          hyperplane.maxIntersections,
          hyperplane.aNormal,
          hyperplane.b,
          intersections
        );

        return { intersections, count };
      },
    };
  }

  // Final fallback: canvas mode (no compute capabilities)
  return {
    mode: "canvas",
    dispose: () => {},
    applyRotations: () => {},
    projectTo3D: async (buffers: RenderBuffers) => buffers.positions3d,
  };
};
