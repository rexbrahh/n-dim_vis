// Projects n-dimensional vertices to 3D after applying rotation.
// Input vertices are in SoA (Structure of Arrays) layout: [x1, x2, ..., xN, y1, y2, ..., yN, ...]
// Output is interleaved 3D positions: [x, y, z, x, y, z, ...]
//
// Pipeline:
// 1. Read vertex from SoA layout
// 2. Apply rotation matrix (n×n)
// 3. Project to 3D using basis (3×n, each column is a basis vector in n-space)

struct ProjectionParams {
  dimension: u32,      // n-dimensional space
  vertex_count: u32,   // Number of vertices to process
  rotation_stride: u32, // Stride for rotation matrix (usually == dimension)
  _padding: u32,
}

@group(0) @binding(0) var<uniform> params: ProjectionParams;
@group(0) @binding(1) var<storage, read> vertices_soa: array<f32>;  // SoA layout: dimension × vertex_count
@group(0) @binding(2) var<storage, read> rotation_matrix: array<f32>; // n×n row-major
@group(0) @binding(3) var<storage, read> basis: array<f32>;  // 3×n column-major (3 basis vectors, each n-dimensional)
@group(0) @binding(4) var<storage, read_write> positions_out: array<f32>; // Output: vertex_count × 3 interleaved

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let vertex_idx = global_id.x;

  // Bounds check
  if (vertex_idx >= params.vertex_count) {
    return;
  }

  let dim = params.dimension;
  let stride = params.rotation_stride;

  // Step 1: Read vertex from SoA layout into local array
  var vertex: array<f32, 32>;  // Support up to 32 dimensions (adjust if needed)
  for (var axis = 0u; axis < dim && axis < 32u; axis++) {
    vertex[axis] = vertices_soa[axis * params.vertex_count + vertex_idx];
  }

  // Step 2: Apply rotation matrix: rotated = rotation_matrix × vertex
  var rotated: array<f32, 32>;
  for (var row = 0u; row < dim && row < 32u; row++) {
    var sum = 0.0;
    for (var col = 0u; col < dim && col < 32u; col++) {
      sum += rotation_matrix[row * stride + col] * vertex[col];
    }
    rotated[row] = sum;
  }

  // Step 3: Project to 3D using basis vectors
  // basis is stored column-major: [b0_x1, b0_x2, ..., b0_xn, b1_x1, b1_x2, ..., b1_xn, b2_x1, ...]
  for (var component = 0u; component < 3u; component++) {
    var sum = 0.0;
    for (var axis = 0u; axis < dim && axis < 32u; axis++) {
      sum += rotated[axis] * basis[component * dim + axis];
    }
    positions_out[vertex_idx * 3u + component] = sum;
  }
}
