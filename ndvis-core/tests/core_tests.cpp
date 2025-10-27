#include <stdint.h>
#include <cassert>
#include <cstddef>

#include "ndvis/api.h"
#include "ndvis/geometry.hpp"
#include "ndvis/projection.hpp"
#include "ndvis/qr.hpp"
#include "ndvis/rotations.hpp"
#include "ndvis/types.hpp"
#include "ndvis/pca.hpp"
#include "ndvis/hyperplane.hpp"

namespace {
constexpr float kEpsilon = 1e-5f;
constexpr float kHalfPi = 1.57079632679f;

float absolute(float value) {
  return value < 0.0f ? -value : value;
}

bool approx_equal(float a, float b, float eps = kEpsilon) {
  return absolute(a - b) <= eps;
}
}  // namespace

int main() {
  {
    const int dimension = 3;
    const std::size_t vertex_count = ndvis_hypercube_vertex_count(dimension);
    const std::size_t edge_count = ndvis_hypercube_edge_count(dimension);
    assert(vertex_count == 8);
    assert(edge_count == 12);

    float vertices[3 * 8] = {0.0f};
    unsigned int edges[12 * 2] = {0};

    NdvisBuffer vertex_buffer{vertices, 3 * 8};
    NdvisIndexBuffer edge_buffer{edges, 12 * 2};
    ndvis_generate_hypercube(dimension, vertex_buffer, edge_buffer);

    for (std::size_t v = 0; v < vertex_count; ++v) {
      const float expected = (v & 1U) ? 1.0f : -1.0f;
      assert(approx_equal(vertices[v], expected));
    }
  }

  {
    const std::size_t dimension = 4;
    float matrix[16] = {0.0f};
    for (std::size_t i = 0; i < dimension; ++i) {
      matrix[i * dimension + i] = 1.0f;
    }

    ndvis::RotationPlane plane{0U, 1U, kHalfPi};
    ndvis::apply_givens(matrix, dimension, plane);

    assert(approx_equal(matrix[0], 0.0f));
    assert(approx_equal(matrix[1], 1.0f));
    assert(approx_equal(matrix[dimension], -1.0f));
    assert(approx_equal(matrix[dimension + 1], 0.0f));
  }

  {
    const std::size_t dimension = 3;
    const std::size_t vertex_count = 2;

    float vertex_storage[dimension * vertex_count] = {0.0f};
    vertex_storage[0 * vertex_count + 0] = 1.0f;
    vertex_storage[1 * vertex_count + 1] = 1.0f;

    ndvis::ConstBufferView vertices_view{vertex_storage, dimension * vertex_count};

    float rotation_matrix[dimension * dimension] = {0.0f};
    for (std::size_t i = 0; i < dimension; ++i) {
      rotation_matrix[i * dimension + i] = 1.0f;
    }

    float basis_storage[dimension * 3] = {0.0f};
    for (std::size_t axis = 0; axis < dimension; ++axis) {
      basis_storage[axis] = (axis == 0) ? 1.0f : 0.0f;
      basis_storage[dimension + axis] = (axis == 1) ? 1.0f : 0.0f;
      basis_storage[2 * dimension + axis] = (axis == 2) ? 1.0f : 0.0f;
    }
    ndvis::ConstBasis3 basis{basis_storage, dimension, dimension};

    float projected[vertex_count * 3] = {0.0f};
    ndvis::project_to_3d(vertices_view, dimension, vertex_count, rotation_matrix, 0, basis, projected);

    assert(approx_equal(projected[0], 1.0f));
    assert(approx_equal(projected[1], 0.0f));
    assert(approx_equal(projected[3], 0.0f));
    assert(approx_equal(projected[4], 1.0f));
  }

  {
    const std::size_t dimension = 3;
    const std::size_t vertex_count = 4;

    float vertices[dimension * vertex_count] = {
        2.0f, -2.0f, 1.0f, -1.0f,
        0.0f, 0.0f, 0.0f, 0.0f,
        0.5f, -0.5f, 0.25f, -0.25f
    };

    float basis[dimension * 3] = {0.0f};
    ndvis::compute_pca_basis(vertices, vertex_count, dimension, basis);

    const float x0 = basis[0 * dimension + 0];
    const float x1 = basis[0 * dimension + 1];
    const float x2 = basis[0 * dimension + 2];
    const float magnitude = x0 * x0 + x1 * x1 + x2 * x2;
    assert(approx_equal(magnitude, 1.0f, 1e-3f));
    assert(absolute(x0) >= 0.95f);
    assert(absolute(x1) <= 1e-3f);
    assert(absolute(x2) <= 0.3f);
  }

  {
    const std::size_t dimension = 3;
    const std::size_t vertex_count = 4;

    float vertices[dimension * vertex_count] = {
        2.0f, -2.0f, 1.0f, -1.0f,
        0.0f, 0.0f, 0.0f, 0.0f,
        0.5f, -0.5f, 0.25f, -0.25f
    };

    float basis[dimension * 3] = {0.0f};
    float eigenvalues[dimension] = {0.0f};
    ndvis::compute_pca_basis_with_values(vertices, vertex_count, dimension, basis, eigenvalues);

    assert(approx_equal(eigenvalues[0], 85.0f / 24.0f, 1e-3f));
    assert(approx_equal(eigenvalues[1], 0.0f, 1e-4f));
    assert(approx_equal(eigenvalues[2], 0.0f, 1e-4f));
  }

  {
    const std::size_t dimension = 3;
    const std::size_t vertex_count = 4;

    float vertices_data[dimension * vertex_count] = {
        2.0f, -2.0f, 1.0f, -1.0f,
        0.0f, 0.0f, 0.0f, 0.0f,
        0.5f, -0.5f, 0.25f, -0.25f
    };
    float basis_data[dimension * 3] = {0.0f};
    float eigenvalues_data[dimension] = {0.0f};

    NdvisBuffer vertices = {vertices_data, dimension * vertex_count};
    NdvisBasis3 basis = {basis_data, dimension, dimension};
    NdvisBuffer eigenvalues = {eigenvalues_data, dimension};

    ndvis_compute_pca_with_values(vertices, vertex_count, dimension, basis, eigenvalues);
    assert(approx_equal(eigenvalues_data[0], 85.0f / 24.0f, 1e-3f));
  }

  {
    const std::size_t dimension = 3;
    const std::size_t vertex_count = 6;

    float vertices[dimension * vertex_count] = {
        1.0f, -1.0f, 0.5f, -0.5f, 0.25f, -0.25f,
        0.0f, 0.0f, 0.0f, 0.0f, 0.0f, 0.0f,
        0.1f, -0.1f, 0.05f, -0.05f, 0.02f, -0.02f
    };

    float basis[dimension * 3] = {0.0f};
    ndvis::compute_pca_basis(vertices, vertex_count, dimension, basis);

    const float x0 = basis[0 * dimension + 0];
    const float x1 = basis[0 * dimension + 1];
    const float x2 = basis[0 * dimension + 2];
    const float magnitude = x0 * x0 + x1 * x1 + x2 * x2;
    assert(approx_equal(magnitude, 1.0f, 1e-3f));
    assert(absolute(x0) >= 0.95f);
    assert(absolute(x1) <= 1e-3f);
    assert(absolute(x2) <= 0.3f);
  }

  {
    const std::size_t dimension = 3;
    const std::size_t vertex_count = 8;

    float vertices[dimension * vertex_count] = {
        1.0f, -1.0f, 0.5f, -0.5f, 0.25f, -0.25f, 0.125f, -0.125f,
        1.0f, -1.0f, 0.5f, -0.5f, 0.25f, -0.25f, 0.125f, -0.125f,
        1.0f, -1.0f, 0.5f, -0.5f, 0.25f, -0.25f, 0.125f, -0.125f
    };

    float basis[dimension * 3] = {0.0f};
    ndvis::compute_pca_basis(vertices, vertex_count, dimension, basis);

    for (std::size_t component = 0; component < dimension; ++component) {
      float norm = 0.0f;
      for (std::size_t axis = 0; axis < dimension; ++axis) {
        const float value = basis[component * dimension + axis];
        norm += value * value;
      }
      assert(approx_equal(norm, 1.0f, 1e-3f));
    }

    for (std::size_t a = 0; a < dimension; ++a) {
      for (std::size_t b = a + 1; b < dimension; ++b) {
        float dot = 0.0f;
        for (std::size_t axis = 0; axis < dimension; ++axis) {
          dot += basis[a * dimension + axis] * basis[b * dimension + axis];
        }
        assert(approx_equal(dot, 0.0f, 1e-3f));
      }
    }
  }

  {
    const std::size_t dimension = 2;
    const std::size_t vertex_count = 5;

    float vertices[dimension * vertex_count] = {
        2.0f, 1.0f, 0.5f, -0.5f, -1.0f,
        1.9f, 0.9f, 0.4f, -0.6f, -1.1f
    };

    float basis[dimension * 3] = {0.0f};
    ndvis::compute_pca_basis(vertices, vertex_count, dimension, basis);

    const float v0x = basis[0 * dimension + 0];
    const float v0y = basis[0 * dimension + 1];
    const float norm0 = v0x * v0x + v0y * v0y;
    assert(approx_equal(norm0, 1.0f, 1e-3f));
    assert(absolute(v0x - v0y) <= 0.05f);
    assert(absolute(v0x) >= 0.6f);
  }

  {
    float matrix[9] = {
        1.0f, 1.0f, 0.0f,
        0.0f, 1.0f, 1.0f,
        0.0f, 0.0f, 1.0f,
    };
    ndvis::reorthonormalize(matrix, 3);

    for (int col = 0; col < 3; ++col) {
      float norm = 0.0f;
      for (int row = 0; row < 3; ++row) {
        const float value = matrix[row * 3 + col];
        norm += value * value;
      }
      assert(approx_equal(norm, 1.0f, 1e-3f));
    }
  }

  // Test hyperplane distance computation
  {
    const std::size_t dimension = 3;
    float normal[3] = {1.0f, 0.0f, 0.0f};  // x-axis normal
    const float offset = 0.0f;  // hyperplane through origin

    ndvis::Hyperplane hyperplane{normal, dimension, offset};

    float point1[3] = {1.0f, 0.0f, 0.0f};
    float point2[3] = {-1.0f, 0.0f, 0.0f};
    float point3[3] = {0.0f, 1.0f, 0.0f};

    const float dist1 = ndvis::point_to_hyperplane_distance(point1, hyperplane);
    const float dist2 = ndvis::point_to_hyperplane_distance(point2, hyperplane);
    const float dist3 = ndvis::point_to_hyperplane_distance(point3, hyperplane);

    assert(approx_equal(dist1, 1.0f));
    assert(approx_equal(dist2, -1.0f));
    assert(approx_equal(dist3, 0.0f));
  }

  // Test vertex classification
  {
    const std::size_t dimension = 3;
    const std::size_t vertex_count = ndvis_hypercube_vertex_count(dimension);

    float vertices[3 * 8] = {0.0f};
    unsigned int edges[12 * 2] = {0};

    NdvisBuffer vertex_buffer{vertices, 3 * 8};
    NdvisIndexBuffer edge_buffer{edges, 12 * 2};
    ndvis_generate_hypercube(dimension, vertex_buffer, edge_buffer);

    float normal[3] = {1.0f, 0.0f, 0.0f};
    const float offset = 0.0f;

    ndvis::Hyperplane hyperplane{normal, dimension, offset};

    int classifications[8] = {0};
    ndvis::classify_vertices(
        ndvis::ConstBufferView{vertices, 3 * 8},
        vertex_count,
        dimension,
        hyperplane,
        classifications
    );

    // Half the cube vertices should be on each side
    int positive_count = 0;
    int negative_count = 0;
    for (std::size_t i = 0; i < vertex_count; ++i) {
      if (classifications[i] > 0) positive_count++;
      if (classifications[i] < 0) negative_count++;
    }
    assert(positive_count == 4);
    assert(negative_count == 4);
  }

  // Test hypercube slicing with hyperplane
  {
    const std::size_t dimension = 3;
    const std::size_t vertex_count = ndvis_hypercube_vertex_count(dimension);
    const std::size_t edge_count = ndvis_hypercube_edge_count(dimension);

    float vertices[3 * 8] = {0.0f};
    unsigned int edges[12 * 2] = {0};

    NdvisBuffer vertex_buffer{vertices, 3 * 8};
    NdvisIndexBuffer edge_buffer{edges, 12 * 2};
    ndvis_generate_hypercube(dimension, vertex_buffer, edge_buffer);

    // Slice with x = 0 plane
    float normal[3] = {1.0f, 0.0f, 0.0f};
    const float offset = 0.0f;

    ndvis::Hyperplane hyperplane{normal, dimension, offset};

    float intersection_points[3 * 12] = {0.0f};  // max edge_count intersections
    unsigned int intersection_edge_indices[12] = {0};

    ndvis::SliceResult result = ndvis::slice_polytope(
        ndvis::ConstBufferView{vertices, 3 * 8},
        vertex_count,
        dimension,
        ndvis::ConstIndexBufferView{edges, 12 * 2},
        hyperplane,
        ndvis::BufferView{intersection_points, 3 * 12},
        ndvis::IndexBufferView{intersection_edge_indices, 12}
    );

    // A cube sliced by x=0 should produce 4 intersection points
    // (the square cross-section)
    assert(result.intersection_count == 4);

    // All intersection points should have x ≈ 0
    for (std::size_t i = 0; i < result.intersection_count; ++i) {
      const float x = intersection_points[0 * result.intersection_count + i];
      assert(approx_equal(x, 0.0f));
    }
  }

  // Test level-set concept with 4D hypercube
  {
    const std::size_t dimension = 4;
    const std::size_t vertex_count = ndvis_hypercube_vertex_count(dimension);
    const std::size_t edge_count = ndvis_hypercube_edge_count(dimension);

    float vertices[4 * 16] = {0.0f};
    unsigned int edges[32 * 2] = {0};

    NdvisBuffer vertex_buffer{vertices, 4 * 16};
    NdvisIndexBuffer edge_buffer{edges, 32 * 2};
    ndvis_generate_hypercube(dimension, vertex_buffer, edge_buffer);

    // Slice 4D cube with w = 0 hyperplane
    float normal[4] = {0.0f, 0.0f, 0.0f, 1.0f};
    const float offset = 0.0f;

    NdvisHyperplane hyperplane{normal, dimension, offset};

    float intersection_points[4 * 32] = {0.0f};
    unsigned int intersection_edge_indices[32] = {0};

    NdvisBuffer out_points{intersection_points, 4 * 32};
    NdvisIndexBuffer out_edge_indices{intersection_edge_indices, 32};

    NdvisSliceResult result = ndvis_slice_polytope(
        vertex_buffer,
        vertex_count,
        dimension,
        edge_buffer,
        hyperplane,
        out_points,
        out_edge_indices
    );

    // 4D cube sliced by w=0 should produce 8 intersection points
    // (resulting in a 3D cube cross-section)
    assert(result.intersection_count == 8);

    // All intersection points should have w ≈ 0
    for (std::size_t i = 0; i < result.intersection_count; ++i) {
      const float w = intersection_points[3 * result.intersection_count + i];
      assert(approx_equal(w, 0.0f));
    }
  }

  return 0;
}
