#include "ndvis/rotations.hpp"

namespace ndvis {

void apply_givens(float* matrix, std::size_t order, RotationPlane plane) {
  if (matrix == nullptr || order == 0 || plane.i >= order || plane.j >= order) {
    return;
  }

  const float c = __builtin_cosf(plane.theta);
  const float s = __builtin_sinf(plane.theta);

  for (std::size_t row = 0; row < order; ++row) {
    const std::size_t idx_i = row * order + plane.i;
    const std::size_t idx_j = row * order + plane.j;

    const float a = matrix[idx_i];
    const float b = matrix[idx_j];

    matrix[idx_i] = c * a - s * b;
    matrix[idx_j] = s * a + c * b;
  }
}

void apply_rotations(float* matrix, std::size_t order, const RotationPlane* planes, std::size_t plane_count) {
  if (matrix == nullptr || planes == nullptr) {
    return;
  }
  for (std::size_t idx = 0; idx < plane_count; ++idx) {
    apply_givens(matrix, order, planes[idx]);
  }
}

void apply_rotations_incremental(float* matrix, std::size_t order, const RotationPlane* planes, std::size_t plane_count) {
  // Identical to apply_rotations for now - just an alias for semantic clarity
  // This mirrors the JS applyRotationPlanes logic: it mutates the matrix incrementally
  apply_rotations(matrix, order, planes, plane_count);
}

float compute_orthogonality_drift(const float* matrix, std::size_t order) {
  if (matrix == nullptr || order == 0) {
    return 0.0f;
  }

  // Compute R^T R - I and return Frobenius norm
  // Frobenius norm: sqrt(sum of squared elements)
  float drift = 0.0f;

  for (std::size_t i = 0; i < order; ++i) {
    for (std::size_t j = 0; j < order; ++j) {
      // Compute (R^T R)_ij = sum_k R[k,i] * R[k,j]
      float rtR_ij = 0.0f;
      for (std::size_t k = 0; k < order; ++k) {
        rtR_ij += matrix[k * order + i] * matrix[k * order + j];
      }

      // Subtract I_ij (1 if i==j, else 0)
      if (i == j) {
        rtR_ij -= 1.0f;
      }

      drift += rtR_ij * rtR_ij;
    }
  }

  return __builtin_sqrtf(drift);
}

}  // namespace ndvis
