#include "ndvis/geometry.hpp"

#include <cstddef>

namespace ndvis {

namespace {

constexpr std::size_t kMaxDimension = 31;  // 2^31 fits inside size_t on 64-bit targets

[[nodiscard]] bool validate_dimension(int dimension) {
  return dimension > 0 && dimension <= static_cast<int>(kMaxDimension);
}

[[nodiscard]] std::size_t checked_pow2(int exponent) {
  return static_cast<std::size_t>(1) << exponent;
}

[[nodiscard]] BufferView slice_axis(BufferView view, std::size_t axis, std::size_t axis_length) {
  return BufferView{view.data + axis * axis_length, axis_length};
}

inline void clear_axis(BufferView axis_view) {
  if (axis_view.data == nullptr) {
    return;
  }
  for (std::size_t idx = 0; idx < axis_view.length; ++idx) {
    axis_view.data[idx] = 0.0f;
  }
}

}  // namespace

std::size_t hypercube_vertex_count(int dimension) {
  if (!validate_dimension(dimension)) {
    return 0;
  }
  return checked_pow2(dimension);
}

std::size_t hypercube_edge_count(int dimension) {
  if (!validate_dimension(dimension)) {
    return 0;
  }
  if (dimension == 0) {
    return 0;
  }
  const std::size_t vertices = hypercube_vertex_count(dimension);
  return static_cast<std::size_t>(dimension) * (vertices >> 1);
}

PolytopeBuffers generate_hypercube(int dimension, BufferView vertices, IndexBufferView edges) {
  if (!validate_dimension(dimension)) {
    return {};
  }

  const std::size_t vertex_count = hypercube_vertex_count(dimension);
  const std::size_t required_vertex_floats = vertex_count * static_cast<std::size_t>(dimension);
  if (vertices.data == nullptr || vertices.length < required_vertex_floats) {
    return {};
  }

  const std::size_t edge_count = hypercube_edge_count(dimension);
  const std::size_t required_edge_indices = edge_count * 2;
  if (edges.data == nullptr || edges.length < required_edge_indices) {
    return {};
  }

  for (int axis = 0; axis < dimension; ++axis) {
    auto axis_view = slice_axis(vertices, static_cast<std::size_t>(axis), vertex_count);
    for (std::size_t v = 0; v < vertex_count; ++v) {
      const bool bit = (v >> axis) & 1U;
      axis_view.data[v] = bit ? 1.0f : -1.0f;
    }
  }

  std::size_t edge_cursor = 0;
  for (int axis = 0; axis < dimension; ++axis) {
    const unsigned int mask = static_cast<unsigned int>(1U << axis);
    for (unsigned int v = 0; v < vertex_count; ++v) {
      const unsigned int neighbor = v ^ mask;
      if (v < neighbor) {
        edges.data[edge_cursor++] = v;
        edges.data[edge_cursor++] = neighbor;
      }
    }
  }

  return PolytopeBuffers{
      dimension,
      BufferView{vertices.data, required_vertex_floats},
      IndexBufferView{edges.data, edge_cursor},
  };
}

std::size_t simplex_vertex_count(int dimension) {
  if (!validate_dimension(dimension)) {
    return 0;
  }
  return static_cast<std::size_t>(dimension) + 1U;
}

std::size_t simplex_edge_count(int dimension) {
  const std::size_t vertex_count = simplex_vertex_count(dimension);
  if (vertex_count < 2U) {
    return 0;
  }
  return (vertex_count * (vertex_count - 1U)) / 2U;
}

PolytopeBuffers generate_simplex(int dimension, BufferView vertices, IndexBufferView edges) {
  if (!validate_dimension(dimension)) {
    return {};
  }

  const std::size_t vertex_count = simplex_vertex_count(dimension);
  const std::size_t required_vertex_floats = vertex_count * static_cast<std::size_t>(dimension);
  if (vertices.data == nullptr || vertices.length < required_vertex_floats) {
    return {};
  }

  const std::size_t edge_count = simplex_edge_count(dimension);
  const std::size_t required_edge_indices = edge_count * 2U;
  if (edges.data == nullptr || edges.length < required_edge_indices) {
    return {};
  }

  for (int axis = 0; axis < dimension; ++axis) {
    clear_axis(slice_axis(vertices, static_cast<std::size_t>(axis), vertex_count));
  }

  for (int axis = 0; axis < dimension; ++axis) {
    auto axis_view = slice_axis(vertices, static_cast<std::size_t>(axis), vertex_count);
    axis_view.data[static_cast<std::size_t>(axis) + 1U] = 1.0f;
  }

  std::size_t edge_cursor = 0;
  for (unsigned int a = 0; a < vertex_count; ++a) {
    for (unsigned int b = static_cast<unsigned int>(a + 1U); b < vertex_count; ++b) {
      edges.data[edge_cursor++] = a;
      edges.data[edge_cursor++] = b;
    }
  }

  return PolytopeBuffers{
      dimension,
      BufferView{vertices.data, required_vertex_floats},
      IndexBufferView{edges.data, edge_cursor},
  };
}

std::size_t orthoplex_vertex_count(int dimension) {
  if (!validate_dimension(dimension)) {
    return 0;
  }
  return static_cast<std::size_t>(dimension) * 2U;
}

std::size_t orthoplex_edge_count(int dimension) {
  if (!validate_dimension(dimension)) {
    return 0;
  }
  if (dimension < 2) {
    return static_cast<std::size_t>(dimension) * 2U;
  }
  return static_cast<std::size_t>(dimension) * static_cast<std::size_t>(dimension - 1) * 2U;
}

PolytopeBuffers generate_orthoplex(int dimension, BufferView vertices, IndexBufferView edges) {
  if (!validate_dimension(dimension)) {
    return {};
  }

  const std::size_t vertex_count = orthoplex_vertex_count(dimension);
  const std::size_t required_vertex_floats = vertex_count * static_cast<std::size_t>(dimension);
  if (vertices.data == nullptr || vertices.length < required_vertex_floats) {
    return {};
  }

  const std::size_t edge_count = orthoplex_edge_count(dimension);
  const std::size_t required_edge_indices = edge_count * 2U;
  if (edges.data == nullptr || edges.length < required_edge_indices) {
    return {};
  }

  for (int axis = 0; axis < dimension; ++axis) {
    clear_axis(slice_axis(vertices, static_cast<std::size_t>(axis), vertex_count));
  }

  for (int axis = 0; axis < dimension; ++axis) {
    auto axis_view = slice_axis(vertices, static_cast<std::size_t>(axis), vertex_count);
    const std::size_t positive_index = static_cast<std::size_t>(axis) * 2U;
    const std::size_t negative_index = positive_index + 1U;
    axis_view.data[positive_index] = 1.0f;
    axis_view.data[negative_index] = -1.0f;
  }

  std::size_t edge_cursor = 0;
  for (int axis_a = 0; axis_a < dimension; ++axis_a) {
    for (int sign_a = 0; sign_a < 2; ++sign_a) {
      const unsigned int vertex_a = static_cast<unsigned int>(axis_a * 2 + sign_a);
      for (int axis_b = axis_a + 1; axis_b < dimension; ++axis_b) {
        for (int sign_b = 0; sign_b < 2; ++sign_b) {
          const unsigned int vertex_b = static_cast<unsigned int>(axis_b * 2 + sign_b);
          edges.data[edge_cursor++] = vertex_a;
          edges.data[edge_cursor++] = vertex_b;
        }
      }
    }
  }

  return PolytopeBuffers{
      dimension,
      BufferView{vertices.data, required_vertex_floats},
      IndexBufferView{edges.data, edge_cursor},
  };
}

}  // namespace ndvis
