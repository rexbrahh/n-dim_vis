#pragma once

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef unsigned int ndvis_index_t;

struct NdvisBuffer {
  float* data;
  size_t length;
};

struct NdvisIndexBuffer {
  ndvis_index_t* data;
  size_t length;
};

struct NdvisBasis3 {
  float* data;
  size_t stride;
  size_t dimension;
};

size_t ndvis_hypercube_vertex_count(int dimension);
size_t ndvis_hypercube_edge_count(int dimension);
void ndvis_generate_hypercube(int dimension, NdvisBuffer vertices, NdvisIndexBuffer edges);

size_t ndvis_simplex_vertex_count(int dimension);
size_t ndvis_simplex_edge_count(int dimension);
void ndvis_generate_simplex(int dimension, NdvisBuffer vertices, NdvisIndexBuffer edges);

size_t ndvis_orthoplex_vertex_count(int dimension);
size_t ndvis_orthoplex_edge_count(int dimension);
void ndvis_generate_orthoplex(int dimension, NdvisBuffer vertices, NdvisIndexBuffer edges);
// Caller must preallocate `basis` and `vertices` buffers before invoking.
void ndvis_compute_pca_basis(NdvisBuffer vertices, size_t vertex_count, size_t dimension, NdvisBasis3 basis);
// Caller must preallocate `basis`, `vertices`, and `eigenvalues` buffers (use malloc/_malloc in WASM) before invoking.
void ndvis_compute_pca_with_values(NdvisBuffer vertices, size_t vertex_count, size_t dimension, NdvisBasis3 basis, NdvisBuffer eigenvalues);

// Overlay computation API
struct NdvisOverlayGeometry {
  const float* vertices;
  size_t vertex_count;
  size_t dimension;
  const ndvis_index_t* edges;
  size_t edge_count;
  const float* rotation_matrix;
  const float* basis3;
};

struct NdvisOverlayHyperplane {
  const float* coefficients;
  size_t dimension;
  float offset;
  int enabled;
};

struct NdvisOverlayCalculus {
  const char* expression_utf8;
  size_t expression_length;
  const float* probe_point;
  const float* level_set_values;
  size_t level_set_count;
  int show_gradient;
  int show_tangent_plane;
  int show_level_sets;
  float gradient_scale;
};

struct NdvisOverlayBuffers {
  float* projected_vertices;
  size_t projected_stride;
  float* slice_positions;
  size_t slice_capacity;
  size_t* slice_count;
  float* gradient_positions;
  float* tangent_patch_positions;
  float** level_set_curves;
  size_t* level_set_sizes;
  size_t level_set_capacity;
  size_t* level_set_count;
};

enum NdvisOverlayResult {
  NDVIS_OVERLAY_SUCCESS = 0,
  NDVIS_OVERLAY_INVALID_INPUTS = 1,
  NDVIS_OVERLAY_NULL_BUFFER = 2,
  NDVIS_OVERLAY_EVAL_ERROR = 3,
  NDVIS_OVERLAY_GRADIENT_ERROR = 4,
};

int ndvis_compute_overlays(
    const NdvisOverlayGeometry* geometry,
    const NdvisOverlayHyperplane* hyperplane,
    const NdvisOverlayCalculus* calculus,
    NdvisOverlayBuffers* buffers);

// Hyperplane utilities
struct NdvisHyperplane {
  const float* normal;  // n-dimensional unit normal vector
  size_t dimension;
  float offset;  // scalar offset b in a·x = b
};

struct NdvisSliceResult {
  size_t intersection_count;
  NdvisBuffer intersection_points;  // dimension * intersection_count
  NdvisIndexBuffer intersection_edges;  // edge indices that were intersected
};

// Compute signed distance from a point to a hyperplane
float ndvis_point_to_hyperplane_distance(const float* point, NdvisHyperplane hyperplane);

// Classify vertices relative to hyperplane (-1, 0, or +1)
void ndvis_classify_vertices(NdvisBuffer vertices, size_t vertex_count, size_t dimension, NdvisHyperplane hyperplane, int* out_classifications);

// Slice a polytope with a hyperplane
// Caller must preallocate out_points (dimension * max_edges) and out_edge_indices (max_edges)
NdvisSliceResult ndvis_slice_polytope(NdvisBuffer vertices, size_t vertex_count, size_t dimension, NdvisIndexBuffer edges, NdvisHyperplane hyperplane, NdvisBuffer out_points, NdvisIndexBuffer out_edge_indices);

// Rotation API
struct NdvisRotationPlane {
  unsigned int i;
  unsigned int j;
  float theta;
};

// Project structure-of-arrays vertices into 3D using rotation matrix and basis
void ndvis_project_geometry(
    const float* vertices,
    size_t vertex_count,
    size_t dimension,
    const float* rotation_matrix,
    size_t rotation_stride,
    const float* basis3,
    size_t basis_stride,
    float* out_positions,
    size_t out_length);

// Apply a batch of Givens rotation planes to a rotation matrix (in-place, row-major)
void ndvis_apply_rotations(float* matrix, size_t order, const NdvisRotationPlane* planes, size_t plane_count);

// Compute orthogonality drift metric: Frobenius norm of (R^T R - I)
float ndvis_compute_orthogonality_drift(const float* matrix, size_t order);

// Re-orthonormalize a rotation matrix using QR decomposition (modified Gram-Schmidt)
void ndvis_reorthonormalize(float* matrix, size_t order);

#ifdef __cplusplus
}
#endif
