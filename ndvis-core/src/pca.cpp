#include "ndvis/pca.hpp"

#include <cstddef>

#include "ndvis/detail/jacobi.hpp"

namespace ndvis {

namespace {

inline void fill_identity_basis(std::size_t dimension, float* out_basis) {
  for (std::size_t component = 0; component < 3; ++component) {
    for (std::size_t axis = 0; axis < dimension; ++axis) {
      out_basis[component * dimension + axis] = (component == axis) ? 1.0f : 0.0f;
    }
  }
}

}  // namespace

void compute_pca_basis_with_values(const float* vertices, std::size_t vertex_count, std::size_t dimension,
                                   float* out_basis, float* out_eigenvalues) {
  if (vertices == nullptr || out_basis == nullptr || dimension == 0) {
    return;
  }

  if (vertex_count == 0) {
    fill_identity_basis(dimension, out_basis);
    if (out_eigenvalues != nullptr) {
      for (std::size_t i = 0; i < dimension; ++i) {
        out_eigenvalues[i] = 0.0f;
      }
    }
    return;
  }

  double* mean = new double[dimension];
  for (std::size_t axis = 0; axis < dimension; ++axis) {
    mean[axis] = 0.0;
  }

  for (std::size_t axis = 0; axis < dimension; ++axis) {
    double sum = 0.0;
    for (std::size_t v = 0; v < vertex_count; ++v) {
      sum += static_cast<double>(vertices[axis * vertex_count + v]);
    }
    mean[axis] = sum / static_cast<double>(vertex_count);
  }

  double* covariance = new double[dimension * dimension];
  for (std::size_t i = 0; i < dimension * dimension; ++i) {
    covariance[i] = 0.0;
  }

  const double normalizer = vertex_count > 1 ? 1.0 / static_cast<double>(vertex_count - 1) : 1.0;

  for (std::size_t v = 0; v < vertex_count; ++v) {
    for (std::size_t i = 0; i < dimension; ++i) {
      const double xi = static_cast<double>(vertices[i * vertex_count + v]) - mean[i];
      for (std::size_t j = 0; j <= i; ++j) {
        const double xj = static_cast<double>(vertices[j * vertex_count + v]) - mean[j];
        covariance[i * dimension + j] += xi * xj;
      }
    }
  }

  for (std::size_t i = 0; i < dimension; ++i) {
    for (std::size_t j = 0; j <= i; ++j) {
      const double value = covariance[i * dimension + j] * normalizer;
      covariance[i * dimension + j] = value;
      covariance[j * dimension + i] = value;
    }
  }

  double* eigenvectors = new double[dimension * dimension];
  detail::JacobiParams params{};
  detail::jacobi_symmetric(covariance, eigenvectors, dimension, params);

  double* eigenvalues = new double[dimension];
  for (std::size_t i = 0; i < dimension; ++i) {
    eigenvalues[i] = covariance[i * dimension + i];
  }
  detail::sort_eigenpairs(eigenvalues, eigenvectors, dimension);

  for (std::size_t component = 0; component < 3; ++component) {
    for (std::size_t axis = 0; axis < dimension; ++axis) {
      if (component < dimension) {
        out_basis[component * dimension + axis] = static_cast<float>(eigenvectors[axis * dimension + component]);
      } else {
        out_basis[component * dimension + axis] = (component == axis) ? 1.0f : 0.0f;
      }
    }
  }

  if (out_eigenvalues != nullptr) {
    for (std::size_t i = 0; i < dimension; ++i) {
      const double value = eigenvalues[i];
      out_eigenvalues[i] = static_cast<float>(value < 0.0 ? 0.0 : value);
    }
  }

  delete[] eigenvalues;
  delete[] eigenvectors;
  delete[] covariance;
  delete[] mean;
}

void compute_pca_basis(const float* vertices, std::size_t vertex_count, std::size_t dimension, float* out_basis) {
  compute_pca_basis_with_values(vertices, vertex_count, dimension, out_basis, nullptr);
}

}  // namespace ndvis
