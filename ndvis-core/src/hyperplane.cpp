#include "ndvis/hyperplane.hpp"

#include <algorithm>
#include <cmath>
#include <vector>

namespace ndvis {

namespace {

constexpr float kEpsilon = 1e-5f;

// Compute dot product of two n-dimensional vectors
float dot_product(const float* a, const float* b, std::size_t dimension) {
  float result = 0.0f;
  for (std::size_t i = 0; i < dimension; ++i) {
    result += a[i] * b[i];
  }
  return result;
}

// Extract a vertex from SoA layout
void extract_vertex(const float* soa_data, std::size_t vertex_index,
                    std::size_t vertex_count, std::size_t dimension,
                    float* out_vertex) {
  for (std::size_t d = 0; d < dimension; ++d) {
    out_vertex[d] = soa_data[d * vertex_count + vertex_index];
  }
}

// Store a vertex in SoA layout
void store_vertex(float* soa_data, std::size_t vertex_index,
                  std::size_t vertex_count, std::size_t dimension,
                  const float* vertex) {
  for (std::size_t d = 0; d < dimension; ++d) {
    soa_data[d * vertex_count + vertex_index] = vertex[d];
  }
}

}  // namespace

float point_to_hyperplane_distance(const float* point,
                                    const Hyperplane& hyperplane) {
  const float dot = dot_product(point, hyperplane.normal, hyperplane.dimension);
  return dot - hyperplane.offset;
}

void classify_vertices(ConstBufferView vertices, std::size_t vertex_count,
                       std::size_t dimension, const Hyperplane& hyperplane,
                       int* out_classifications) {
  std::vector<float> vertex(dimension);

  for (std::size_t v = 0; v < vertex_count; ++v) {
    extract_vertex(vertices.data, v, vertex_count, dimension, vertex.data());

    const float distance = point_to_hyperplane_distance(vertex.data(), hyperplane);

    if (std::abs(distance) < kEpsilon) {
      out_classifications[v] = 0;  // On hyperplane
    } else if (distance > 0.0f) {
      out_classifications[v] = 1;  // Front (positive side)
    } else {
      out_classifications[v] = -1;  // Back (negative side)
    }
  }
}

SliceResult slice_polytope(ConstBufferView vertices, std::size_t vertex_count,
                           std::size_t dimension, ConstIndexBufferView edges,
                           const Hyperplane& hyperplane, BufferView out_points,
                           IndexBufferView out_edge_indices) {
  SliceResult result{};

  // Classify all vertices
  std::vector<int> classifications(vertex_count);
  classify_vertices(vertices, vertex_count, dimension, hyperplane,
                    classifications.data());

  std::size_t intersection_count = 0;
  const std::size_t edge_count = edges.length / 2;
  const std::size_t max_intersections = out_points.length / dimension;

  std::vector<float> v0(dimension);
  std::vector<float> v1(dimension);
  std::vector<float> intersection(dimension);

  for (std::size_t e = 0; e < edge_count; ++e) {
    const index_type v0_idx = edges.data[2 * e];
    const index_type v1_idx = edges.data[2 * e + 1];

    const int class0 = classifications[v0_idx];
    const int class1 = classifications[v1_idx];

    // Edge intersects hyperplane if endpoints are on opposite sides
    // (or one is exactly on the hyperplane)
    if (class0 * class1 < 0 || (class0 == 0 && class1 != 0) ||
        (class0 != 0 && class1 == 0)) {

      // Check capacity before writing
      if (intersection_count >= max_intersections) {
        break;  // Output buffer full
      }

      if (out_edge_indices.data && intersection_count >= out_edge_indices.length) {
        break;  // Edge index buffer full
      }

      extract_vertex(vertices.data, v0_idx, vertex_count, dimension, v0.data());
      extract_vertex(vertices.data, v1_idx, vertex_count, dimension, v1.data());

      const float d0 = point_to_hyperplane_distance(v0.data(), hyperplane);
      const float d1 = point_to_hyperplane_distance(v1.data(), hyperplane);

      // Compute interpolation parameter t
      // intersection = v0 + t * (v1 - v0)
      // We want: dot(normal, intersection) = offset
      float t = 0.0f;
      if (std::abs(d0 - d1) > kEpsilon) {
        t = d0 / (d0 - d1);
      } else if (std::abs(d0) < kEpsilon) {
        t = 0.0f;
      } else {
        t = 1.0f;
      }

      // Clamp t to [0, 1]
      t = std::max(0.0f, std::min(1.0f, t));

      // Compute intersection point
      for (std::size_t d = 0; d < dimension; ++d) {
        intersection[d] = v0[d] + t * (v1[d] - v0[d]);
      }

      // Store intersection directly in correct SoA layout
      // SoA: [x0, x1, x2, ..., y0, y1, y2, ..., z0, z1, z2, ...]
      for (std::size_t d = 0; d < dimension; ++d) {
        out_points.data[d * max_intersections + intersection_count] = intersection[d];
      }

      // Store edge index
      if (out_edge_indices.data) {
        out_edge_indices.data[intersection_count] = static_cast<index_type>(e);
      }

      ++intersection_count;
    }
  }

  result.intersection_count = intersection_count;
  result.intersection_points = BufferView{
      out_points.data, dimension * intersection_count};
  result.intersection_edges = IndexBufferView{
      out_edge_indices.data, intersection_count};

  return result;
}

}  // namespace ndvis
