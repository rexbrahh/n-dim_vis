// Computes hyperplane intersection for n-dimensional geometry.
// A hyperplane is defined by: a·x = b, where a is normalized and b is scalar.
// For each edge, compute intersection point if the edge crosses the hyperplane.
//
// Output: intersection points and metadata for rendering polylines/curves.
//
// LIMITATION: Maximum dimension is 32 due to fixed-size local arrays.
// For higher dimensions, this shader would need dynamic storage or multiple passes.

struct HyperplaneParams {
  dimension: u32,        // n-dimensional space
  vertex_count: u32,     // Number of vertices
  edge_count: u32,       // Number of edges to test
  max_intersections: u32, // Maximum capacity for intersection buffer
  b: f32,                // Scalar offset of hyperplane
  _padding: vec3<u32>,   // Align to 16 bytes
}

@group(0) @binding(0) var<uniform> params: HyperplaneParams;
@group(0) @binding(1) var<storage, read> vertices_soa: array<f32>; // SoA layout: dimension × vertex_count
@group(0) @binding(2) var<storage, read> a_normal: array<f32>;     // Hyperplane normal vector (normalized, length = dimension)
@group(0) @binding(3) var<storage, read> edges: array<vec2<u32>>;  // Edge pairs: (vertex_i, vertex_j)
@group(0) @binding(4) var<storage, read_write> intersections: array<f32>; // Output: intersection points (dimension × max_intersections)
@group(0) @binding(5) var<storage, read_write> intersection_count: atomic<u32>; // Counter for valid intersections

fn dot_product(v1: ptr<function, array<f32, 32>>, v2: ptr<function, array<f32, 32>>, dim: u32) -> f32 {
  var sum = 0.0;
  for (var i = 0u; i < dim && i < 32u; i++) {
    sum += (*v1)[i] * (*v2)[i];
  }
  return sum;
}

fn load_vertex(vertex_idx: u32, dim: u32, out: ptr<function, array<f32, 32>>) {
  for (var axis = 0u; axis < dim && axis < 32u; axis++) {
    (*out)[axis] = vertices_soa[axis * params.vertex_count + vertex_idx];
  }
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let edge_idx = global_id.x;

  // Bounds check
  if (edge_idx >= params.edge_count) {
    return;
  }

  let dim = params.dimension;
  let edge = edges[edge_idx];
  let v0_idx = edge.x;
  let v1_idx = edge.y;

  // Load vertices
  var v0: array<f32, 32>;
  var v1: array<f32, 32>;
  load_vertex(v0_idx, dim, &v0);
  load_vertex(v1_idx, dim, &v1);

  // Load hyperplane normal
  var a: array<f32, 32>;
  for (var axis = 0u; axis < dim && axis < 32u; axis++) {
    a[axis] = a_normal[axis];
  }

  // Compute signed distances: d0 = a·v0 - b, d1 = a·v1 - b
  let d0 = dot_product(&a, &v0, dim) - params.b;
  let d1 = dot_product(&a, &v1, dim) - params.b;

  // Check if edge crosses hyperplane (different signs)
  if (d0 * d1 >= 0.0) {
    return; // No intersection
  }

  // Compute interpolation parameter: t = d0 / (d0 - d1)
  let t = d0 / (d0 - d1);

  // Compute intersection point: p = v0 + t * (v1 - v0)
  var intersection: array<f32, 32>;
  for (var axis = 0u; axis < dim && axis < 32u; axis++) {
    intersection[axis] = v0[axis] + t * (v1[axis] - v0[axis]);
  }

  // Atomically reserve a slot in the output buffer
  let out_idx = atomicAdd(&intersection_count, 1u);

  // Check capacity bounds to prevent buffer overflow
  if (out_idx >= params.max_intersections) {
    return;
  }

  // Write intersection point to output (SoA layout with correct stride)
  for (var axis = 0u; axis < dim && axis < 32u; axis++) {
    intersections[axis * params.max_intersections + out_idx] = intersection[axis];
  }
}
