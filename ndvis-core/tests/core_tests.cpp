#include <stdint.h>
#include <cassert>
#include <cstddef>
#include <string>

#include "ndvis/api.h"
#include "ndvis/geometry.hpp"
#include "ndvis/projection.hpp"
#include "ndvis/qr.hpp"
#include "ndvis/rotations.hpp"
#include "ndvis/types.hpp"
#include "ndvis/pca.hpp"
#include "ndvis/hyperplane.hpp"
#include "ndvis/overlays.hpp"

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
    const int dimension = 4;
    const std::size_t vertex_count = ndvis_hypercube_vertex_count(dimension);
    const std::size_t edge_count = ndvis_hypercube_edge_count(dimension);
    assert(vertex_count == 16);
    assert(edge_count == 32);

    float vertices[4 * 16] = {0.0f};
    unsigned int edges[32 * 2] = {0};

    NdvisBuffer vertex_buffer{vertices, 4 * 16};
    NdvisIndexBuffer edge_buffer{edges, 32 * 2};
    ndvis_generate_hypercube(dimension, vertex_buffer, edge_buffer);

    for (std::size_t v = 0; v < vertex_count; ++v) {
      for (int axis = 0; axis < dimension; ++axis) {
        const float coord = vertices[axis * vertex_count + v];
        const float expected = ((v >> axis) & 1U) ? 1.0f : -1.0f;
        assert(approx_equal(coord, expected));
      }
    }

    bool edges_valid = true;
    for (std::size_t e = 0; e < edge_count; ++e) {
      const unsigned int u = edges[2 * e];
      const unsigned int v = edges[2 * e + 1];
      unsigned int hamming = 0;
      for (unsigned int bit = 0; bit < static_cast<unsigned int>(dimension); ++bit) {
        if (((u >> bit) & 1U) != ((v >> bit) & 1U)) ++hamming;
      }
      edges_valid &= (hamming == 1);
    }
    assert(edges_valid);
  }

  {
    const int dimension = 5;
    const std::size_t vertex_count = ndvis_simplex_vertex_count(dimension);
    const std::size_t edge_count = ndvis_simplex_edge_count(dimension);
    assert(vertex_count == 6);
    assert(edge_count == 15);

    float vertices[5 * 6] = {0.0f};
    unsigned int edges[15 * 2] = {0};

    NdvisBuffer vertex_buffer{vertices, 5 * 6};
    NdvisIndexBuffer edge_buffer{edges, 15 * 2};
    ndvis_generate_simplex(dimension, vertex_buffer, edge_buffer);

    assert(approx_equal(vertices[0], 0.0f));
    for (int axis = 0; axis < dimension; ++axis) {
      const float coord = vertices[axis * vertex_count + (axis + 1)];
      assert(approx_equal(coord, 1.0f));
    }

    std::size_t edge_index = 0;
    for (std::size_t a = 0; a < vertex_count; ++a) {
      for (std::size_t b = a + 1; b < vertex_count; ++b) {
        assert(edges[edge_index * 2] == a);
        assert(edges[edge_index * 2 + 1] == b);
        ++edge_index;
      }
    }
    assert(edge_index == edge_count);
  }

  {
    const int dimension = 6;
    const std::size_t vertex_count = ndvis_orthoplex_vertex_count(dimension);
    const std::size_t edge_count = ndvis_orthoplex_edge_count(dimension);
    assert(vertex_count == 12);
    assert(edge_count == 60);

    float vertices[6 * 12] = {0.0f};
    unsigned int edges[60 * 2] = {0};

    NdvisBuffer vertex_buffer{vertices, 6 * 12};
    NdvisIndexBuffer edge_buffer{edges, 60 * 2};
    ndvis_generate_orthoplex(dimension, vertex_buffer, edge_buffer);

    for (int axis = 0; axis < dimension; ++axis) {
      const std::size_t pos_idx = axis * 2;
      const std::size_t neg_idx = pos_idx + 1;
      assert(approx_equal(vertices[axis * vertex_count + pos_idx], 1.0f));
      assert(approx_equal(vertices[axis * vertex_count + neg_idx], -1.0f));
      for (int other_axis = 0; other_axis < dimension; ++other_axis) {
        if (other_axis != axis) {
          assert(approx_equal(vertices[other_axis * vertex_count + pos_idx], 0.0f));
          assert(approx_equal(vertices[other_axis * vertex_count + neg_idx], 0.0f));
        }
      }
    }

    bool edges_valid = true;
    for (std::size_t e = 0; e < edge_count; ++e) {
      const unsigned int u = edges[2 * e];
      const unsigned int v = edges[2 * e + 1];
      int u_axis = u / 2;
      int v_axis = v / 2;
      edges_valid &= (u_axis != v_axis);
    }
    assert(edges_valid);
  }

  {
    const int dimension = 8;
    const std::size_t vertex_count = ndvis_hypercube_vertex_count(dimension);
    const std::size_t edge_count = ndvis_hypercube_edge_count(dimension);
    assert(vertex_count == 256);
    assert(edge_count == 1024);

    float vertices[8 * 256] = {0.0f};
    unsigned int edges[1024 * 2] = {0};

    NdvisBuffer vertex_buffer{vertices, 8 * 256};
    NdvisIndexBuffer edge_buffer{edges, 1024 * 2};
    ndvis_generate_hypercube(dimension, vertex_buffer, edge_buffer);

    for (int axis = 0; axis < dimension; ++axis) {
      for (std::size_t v = 0; v < vertex_count; ++v) {
        const float coord = vertices[axis * vertex_count + v];
        const float expected = ((v >> axis) & 1U) ? 1.0f : -1.0f;
        assert(approx_equal(coord, expected));
      }
    }
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

  {
    const int dimension = 4;
    const std::size_t vertex_count = ndvis_hypercube_vertex_count(dimension);
    const std::size_t edge_count = ndvis_hypercube_edge_count(dimension);
    assert(vertex_count == 16);
    assert(edge_count == 32);

    float vertices[4 * 16] = {0.0f};
    unsigned int edges[32 * 2] = {0};

    NdvisBuffer vertex_buffer{vertices, 4 * 16};
    NdvisIndexBuffer edge_buffer{edges, 32 * 2};
    ndvis_generate_hypercube(dimension, vertex_buffer, edge_buffer);

    for (std::size_t v = 0; v < vertex_count; ++v) {
      for (int axis = 0; axis < dimension; ++axis) {
        const float coord = vertices[axis * vertex_count + v];
        const float expected = ((v >> axis) & 1U) ? 1.0f : -1.0f;
        assert(approx_equal(coord, expected));
      }
    }

    bool edges_valid = true;
    for (std::size_t e = 0; e < edge_count; ++e) {
      const unsigned int u = edges[2 * e];
      const unsigned int v = edges[2 * e + 1];
      unsigned int hamming = 0;
      for (unsigned int bit = 0; bit < static_cast<unsigned int>(dimension); ++bit) {
        if (((u >> bit) & 1U) != ((v >> bit) & 1U)) ++hamming;
      }
      edges_valid &= (hamming == 1);
    }
    assert(edges_valid);
  }

  {
    const int dimension = 5;
    const std::size_t vertex_count = ndvis::simplex_vertex_count(dimension);
    const std::size_t edge_count = ndvis::simplex_edge_count(dimension);
    assert(vertex_count == 6);
    assert(edge_count == 15);

    float vertices[5 * 6] = {0.0f};
    unsigned int edges[15 * 2] = {0};

    ndvis::BufferView vertex_buffer{vertices, 5 * 6};
    ndvis::IndexBufferView edge_buffer{edges, 15 * 2};
    ndvis::generate_simplex(dimension, vertex_buffer, edge_buffer);

    assert(approx_equal(vertices[0], 0.0f));
    for (int axis = 0; axis < dimension; ++axis) {
      const float coord = vertices[axis * vertex_count + (axis + 1)];
      assert(approx_equal(coord, 1.0f));
    }

    std::size_t edge_index = 0;
    for (std::size_t a = 0; a < vertex_count; ++a) {
      for (std::size_t b = a + 1; b < vertex_count; ++b) {
        assert(edges[edge_index * 2] == a);
        assert(edges[edge_index * 2 + 1] == b);
        ++edge_index;
      }
    }
    assert(edge_index == edge_count);
  }

  {
    const int dimension = 6;
    const std::size_t vertex_count = ndvis::orthoplex_vertex_count(dimension);
    const std::size_t edge_count = ndvis::orthoplex_edge_count(dimension);
    assert(vertex_count == 12);
    assert(edge_count == 60);

    float vertices[6 * 12] = {0.0f};
    unsigned int edges[60 * 2] = {0};

    ndvis::BufferView vertex_buffer{vertices, 6 * 12};
    ndvis::IndexBufferView edge_buffer{edges, 60 * 2};
    ndvis::generate_orthoplex(dimension, vertex_buffer, edge_buffer);

    for (int axis = 0; axis < dimension; ++axis) {
      const std::size_t pos_idx = axis * 2;
      const std::size_t neg_idx = pos_idx + 1;
      assert(approx_equal(vertices[axis * vertex_count + pos_idx], 1.0f));
      assert(approx_equal(vertices[axis * vertex_count + neg_idx], -1.0f));
      for (int other_axis = 0; other_axis < dimension; ++other_axis) {
        if (other_axis != axis) {
          assert(approx_equal(vertices[other_axis * vertex_count + pos_idx], 0.0f));
          assert(approx_equal(vertices[other_axis * vertex_count + neg_idx], 0.0f));
        }
      }
    }

    bool edges_valid = true;
    for (std::size_t e = 0; e < edge_count; ++e) {
      const unsigned int u = edges[2 * e];
      const unsigned int v = edges[2 * e + 1];
      int u_axis = u / 2;
      int v_axis = v / 2;
      edges_valid &= (u_axis != v_axis);
    }
    assert(edges_valid);
  }

  {
    const int dimension = 8;
    const std::size_t vertex_count = ndvis_hypercube_vertex_count(dimension);
    assert(vertex_count == 256);

    float vertices[8 * 256] = {0.0f};
    unsigned int edges[1024 * 2] = {0};

    NdvisBuffer vertex_buffer{vertices, 8 * 256};
    NdvisIndexBuffer edge_buffer{edges, 1024 * 2};
    ndvis_generate_hypercube(dimension, vertex_buffer, edge_buffer);

    for (int axis = 0; axis < dimension; ++axis) {
      for (std::size_t v = 0; v < vertex_count; ++v) {
        const float coord = vertices[axis * vertex_count + v];
        const float expected = ((v >> axis) & 1U) ? 1.0f : -1.0f;
        assert(approx_equal(coord, expected));
      }
    }
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

  {
    const std::size_t dimension = 3;
    const std::size_t vertex_count = 8;
    const std::size_t edge_pairs = 12;

    float vertices[dimension * vertex_count] = {
        -1, 1, -1, 1, -1, 1, -1, 1,
        -1, -1, 1, 1, -1, -1, 1, 1,
        -1, -1, -1, -1, 1, 1, 1, 1
    };
    ndvis_index_t edges[edge_pairs * 2] = {
        0,1, 0,2, 0,4, 1,3, 1,5, 2,3, 2,6, 3,7, 4,5, 4,6, 5,7, 6,7
    };

    float rotation[dimension * dimension] = {
        1,0,0,
        0,1,0,
        0,0,1
    };
    float basis[dimension * 3] = {
        1,0,0,
        0,1,0,
        0,0,1
    };

    NdvisOverlayGeometry geometry{};
    geometry.vertices = vertices;
    geometry.vertex_count = vertex_count;
    geometry.dimension = dimension;
    geometry.edges = edges;
    geometry.edge_count = edge_pairs;
    geometry.rotation_matrix = rotation;
    geometry.basis3 = basis;

    float coeff[3] = {1.0f, 0.0f, 0.0f};
    NdvisOverlayHyperplane hyperplane{};
    hyperplane.coefficients = coeff;
    hyperplane.dimension = dimension;
    hyperplane.offset = 0.0f;
    hyperplane.enabled = 1;

    std::string expression = "x1";
    float probe_point[3] = {0.25f, 0.0f, 0.0f};
    float level_set_values[1] = {0.0f};

    NdvisOverlayCalculus calculus{};
    calculus.expression_utf8 = expression.c_str();
    calculus.expression_length = expression.size();
    calculus.probe_point = probe_point;
    calculus.level_set_values = level_set_values;
    calculus.level_set_count = 1;
    calculus.show_gradient = 1;
    calculus.show_tangent_plane = 1;
    calculus.show_level_sets = 1;
    calculus.gradient_scale = 0.5f;

    float projected[vertex_count * 3] = {0.0f};
    float slice_positions[edge_pairs * 3] = {0.0f};
    std::size_t slice_count = 0;
    float gradient_positions[6] = {0.0f};
    float tangent_patch[12] = {0.0f};
    float level_curve_storage[edge_pairs * 3] = {0.0f};
    float* level_curves[1] = {level_curve_storage};
    std::size_t level_sizes[1] = {edge_pairs * 3};
    std::size_t level_set_count = 0;

    NdvisOverlayBuffers buffers{};
    buffers.projected_vertices = projected;
    buffers.projected_stride = vertex_count;
    buffers.slice_positions = slice_positions;
    buffers.slice_capacity = edge_pairs;
    buffers.slice_count = &slice_count;
    buffers.gradient_positions = gradient_positions;
    buffers.tangent_patch_positions = tangent_patch;
    buffers.level_set_curves = level_curves;
    buffers.level_set_sizes = level_sizes;
    buffers.level_set_capacity = 1;
    buffers.level_set_count = &level_set_count;

    const int overlay_result = ndvis_compute_overlays(&geometry, &hyperplane, &calculus, &buffers);
    assert(overlay_result == NDVIS_OVERLAY_SUCCESS);
    assert(slice_count == 4);
    assert(level_set_count == 1);
    assert(level_sizes[0] == 12);

    assert(approx_equal(gradient_positions[0], 0.25f));
    assert(approx_equal(gradient_positions[3], 0.25f + 0.5f));
    assert(tangent_patch[0] != 0.0f || tangent_patch[1] != 0.0f || tangent_patch[2] != 0.0f);

    for (std::size_t i = 0; i < level_sizes[0]; i += 3) {
      assert(approx_equal(level_curve_storage[i], 0.0f));
    }
  }

  // Test batched rotations with drift accumulation
  {
    const std::size_t dimension = 4;
    float matrix[16] = {0.0f};
    for (std::size_t i = 0; i < dimension; ++i) {
      matrix[i * dimension + i] = 1.0f;
    }

    // Apply 10 small rotation planes
    ndvis::RotationPlane planes[10];
    for (std::size_t p = 0; p < 10; ++p) {
      planes[p].i = 0;
      planes[p].j = 1;
      planes[p].theta = 0.01f;  // Small rotation
    }

    ndvis::apply_rotations(matrix, dimension, planes, 10);

    // After 10 small rotations, should still be close to orthonormal
    const float drift_initial = ndvis::compute_orthogonality_drift(matrix, dimension);
    assert(drift_initial < 1e-3f);
  }

  // Test long rotation sequence with QR re-orthonormalization
  {
    const std::size_t dimension = 5;
    float matrix[25] = {0.0f};
    for (std::size_t i = 0; i < dimension; ++i) {
      matrix[i * dimension + i] = 1.0f;
    }

    // Simulate 1000 small rotation steps (like a long animation)
    const std::size_t num_batches = 100;
    const std::size_t planes_per_batch = 10;
    const float qr_threshold = 0.01f;  // Re-orthonormalize if drift exceeds this

    for (std::size_t batch = 0; batch < num_batches; ++batch) {
      ndvis::RotationPlane planes[10];
      for (std::size_t p = 0; p < planes_per_batch; ++p) {
        planes[p].i = (batch + p) % dimension;
        planes[p].j = (batch + p + 1) % dimension;
        planes[p].theta = 0.001f;  // Very small rotation per step
      }

      ndvis::apply_rotations_incremental(matrix, dimension, planes, planes_per_batch);

      // Check drift and re-orthonormalize if needed
      const float drift = ndvis::compute_orthogonality_drift(matrix, dimension);
      if (drift > qr_threshold) {
        ndvis::reorthonormalize(matrix, dimension);
      }
    }

    // Final drift should be minimal after QR corrections
    const float final_drift = ndvis::compute_orthogonality_drift(matrix, dimension);
    assert(final_drift < 1e-2f);

    // Verify orthonormality: columns should be unit length
    for (std::size_t col = 0; col < dimension; ++col) {
      float norm = 0.0f;
      for (std::size_t row = 0; row < dimension; ++row) {
        const float value = matrix[row * dimension + col];
        norm += value * value;
      }
      assert(approx_equal(norm, 1.0f, 1e-2f));
    }

    // Verify orthogonality: dot products between distinct columns should be ~0
    for (std::size_t col_a = 0; col_a < dimension; ++col_a) {
      for (std::size_t col_b = col_a + 1; col_b < dimension; ++col_b) {
        float dot = 0.0f;
        for (std::size_t row = 0; row < dimension; ++row) {
          dot += matrix[row * dimension + col_a] * matrix[row * dimension + col_b];
        }
        assert(approx_equal(dot, 0.0f, 1e-2f));
      }
    }
  }

  // Test C API rotation functions
  {
    const std::size_t dimension = 4;
    float matrix[16] = {0.0f};
    for (std::size_t i = 0; i < dimension; ++i) {
      matrix[i * dimension + i] = 1.0f;
    }

    NdvisRotationPlane planes[3];
    planes[0].i = 0; planes[0].j = 1; planes[0].theta = 0.1f;
    planes[1].i = 1; planes[1].j = 2; planes[1].theta = 0.2f;
    planes[2].i = 2; planes[2].j = 3; planes[2].theta = 0.15f;

    ndvis_apply_rotations(matrix, dimension, planes, 3);

    // Check that rotation was applied (matrix changed)
    bool matrix_changed = false;
    for (std::size_t i = 0; i < dimension * dimension; ++i) {
      const std::size_t row = i / dimension;
      const std::size_t col = i % dimension;
      const float expected = (row == col) ? 1.0f : 0.0f;
      if (!approx_equal(matrix[i], expected, 0.01f)) {
        matrix_changed = true;
        break;
      }
    }
    assert(matrix_changed);

    // Drift should still be small
    const float drift = ndvis_compute_orthogonality_drift(matrix, dimension);
    assert(drift < 1e-3f);

    // Test QR re-orthonormalization via C API
    ndvis_reorthonormalize(matrix, dimension);
    const float drift_after_qr = ndvis_compute_orthogonality_drift(matrix, dimension);
    assert(drift_after_qr < 1e-5f);
  }

  // Test extreme drift correction scenario
  {
    const std::size_t dimension = 3;
    float matrix[9] = {
        0.99f, 0.05f, 0.02f,
        0.05f, 0.98f, 0.03f,
        0.02f, 0.03f, 0.97f,
    };

    // Initial drift should be noticeable
    const float drift_before = ndvis::compute_orthogonality_drift(matrix, dimension);
    assert(drift_before > 0.05f);

    // Re-orthonormalize
    ndvis::reorthonormalize(matrix, dimension);

    // Drift should be minimal after QR
    const float drift_after = ndvis::compute_orthogonality_drift(matrix, dimension);
    assert(drift_after < 1e-4f);

    // Verify orthonormality
    for (std::size_t col = 0; col < dimension; ++col) {
      float norm = 0.0f;
      for (std::size_t row = 0; row < dimension; ++row) {
        const float value = matrix[row * dimension + col];
        norm += value * value;
      }
      assert(approx_equal(norm, 1.0f, 1e-3f));
    }
  }

  return 0;
}
