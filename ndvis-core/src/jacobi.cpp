#include "ndvis/detail/jacobi.hpp"

namespace ndvis::detail {

namespace {

double absolute(double value) {
  return value < 0.0 ? -value : value;
}

void set_identity(double* matrix, std::size_t order) {
  for (std::size_t r = 0; r < order; ++r) {
    for (std::size_t c = 0; c < order; ++c) {
      matrix[r * order + c] = (r == c) ? 1.0 : 0.0;
    }
  }
}

}  // namespace

void jacobi_symmetric(double* matrix, double* eigenvectors, std::size_t order, const JacobiParams& params) {
  if (matrix == nullptr || eigenvectors == nullptr || order == 0) {
    return;
  }

  set_identity(eigenvectors, order);
  if (order <= 1) {
    return;
  }

  for (std::size_t sweep = 0; sweep < params.max_sweeps; ++sweep) {
    double max_off = 0.0;
    std::size_t p = 0;
    std::size_t q = 1;
    for (std::size_t i = 0; i < order; ++i) {
      for (std::size_t j = i + 1; j < order; ++j) {
        double value = absolute(matrix[i * order + j]);
        if (value > max_off) {
          max_off = value;
          p = i;
          q = j;
        }
      }
    }

    if (max_off < params.tolerance) {
      break;
    }

    const double app = matrix[p * order + p];
    const double aqq = matrix[q * order + q];
    const double apq = matrix[p * order + q];

    const double tau = (aqq - app) / (2.0 * apq);
    const double t = (tau >= 0.0 ? 1.0 : -1.0) / (absolute(tau) + __builtin_sqrt(1.0 + tau * tau));
    const double c = 1.0 / __builtin_sqrt(1.0 + t * t);
    const double s = t * c;

    matrix[p * order + p] = app - t * apq;
    matrix[q * order + q] = aqq + t * apq;
    matrix[p * order + q] = 0.0;
    matrix[q * order + p] = 0.0;

    for (std::size_t k = 0; k < order; ++k) {
      if (k == p || k == q) {
        continue;
      }
      const double aip = matrix[p * order + k];
      const double aiq = matrix[q * order + k];
      matrix[p * order + k] = c * aip - s * aiq;
      matrix[k * order + p] = matrix[p * order + k];
      matrix[q * order + k] = s * aip + c * aiq;
      matrix[k * order + q] = matrix[q * order + k];
    }

    for (std::size_t k = 0; k < order; ++k) {
      const double vip = eigenvectors[k * order + p];
      const double viq = eigenvectors[k * order + q];
      eigenvectors[k * order + p] = c * vip - s * viq;
      eigenvectors[k * order + q] = s * vip + c * viq;
    }
  }
}

void sort_eigenpairs(double* eigenvalues, double* eigenvectors, std::size_t order) {
  if (eigenvalues == nullptr || eigenvectors == nullptr || order == 0) {
    return;
  }

  for (std::size_t i = 0; i < order; ++i) {
    std::size_t max_index = i;
    for (std::size_t j = i + 1; j < order; ++j) {
      if (eigenvalues[j] > eigenvalues[max_index]) {
        max_index = j;
      }
    }
    if (max_index != i) {
      const double lambda = eigenvalues[i];
      eigenvalues[i] = eigenvalues[max_index];
      eigenvalues[max_index] = lambda;
      for (std::size_t row = 0; row < order; ++row) {
        const double tmp = eigenvectors[row * order + i];
        eigenvectors[row * order + i] = eigenvectors[row * order + max_index];
        eigenvectors[row * order + max_index] = tmp;
      }
    }
  }
}

}  // namespace ndvis::detail

