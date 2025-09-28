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

#ifdef __cplusplus
}
#endif

