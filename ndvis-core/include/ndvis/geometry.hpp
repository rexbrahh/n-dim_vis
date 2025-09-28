#pragma once

#include <cstddef>

#include "ndvis/types.hpp"

namespace ndvis {

struct PolytopeBuffers {
  int dimension{0};
  BufferView vertices{};  // Structure-of-arrays: axis-major, length = dimension * vertex_count
  IndexBufferView edges{};  // Pairs of vertex indices (u,v)
};

[[nodiscard]] std::size_t hypercube_vertex_count(int dimension);
[[nodiscard]] std::size_t hypercube_edge_count(int dimension);
PolytopeBuffers generate_hypercube(int dimension, BufferView vertices, IndexBufferView edges);

[[nodiscard]] std::size_t simplex_vertex_count(int dimension);
[[nodiscard]] std::size_t simplex_edge_count(int dimension);
PolytopeBuffers generate_simplex(int dimension, BufferView vertices, IndexBufferView edges);

[[nodiscard]] std::size_t orthoplex_vertex_count(int dimension);
[[nodiscard]] std::size_t orthoplex_edge_count(int dimension);
PolytopeBuffers generate_orthoplex(int dimension, BufferView vertices, IndexBufferView edges);

}  // namespace ndvis
