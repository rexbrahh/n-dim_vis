#pragma once

#include <cstddef>

namespace ndvis {

void compute_pca_basis(const float* vertices, std::size_t vertex_count, std::size_t dimension, float* out_basis);
void compute_pca_basis_with_values(const float* vertices, std::size_t vertex_count, std::size_t dimension, float* out_basis, float* out_eigenvalues);

}  // namespace ndvis
