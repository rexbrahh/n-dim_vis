# WebGPU Compute Shader Interface Documentation

This document specifies the buffer layouts and dispatch dimensions for the WebGPU compute shaders used in the ndvis project. These interfaces are designed to be implemented by WebGPU engineers and can be plugged into the existing pipeline.

---

## 1. `rotate_givens.wgsl` — Batched Givens Rotation

### Purpose
Applies a sequence of Givens rotation planes to an n-dimensional rotation matrix in-place. This shader processes one row per thread, allowing efficient parallelization across matrix rows.

### Shader Entry Point
```wgsl
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>)
```

### Bind Group Layout (Group 0)

| Binding | Type | Access | Description |
|---------|------|--------|-------------|
| 0 | `uniform` | read | `GivensParams` struct (see below) |
| 1 | `storage` | read_write | Rotation matrix buffer (n×n, row-major, `f32`) |
| 2 | `storage` | read | Rotation planes array (`RotationPlane[]`) |

### Struct Definitions

```wgsl
struct RotationPlane {
  i: u32,           // First rotation axis
  j: u32,           // Second rotation axis
  theta: f32,       // Rotation angle in radians
  _padding: u32,    // Padding for alignment
}

struct GivensParams {
  order: u32,           // Matrix dimension (n)
  plane_count: u32,     // Number of rotation planes to apply
  _padding: vec2<u32>,  // Padding for alignment
}
```

### Buffer Layout Details

#### `rotation_matrix` (binding 1)
- **Size:** `order * order * sizeof(f32)` bytes
- **Layout:** Row-major, contiguous
- **Access:** Read-write (mutated in-place)
- **Example (4×4 matrix):**
  ```
  [ R[0,0], R[0,1], R[0,2], R[0,3],
    R[1,0], R[1,1], R[1,2], R[1,3],
    R[2,0], R[2,1], R[2,2], R[2,3],
    R[3,0], R[3,1], R[3,2], R[3,3] ]
  ```

#### `planes` (binding 2)
- **Size:** `plane_count * sizeof(RotationPlane)` bytes (16 bytes per plane)
- **Layout:** Array of structs
- **Access:** Read-only
- **Example:**
  ```
  [ {i:0, j:1, theta:0.1, pad:0},
    {i:1, j:2, theta:0.2, pad:0},
    {i:2, j:3, theta:0.15, pad:0} ]
  ```

### Dispatch Dimensions

```javascript
const workgroupSize = 64;
const numWorkgroups = Math.ceil(order / workgroupSize);

device.queue.submit([commandEncoder.finish()]);
computePass.dispatchWorkgroups(numWorkgroups, 1, 1);
```

**Rationale:** Each thread processes one row of the matrix, so we dispatch `ceil(order / 64)` workgroups.

### Algorithm Summary

For each thread (processing row `r`):
1. For each rotation plane `p` in sequence:
   - Compute `c = cos(theta)`, `s = sin(theta)`
   - Read `a = matrix[r, i]`, `b = matrix[r, j]`
   - Write `matrix[r, i] = c*a - s*b`
   - Write `matrix[r, j] = s*a + c*b`

### Performance Considerations

- **Memory Access:** Sequential reads/writes within each row minimize bank conflicts
- **Workgroup Size:** 64 threads per workgroup is optimal for most GPUs
- **Synchronization:** No inter-thread synchronization required (each row is independent)
- **Dimension Limits:** Tested up to n=12; higher dimensions may require multiple passes or increased shared memory

### Usage Example (TypeScript/WebGPU)

```typescript
const uniformBuffer = device.createBuffer({
  size: 16, // sizeof(GivensParams)
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  mappedAtCreation: true,
});
new Uint32Array(uniformBuffer.getMappedRange()).set([order, planeCount, 0, 0]);
uniformBuffer.unmap();

const matrixBuffer = device.createBuffer({
  size: order * order * 4,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
});

const planesBuffer = device.createBuffer({
  size: planeCount * 16,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
});

// ... create bind group, pipeline, and dispatch ...
```

---

## 2. `project_to3d.wgsl` — N-Dimensional to 3D Projection

### Purpose
Projects n-dimensional vertices to 3D space by:
1. Reading vertices from Structure-of-Arrays (SoA) layout
2. Applying an n×n rotation matrix
3. Projecting to 3D using a 3×n basis matrix

### Shader Entry Point
```wgsl
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>)
```

### Bind Group Layout (Group 0)

| Binding | Type | Access | Description |
|---------|------|--------|-------------|
| 0 | `uniform` | read | `ProjectionParams` struct (see below) |
| 1 | `storage` | read | Vertices in SoA layout (dimension × vertex_count, `f32`) |
| 2 | `storage` | read | Rotation matrix (n×n, row-major, `f32`) |
| 3 | `storage` | read | Basis matrix (3×n, column-major, `f32`) |
| 4 | `storage` | read_write | Output positions (vertex_count × 3, interleaved, `f32`) |

### Struct Definitions

```wgsl
struct ProjectionParams {
  dimension: u32,      // n-dimensional space dimension
  vertex_count: u32,   // Number of vertices to process
  rotation_stride: u32, // Stride for rotation matrix (usually == dimension)
  _padding: u32,       // Padding for alignment
}
```

