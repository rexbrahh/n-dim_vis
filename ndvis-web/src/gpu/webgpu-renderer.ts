import rotateGivensShader from "./shaders/rotate_givens.wgsl?raw";
import projectTo3dShader from "./shaders/project_to3d.wgsl?raw";
import sliceHyperplaneShader from "./shaders/slice_hyperplane.wgsl?raw";

export type RotationPlane = {
  i: number;
  j: number;
  theta: number;
};

export type WebGPUContext = {
  device: GPUDevice;
  queue: GPUQueue;
};

export type ComputePipelines = {
  rotateGivens: GPUComputePipeline;
  projectTo3d: GPUComputePipeline;
  sliceHyperplane: GPUComputePipeline;
};

export type GeometryBuffers = {
  vertices: GPUBuffer;       // SoA layout
  rotationMatrix: GPUBuffer; // n×n
  basis: GPUBuffer;          // 3×n
  positions3d: GPUBuffer;    // Output: vertex_count × 3
  edges?: GPUBuffer;         // Optional: for hyperplane slicing
};

export type HyperplaneBuffers = {
  aNormal: GPUBuffer;
  intersections: GPUBuffer;
  intersectionCount: GPUBuffer;
};

const WORKGROUP_SIZE = 64;

export const initWebGPU = async (): Promise<WebGPUContext | null> => {
  if (!navigator.gpu) {
    console.warn("WebGPU not supported");
    return null;
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    console.warn("WebGPU adapter not available");
    return null;
  }

  const device = await adapter.requestDevice();
  const queue = device.queue;

  return { device, queue };
};

export const createComputePipelines = (device: GPUDevice): ComputePipelines => {
  const rotateGivens = device.createComputePipeline({
    layout: "auto",
    compute: {
      module: device.createShaderModule({ code: rotateGivensShader }),
      entryPoint: "main",
    },
  });

  const projectTo3d = device.createComputePipeline({
    layout: "auto",
    compute: {
      module: device.createShaderModule({ code: projectTo3dShader }),
      entryPoint: "main",
    },
  });

  const sliceHyperplane = device.createComputePipeline({
    layout: "auto",
    compute: {
      module: device.createShaderModule({ code: sliceHyperplaneShader }),
      entryPoint: "main",
    },
  });

  return { rotateGivens, projectTo3d, sliceHyperplane };
};

export const createGeometryBuffers = (
  device: GPUDevice,
  dimension: number,
  vertexCount: number,
  edgeCount?: number
): GeometryBuffers => {
  const vertices = device.createBuffer({
    size: dimension * vertexCount * Float32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: false,
  });

  const rotationMatrix = device.createBuffer({
    size: dimension * dimension * Float32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: false,
  });

  const basis = device.createBuffer({
    size: 3 * dimension * Float32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: false,
  });

  const positions3d = device.createBuffer({
    size: vertexCount * 3 * Float32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    mappedAtCreation: false,
  });

  const buffers: GeometryBuffers = {
    vertices,
    rotationMatrix,
    basis,
    positions3d,
  };

  if (edgeCount !== undefined && edgeCount > 0) {
    buffers.edges = device.createBuffer({
      size: edgeCount * 2 * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: false,
    });
  }

  return buffers;
};

export const createHyperplaneBuffers = (
  device: GPUDevice,
  dimension: number,
  maxIntersections: number
): HyperplaneBuffers => {
  const aNormal = device.createBuffer({
    size: dimension * Float32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: false,
  });

  const intersections = device.createBuffer({
    size: dimension * maxIntersections * Float32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    mappedAtCreation: false,
  });

  const intersectionCount = device.createBuffer({
    size: Uint32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    mappedAtCreation: false,
  });

  return { aNormal, intersections, intersectionCount };
};

export const applyGivensRotations = (
  context: WebGPUContext,
  pipeline: GPUComputePipeline,
  matrixBuffer: GPUBuffer,
  order: number,
  planes: RotationPlane[]
): void => {
  if (planes.length === 0) return;

  const { device, queue } = context;

  // Create uniform buffer for params
  const paramsBuffer = device.createBuffer({
    size: 16, // vec4<u32>
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    mappedAtCreation: false,
  });

  const paramsData = new Uint32Array([order, planes.length, 0, 0]);
  queue.writeBuffer(paramsBuffer, 0, paramsData);

  // Create buffer for rotation planes (struct is 16 bytes due to alignment)
  const planesBuffer = device.createBuffer({
    size: planes.length * 16,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: false,
  });

  // Pack struct correctly: i (u32), j (u32), theta (f32), _padding (u32)
  const planesArrayBuffer = new ArrayBuffer(planes.length * 16);
  const planesView = new DataView(planesArrayBuffer);
  planes.forEach((plane, idx) => {
    const offset = idx * 16;
    planesView.setUint32(offset + 0, plane.i, true); // little-endian
    planesView.setUint32(offset + 4, plane.j, true);
    planesView.setFloat32(offset + 8, plane.theta, true);
    planesView.setUint32(offset + 12, 0, true); // padding
  });
  queue.writeBuffer(planesBuffer, 0, planesArrayBuffer);

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: paramsBuffer } },
      { binding: 1, resource: { buffer: matrixBuffer } },
      { binding: 2, resource: { buffer: planesBuffer } },
    ],
  });

  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass();
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(Math.ceil(order / WORKGROUP_SIZE));
  passEncoder.end();

  queue.submit([commandEncoder.finish()]);

  paramsBuffer.destroy();
  planesBuffer.destroy();
};

