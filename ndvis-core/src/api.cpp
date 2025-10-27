#include "ndvis/api.h"

#include "ndvis/geometry.hpp"
#include "ndvis/pca.hpp"
#include "ndvis/hyperplane.hpp"

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

float ndvis_point_to_hyperplane_distance(const float* point, NdvisHyperplane hyperplane) {
  Hyperplane hp{hyperplane.normal, hyperplane.dimension, hyperplane.offset};
  return point_to_hyperplane_distance(point, hp);
}

void ndvis_classify_vertices(NdvisBuffer vertices, size_t vertex_count, size_t dimension, NdvisHyperplane hyperplane, int* out_classifications) {
  if (vertices.data == nullptr || out_classifications == nullptr) {
    return;
  }
  Hyperplane hp{hyperplane.normal, hyperplane.dimension, hyperplane.offset};
  classify_vertices(ConstBufferView{vertices.data, vertices.length}, vertex_count, dimension, hp, out_classifications);
}

NdvisSliceResult ndvis_slice_polytope(NdvisBuffer vertices, size_t vertex_count, size_t dimension, NdvisIndexBuffer edges, NdvisHyperplane hyperplane, NdvisBuffer out_points, NdvisIndexBuffer out_edge_indices) {
  NdvisSliceResult c_result{0, {nullptr, 0}, {nullptr, 0}};

  if (vertices.data == nullptr || edges.data == nullptr || out_points.data == nullptr) {
    return c_result;
  }

  Hyperplane hp{hyperplane.normal, hyperplane.dimension, hyperplane.offset};

  SliceResult result = slice_polytope(
      ConstBufferView{vertices.data, vertices.length},
      vertex_count,
      dimension,
      ConstIndexBufferView{edges.data, edges.length},
      hp,
      BufferView{out_points.data, out_points.length},
      IndexBufferView{out_edge_indices.data, out_edge_indices.length}
  );

  c_result.intersection_count = result.intersection_count;
  c_result.intersection_points = {result.intersection_points.data, result.intersection_points.length};
  c_result.intersection_edges = {result.intersection_edges.data, result.intersection_edges.length};

  return c_result;
}

}  // extern "C"
