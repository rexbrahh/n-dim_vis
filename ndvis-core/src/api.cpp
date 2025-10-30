#include "ndvis/api.h"

#include "ndvis/geometry.hpp"
#include "ndvis/pca.hpp"
#include "ndvis/hyperplane.hpp"
#include "ndvis/overlays.hpp"
#include "ndvis/rotations.hpp"
#include "ndvis/qr.hpp"

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

int ndvis_compute_overlays(
    const NdvisOverlayGeometry* geometry_c,
    const NdvisOverlayHyperplane* hyperplane_c,
    const NdvisOverlayCalculus* calculus_c,
    NdvisOverlayBuffers* buffers_c) {
  if (geometry_c == nullptr || buffers_c == nullptr) {
    return NDVIS_OVERLAY_INVALID_INPUTS;
  }

  if (geometry_c->dimension == 0) {
    return NDVIS_OVERLAY_INVALID_INPUTS;
  }

  if (hyperplane_c != nullptr && hyperplane_c->dimension != geometry_c->dimension) {
    return NDVIS_OVERLAY_INVALID_INPUTS;
  }

  ndvis::GeometryInputs geometry_inputs{
      geometry_c->vertices,
      geometry_c->vertex_count,
      geometry_c->dimension,
      reinterpret_cast<const unsigned int*>(geometry_c->edges),
      geometry_c->edge_count,
      geometry_c->rotation_matrix,
      geometry_c->basis3,
  };

  ndvis::HyperplaneInputs hyperplane_inputs{
      hyperplane_c ? hyperplane_c->coefficients : nullptr,
      hyperplane_c ? static_cast<float>(hyperplane_c->offset) : 0.0f,
      hyperplane_c ? hyperplane_c->enabled != 0 : false,
  };

  ndvis::CalculusInputs calculus_inputs{};
  if (calculus_c != nullptr) {
    calculus_inputs.expression_utf8 = calculus_c->expression_utf8;
    calculus_inputs.expression_length = calculus_c->expression_length;
    calculus_inputs.probe_point = calculus_c->probe_point;
    calculus_inputs.level_set_values = calculus_c->level_set_values;
    calculus_inputs.level_set_count = calculus_c->level_set_count;
    calculus_inputs.show_gradient = calculus_c->show_gradient != 0;
    calculus_inputs.show_tangent_plane = calculus_c->show_tangent_plane != 0;
    calculus_inputs.show_level_sets = calculus_c->show_level_sets != 0;
    calculus_inputs.gradient_scale = calculus_c->gradient_scale;
  }

  ndvis::OverlayBuffers overlay_buffers{};
  overlay_buffers.projected_vertices = buffers_c->projected_vertices;
  overlay_buffers.projected_stride = buffers_c->projected_stride;
  overlay_buffers.slice_positions = buffers_c->slice_positions;
  overlay_buffers.slice_capacity = buffers_c->slice_capacity;
  overlay_buffers.slice_count = buffers_c->slice_count;
  overlay_buffers.gradient_positions = buffers_c->gradient_positions;
  overlay_buffers.tangent_patch_positions = buffers_c->tangent_patch_positions;
  overlay_buffers.level_set_curves = buffers_c->level_set_curves;
  overlay_buffers.level_set_sizes = buffers_c->level_set_sizes;
  overlay_buffers.level_set_capacity = buffers_c->level_set_capacity;
  overlay_buffers.level_set_count = buffers_c->level_set_count;

  auto result = compute_overlays(geometry_inputs, hyperplane_inputs, calculus_inputs, overlay_buffers);
  return static_cast<int>(result);
}

void ndvis_apply_rotations(float* matrix, size_t order, const NdvisRotationPlane* planes, size_t plane_count) {
  if (matrix == nullptr || planes == nullptr) {
    return;
  }
  // Convert C API structs to C++ structs
  auto* cpp_planes = reinterpret_cast<const ndvis::RotationPlane*>(planes);
  ndvis::apply_rotations_incremental(matrix, order, cpp_planes, plane_count);
}

float ndvis_compute_orthogonality_drift(const float* matrix, size_t order) {
  return ndvis::compute_orthogonality_drift(matrix, order);
}

void ndvis_reorthonormalize(float* matrix, size_t order) {
  ndvis::reorthonormalize(matrix, order);
}

}  // extern "C"