### Buffer Layout Details

#### `vertices_soa` (binding 1)
- **Size:** `dimension * vertex_count * sizeof(f32)` bytes
- **Layout:** Structure-of-Arrays (all x-coords, then all y-coords, etc.)
- **Access:** Read-only
- **Example (3 vertices in 4D):**
  ```
  [ v0.x, v1.x, v2.x,  // All x-coordinates
    v0.y, v1.y, v2.y,  // All y-coordinates
    v0.z, v1.z, v2.z,  // All z-coordinates
    v0.w, v1.w, v2.w ] // All w-coordinates
  ```

#### `rotation_matrix` (binding 2)
- **Size:** `dimension * dimension * sizeof(f32)` bytes
- **Layout:** Row-major, n×n matrix
- **Access:** Read-only
- Same layout as in `rotate_givens.wgsl`

#### `basis` (binding 3)
- **Size:** `3 * dimension * sizeof(f32)` bytes
- **Layout:** Column-major, 3×n matrix (3 basis vectors, each n-dimensional)
- **Access:** Read-only
- **Example (3 basis vectors in 4D space):**
  ```
  [ b0.x, b0.y, b0.z, b0.w,  // First basis vector
    b1.x, b1.y, b1.z, b1.w,  // Second basis vector
    b2.x, b2.y, b2.z, b2.w ] // Third basis vector
  ```

#### `positions_out` (binding 4)
- **Size:** `vertex_count * 3 * sizeof(f32)` bytes
- **Layout:** Interleaved 3D positions (x, y, z per vertex)
- **Access:** Write-only
- **Example (3 vertices):**
  ```
  [ v0.x, v0.y, v0.z,
    v1.x, v1.y, v1.z,
    v2.x, v2.y, v2.z ]
  ```

### Dispatch Dimensions

```javascript
const workgroupSize = 64;
const numWorkgroups = Math.ceil(vertexCount / workgroupSize);

computePass.dispatchWorkgroups(numWorkgroups, 1, 1);
```

**Rationale:** Each thread processes one vertex, so we dispatch `ceil(vertex_count / 64)` workgroups.

### Algorithm Summary

For each thread (processing vertex `v`):
1. Read vertex coordinates from SoA layout: `vertex[axis] = vertices_soa[axis * vertex_count + v]`
2. Apply rotation: `rotated[row] = sum(rotation_matrix[row, col] * vertex[col])`
3. Project to 3D: `out[component] = sum(rotated[axis] * basis[component * dimension + axis])`
4. Write interleaved output: `positions_out[v * 3 + component] = out[component]`

### Performance Considerations

- **Memory Access:** SoA layout improves cache coherency for per-axis operations
- **Workgroup Size:** 64 threads optimal for most GPUs
- **Dimension Limits:** Hard-coded support for up to 32 dimensions (see `array<f32, 32>` in shader)
  - For higher dimensions, increase array size or use dynamic storage
- **Local Memory:** Uses 64 floats (2×32) per thread for intermediate storage

### Usage Example (TypeScript/WebGPU)

```typescript
const uniformBuffer = device.createBuffer({
  size: 16, // sizeof(ProjectionParams)
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  mappedAtCreation: true,
});
new Uint32Array(uniformBuffer.getMappedRange()).set([dimension, vertexCount, dimension, 0]);
uniformBuffer.unmap();

const verticesBuffer = device.createBuffer({
  size: dimension * vertexCount * 4,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
});

const outputBuffer = device.createBuffer({
  size: vertexCount * 3 * 4,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
});

// ... create bind group, pipeline, and dispatch ...
```

---

## Integration Notes

### Pipeline Creation

Both shaders follow the same pattern:

```typescript
const pipeline = device.createComputePipeline({
  layout: device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout]
  }),
  compute: {
    module: device.createShaderModule({ code: shaderCode }),
    entryPoint: "main"
  }
});
```

### Synchronization

- **After `rotate_givens`:** Insert a pipeline barrier if the rotation matrix will be read by subsequent operations
- **After `project_to3d`:** Insert a pipeline barrier before reading output positions on CPU

### Error Handling

- **Out-of-bounds access:** Shaders include bounds checks; invalid threads early-return
- **Dimension limits:** `rotate_givens` supports arbitrary dimensions; `project_to3d` limited to n≤32

### Future Optimizations

1. **Shared Memory:** For small matrices (n<16), use shared memory for rotation matrix in `rotate_givens`
2. **Vectorization:** Use `vec4<f32>` operations for 4-aligned dimensions
3. **Tiling:** For large vertex counts, tile the projection operation to improve cache locality
4. **Async Compute:** Run rotation and projection on separate compute queues for pipelining

---

## Testing & Validation

Recommended tests for WebGPU implementation:

1. **Correctness:** Compare GPU output against CPU reference implementation
2. **Orthogonality:** Verify `R^T R ≈ I` after rotation sequences
3. **Performance:** Benchmark against CPU WASM for various dimensions (n=4,6,8,12)
4. **Edge Cases:** Test with n=1, empty plane arrays, identity rotations

See `ndvis-core/tests/core_tests.cpp` for reference test cases.
