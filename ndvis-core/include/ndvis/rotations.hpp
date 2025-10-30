#pragma once

#include <cstddef>

namespace ndvis {

struct RotationPlane {
  unsigned int i{0};
  unsigned int j{0};
  float theta{0.0f};
};

// Apply a single Givens rotation to a rotation matrix (in-place)
void apply_givens(float* matrix, std::size_t order, RotationPlane plane);

// Apply a batch of rotation planes sequentially (in-place)
void apply_rotations(float* matrix, std::size_t order, const RotationPlane* planes, std::size_t plane_count);

// Apply rotation planes incrementally to an existing rotation matrix
// (mirrors the JS applyRotationPlanes logic but native)
void apply_rotations_incremental(float* matrix, std::size_t order, const RotationPlane* planes, std::size_t plane_count);

// Compute orthogonality drift metric (Frobenius norm of R^T R - I)
float compute_orthogonality_drift(const float* matrix, std::size_t order);

}  // namespace ndvis
