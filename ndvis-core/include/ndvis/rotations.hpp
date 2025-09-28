#pragma once

#include <cstddef>

namespace ndvis {

struct RotationPlane {
  unsigned int i{0};
  unsigned int j{0};
  float theta{0.0f};
};

void apply_givens(float* matrix, std::size_t order, RotationPlane plane);
void apply_rotations(float* matrix, std::size_t order, const RotationPlane* planes, std::size_t plane_count);

}  // namespace ndvis
