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

}  // namespace ndvis
