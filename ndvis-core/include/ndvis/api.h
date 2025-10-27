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

// Geometry helpers
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

#ifdef __cplusplus
}
#endif

