// Applies Givens rotation to an n-dimensional rotation matrix (in-place).
// The rotation matrix is stored in row-major order.
// Each invocation processes one row of the matrix, modifying columns i and j.
//
// Note: No dimension limit for this shader (matrix is stored in GPU buffer).

struct RotationPlane {
  i: u32,
  j: u32,
  theta: f32,
  _padding: u32,
}

struct GivensParams {
  order: u32,           // Dimension of the rotation matrix (n×n)
  plane_count: u32,     // Number of rotation planes to apply
  _padding: vec2<u32>,
}

@group(0) @binding(0) var<uniform> params: GivensParams;
@group(0) @binding(1) var<storage, read_write> matrix: array<f32>;
@group(0) @binding(2) var<storage, read> planes: array<RotationPlane>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row = global_id.x;

  // Bounds check
  if (row >= params.order) {
    return;
  }

  // Apply each rotation plane sequentially
  for (var p = 0u; p < params.plane_count; p++) {
    let plane = planes[p];

    // Bounds check for plane indices
    if (plane.i >= params.order || plane.j >= params.order) {
      continue;
    }

    let c = cos(plane.theta);
    let s = sin(plane.theta);

    let idx_i = row * params.order + plane.i;
    let idx_j = row * params.order + plane.j;

    let a = matrix[idx_i];
    let b = matrix[idx_j];

    matrix[idx_i] = c * a - s * b;
    matrix[idx_j] = s * a + c * b;
  }
}
