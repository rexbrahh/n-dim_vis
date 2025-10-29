#pragma once

#include <cstddef>

#include "ndvis/types.hpp"

namespace ndvis {

struct GeometryInputs {
  const float* vertices;  // dimension * vertex_count (SoA)
  std::size_t vertex_count;
  std::size_t dimension;
  const unsigned int* edges;  // edge_count * 2
  std::size_t edge_count;
  const float* rotation_matrix;  // dimension * dimension, row-major
  const float* basis3;           // 3 * dimension, column-major
};

struct HyperplaneInputs {
  const float* coefficients;  // length = dimension
  float offset;
  bool enabled;
};

struct CalculusInputs {
  const char* expression_utf8;  // optional, nullptr if none
  std::size_t expression_length;
  const float* probe_point;  // length = dimension (optional)
  const float* level_set_values;  // array of size level_set_count
  std::size_t level_set_count;
  bool show_gradient;
  bool show_tangent_plane;
  bool show_level_sets;
  float gradient_scale;
};

struct OverlayBuffers {
  float* projected_vertices;  // vertex_count * 3
  std::size_t projected_stride;  // usually vertex_count

  float* slice_positions;  // intersection_count * 3
  std::size_t slice_capacity;
  std::size_t* slice_count;  // out parameter

  float* gradient_positions;  // length 6 (start/end)
  float* tangent_patch_positions;  // length 12 (quad)

  float** level_set_curves;  // array of pointers to Float32 positions
  std::size_t* level_set_sizes;  // number of floats per curve
  std::size_t level_set_capacity;
  std::size_t* level_set_count;  // out parameter
};

// Result codes
enum class OverlayResult {
  kSuccess = 0,
  kInvalidInputs,
  kNullBuffer,
  kEvalError,
  kGradientError,
};

OverlayResult compute_overlays(
    const GeometryInputs& geometry,
    const HyperplaneInputs& hyperplane,
    const CalculusInputs& calculus,
    OverlayBuffers& buffers);

}  // namespace ndvis

