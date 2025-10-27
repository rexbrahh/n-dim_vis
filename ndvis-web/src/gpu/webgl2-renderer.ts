import type { NdvisBindings } from "../wasm/ndvis";

export type RotationPlane = {
  i: number;
  j: number;
  theta: number;
};

export type WebGL2Context = {
  gl: WebGL2RenderingContext;
  wasm: NdvisBindings;
};

export type GeometryData = {
  vertices: Float32Array; // SoA layout
  rotationMatrix: Float32Array;
  basis: Float32Array;
  positions3d: Float32Array;
  edges?: Uint32Array;
};

export type HyperplaneData = {
  aNormal: Float32Array;
  intersections: Float32Array;
  intersectionCount: number;
};

export const initWebGL2 = async (
  canvas: HTMLCanvasElement,
  wasm: NdvisBindings
): Promise<WebGL2Context | null> => {
  const gl = canvas.getContext("webgl2");
  if (!gl) {
    console.warn("WebGL2 not supported");
    return null;
  }

  return { gl, wasm };
};

export const applyGivensRotations = (
  rotationMatrix: Float32Array,
  order: number,
  planes: RotationPlane[]
): void => {
  // Apply Givens rotations in-place using CPU/WASM
  for (const plane of planes) {
    if (plane.i >= order || plane.j >= order) continue;

    const c = Math.cos(plane.theta);
    const s = Math.sin(plane.theta);

    for (let row = 0; row < order; row++) {
      const idxI = row * order + plane.i;
      const idxJ = row * order + plane.j;

      const a = rotationMatrix[idxI];
      const b = rotationMatrix[idxJ];

      rotationMatrix[idxI] = c * a - s * b;
      rotationMatrix[idxJ] = s * a + c * b;
    }
  }
};

export const projectVerticesTo3D = (
  vertices: Float32Array,
  dimension: number,
  vertexCount: number,
  rotationMatrix: Float32Array,
  basis: Float32Array,
  positions3d: Float32Array
): void => {
  // Fallback: use CPU/WASM for projection
  const scratch = new Float32Array(dimension);
  const rotated = new Float32Array(dimension);

  for (let vertex = 0; vertex < vertexCount; vertex++) {
    // Load vertex from SoA
    for (let axis = 0; axis < dimension; axis++) {
      scratch[axis] = vertices[axis * vertexCount + vertex];
    }

    // Apply rotation: rotated = rotationMatrix × scratch
    for (let row = 0; row < dimension; row++) {
      let sum = 0;
      for (let col = 0; col < dimension; col++) {
        sum += rotationMatrix[row * dimension + col] * scratch[col];
      }
      rotated[row] = sum;
    }

    // Project to 3D: positions3d = basis × rotated
    // basis is 3×dimension column-major
    for (let component = 0; component < 3; component++) {
      let sum = 0;
      for (let axis = 0; axis < dimension; axis++) {
        sum += rotated[axis] * basis[component * dimension + axis];
      }
      positions3d[vertex * 3 + component] = sum;
    }
  }
};

export const sliceWithHyperplane = (
  vertices: Float32Array,
  dimension: number,
  vertexCount: number,
  edges: Uint32Array,
  edgeCount: number,
  aNormal: Float32Array,
  b: number,
  intersections: Float32Array
): number => {
  // Fallback: compute hyperplane intersections on CPU
  let intersectionCount = 0;
  const v0 = new Float32Array(dimension);
  const v1 = new Float32Array(dimension);

  const dotProduct = (a: Float32Array, b: Float32Array): number => {
    let sum = 0;
    for (let i = 0; i < dimension; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  };

  const loadVertex = (vertexIdx: number, out: Float32Array): void => {
    for (let axis = 0; axis < dimension; axis++) {
      out[axis] = vertices[axis * vertexCount + vertexIdx];
    }
  };

  for (let edgeIdx = 0; edgeIdx < edgeCount; edgeIdx++) {
    const v0Idx = edges[edgeIdx * 2];
    const v1Idx = edges[edgeIdx * 2 + 1];

    loadVertex(v0Idx, v0);
    loadVertex(v1Idx, v1);

    // Compute signed distances
    const d0 = dotProduct(aNormal, v0) - b;
    const d1 = dotProduct(aNormal, v1) - b;

    // Check if edge crosses hyperplane
    if (d0 * d1 >= 0) continue;

    // Compute interpolation parameter
    const t = d0 / (d0 - d1);

    // Compute intersection point: p = v0 + t * (v1 - v0)
    for (let axis = 0; axis < dimension; axis++) {
      const p = v0[axis] + t * (v1[axis] - v0[axis]);
      intersections[axis * edgeCount + intersectionCount] = p;
    }

    intersectionCount++;
  }

  return intersectionCount;
};

export const createVertexBuffer = (gl: WebGL2RenderingContext, data: Float32Array): WebGLBuffer => {
  const buffer = gl.createBuffer();
  if (!buffer) throw new Error("Failed to create WebGL buffer");

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return buffer;
};

export const createIndexBuffer = (gl: WebGL2RenderingContext, data: Uint32Array): WebGLBuffer => {
  const buffer = gl.createBuffer();
  if (!buffer) throw new Error("Failed to create WebGL index buffer");

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  return buffer;
};

export const updateVertexBuffer = (
  gl: WebGL2RenderingContext,
  buffer: WebGLBuffer,
  data: Float32Array
): void => {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
};