export const projectVerticesTo3D = (
  context: WebGPUContext,
  pipeline: GPUComputePipeline,
  buffers: GeometryBuffers,
  dimension: number,
  vertexCount: number
): void => {
  const { device, queue } = context;

  // Create uniform buffer for params
  const paramsBuffer = device.createBuffer({
    size: 16, // vec4<u32>
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    mappedAtCreation: false,
  });

  const paramsData = new Uint32Array([dimension, vertexCount, dimension, 0]);
  queue.writeBuffer(paramsBuffer, 0, paramsData);

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: paramsBuffer } },
      { binding: 1, resource: { buffer: buffers.vertices } },
      { binding: 2, resource: { buffer: buffers.rotationMatrix } },
      { binding: 3, resource: { buffer: buffers.basis } },
      { binding: 4, resource: { buffer: buffers.positions3d } },
    ],
  });

  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass();
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(Math.ceil(vertexCount / WORKGROUP_SIZE));
  passEncoder.end();

  queue.submit([commandEncoder.finish()]);

  paramsBuffer.destroy();
};

export const sliceWithHyperplane = (
  context: WebGPUContext,
  pipeline: GPUComputePipeline,
  geometryBuffers: GeometryBuffers,
  hyperplaneBuffers: HyperplaneBuffers,
  dimension: number,
  vertexCount: number,
  edgeCount: number,
  maxIntersections: number,
  b: number
): void => {
  if (!geometryBuffers.edges) {
    throw new Error("Edge buffer required for hyperplane slicing");
  }

  const { device, queue } = context;

  // Reset intersection counter
  queue.writeBuffer(hyperplaneBuffers.intersectionCount, 0, new Uint32Array([0]));

  // Create uniform buffer for params
  const paramsBuffer = device.createBuffer({
    size: 32, // struct HyperplaneParams with padding: u32×4 + f32 + vec3<u32>
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    mappedAtCreation: false,
  });

  // Pack struct correctly: dimension, vertex_count, edge_count, max_intersections (u32), b (f32), padding (vec3<u32>)
  const paramsArrayBuffer = new ArrayBuffer(32);
  const paramsView = new DataView(paramsArrayBuffer);
  paramsView.setUint32(0, dimension, true);
  paramsView.setUint32(4, vertexCount, true);
  paramsView.setUint32(8, edgeCount, true);
  paramsView.setUint32(12, maxIntersections, true);
  paramsView.setFloat32(16, b, true);
  // Remaining 12 bytes are padding (zeros by default)
  queue.writeBuffer(paramsBuffer, 0, paramsArrayBuffer);

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: paramsBuffer } },
      { binding: 1, resource: { buffer: geometryBuffers.vertices } },
      { binding: 2, resource: { buffer: hyperplaneBuffers.aNormal } },
      { binding: 3, resource: { buffer: geometryBuffers.edges } },
      { binding: 4, resource: { buffer: hyperplaneBuffers.intersections } },
      { binding: 5, resource: { buffer: hyperplaneBuffers.intersectionCount } },
    ],
  });

  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass();
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(Math.ceil(edgeCount / WORKGROUP_SIZE));
  passEncoder.end();

  queue.submit([commandEncoder.finish()]);

  paramsBuffer.destroy();
};

export const readBuffer = async (
  context: WebGPUContext,
  buffer: GPUBuffer,
  size: number
): Promise<Float32Array> => {
  const { device, queue } = context;

  const stagingBuffer = device.createBuffer({
    size,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    mappedAtCreation: false,
  });

  const commandEncoder = device.createCommandEncoder();
  commandEncoder.copyBufferToBuffer(buffer, 0, stagingBuffer, 0, size);
  queue.submit([commandEncoder.finish()]);

  await stagingBuffer.mapAsync(GPUMapMode.READ);
  const data = new Float32Array(stagingBuffer.getMappedRange().slice(0));
  stagingBuffer.unmap();
  stagingBuffer.destroy();

  return data;
};
