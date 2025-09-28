#include "ndvis/api.h"

#include "ndvis/geometry.hpp"
#include "ndvis/pca.hpp"

using namespace ndvis;

extern "C" {

std::size_t ndvis_hypercube_vertex_count(int dimension) {
  return hypercube_vertex_count(dimension);
}

std::size_t ndvis_hypercube_edge_count(int dimension) {
  return hypercube_edge_count(dimension);
}

void ndvis_generate_hypercube(int dimension, NdvisBuffer vertices, NdvisIndexBuffer edges) {
  generate_hypercube(dimension, BufferView{vertices.data, vertices.length}, IndexBufferView{edges.data, edges.length});
}

std::size_t ndvis_simplex_vertex_count(int dimension) {
  return simplex_vertex_count(dimension);
}

std::size_t ndvis_simplex_edge_count(int dimension) {
  return simplex_edge_count(dimension);
}

void ndvis_generate_simplex(int dimension, NdvisBuffer vertices, NdvisIndexBuffer edges) {
  generate_simplex(dimension, BufferView{vertices.data, vertices.length}, IndexBufferView{edges.data, edges.length});
}

std::size_t ndvis_orthoplex_vertex_count(int dimension) {
  return orthoplex_vertex_count(dimension);
}

std::size_t ndvis_orthoplex_edge_count(int dimension) {
  return orthoplex_edge_count(dimension);
}


void ndvis_generate_orthoplex(int dimension, NdvisBuffer vertices, NdvisIndexBuffer edges) {
  generate_orthoplex(dimension, BufferView{vertices.data, vertices.length}, IndexBufferView{edges.data, edges.length});
}

void ndvis_compute_pca_basis(NdvisBuffer vertices, size_t vertex_count, size_t dimension, NdvisBasis3 basis) {
  if (vertices.data == nullptr || basis.data == nullptr) {
    return;
  }
  const std::size_t required = dimension * vertex_count;
  if (vertices.length < required || basis.stride < dimension) {
    return;
  }
  compute_pca_basis(vertices.data, vertex_count, dimension, basis.data);
}

void ndvis_compute_pca_with_values(NdvisBuffer vertices, size_t vertex_count, size_t dimension, NdvisBasis3 basis, NdvisBuffer eigenvalues) {
  if (vertices.data == nullptr || basis.data == nullptr || eigenvalues.data == nullptr) {
    return;
  }
  const std::size_t required = dimension * vertex_count;
  if (vertices.length < required || basis.stride < dimension || eigenvalues.length < dimension) {
    return;
  }
  compute_pca_basis_with_values(vertices.data, vertex_count, dimension, basis.data, eigenvalues.data);
}

}  // extern "C"
