#pragma once

#include <cstddef>

#include "ndvis/types.hpp"

namespace ndvis {

// Hyperplane definition: a·x = b
// where a is a normalized normal vector in n-dimensional space
// and b is the signed distance from origin
struct Hyperplane {
  const float* normal{nullptr};  // n-dimensional unit normal vector
  std::size_t dimension{0};
  float offset{0.0f};  // scalar b
};

// Result of slicing operation
struct SliceResult {
  std::size_t intersection_count{0};  // Number of edge-hyperplane intersections
  BufferView intersection_points{};  // SoA: dimension * intersection_count
  IndexBufferView intersection_edges{};  // Original edge indices that were intersected
};

// Slice a polytope by a hyperplane, computing intersection points on edges
// vertices: SoA buffer of dimension * vertex_count
// edges: pairs of vertex indices
// hyperplane: hyperplane definition
// out_points: preallocated buffer for intersection points (dimension * max_intersections)
// out_edge_indices: preallocated buffer for edge indices (max_intersections)
// Returns: SliceResult with actual intersection count and views into the output buffers
SliceResult slice_polytope(
    ConstBufferView vertices,
    std::size_t vertex_count,
    std::size_t dimension,
    ConstIndexBufferView edges,
    const Hyperplane& hyperplane,
    BufferView out_points,
    IndexBufferView out_edge_indices
);

// Compute signed distance from a point to a hyperplane
// point: n-dimensional point
// hyperplane: hyperplane definition
// Returns: signed distance (positive on normal side, negative on opposite side)
[[nodiscard]] float point_to_hyperplane_distance(
    const float* point,
    const Hyperplane& hyperplane
);

// Classify vertices relative to a hyperplane
// vertices: SoA buffer of dimension * vertex_count
// hyperplane: hyperplane definition
// out_classifications: preallocated buffer (vertex_count), will contain:
//   -1 for points behind hyperplane (negative side)
//    0 for points on hyperplane (within epsilon)
//   +1 for points in front of hyperplane (positive side)
void classify_vertices(
    ConstBufferView vertices,
    std::size_t vertex_count,
    std::size_t dimension,
    const Hyperplane& hyperplane,
    int* out_classifications
);

// Compute level-set intersection for a scalar field
// This is a placeholder for future level-set functionality
// that will integrate with the calculus VM
struct LevelSetParams {
  float iso_value{0.0f};
  float epsilon{1e-5f};
};

}  // namespace ndvis
