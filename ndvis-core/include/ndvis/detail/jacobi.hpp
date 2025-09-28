#pragma once

#include <cstddef>

namespace ndvis::detail {

struct JacobiParams {
  // Maximum number of sweeps to perform; higher values improve convergence on ill-conditioned matrices.
  std::size_t max_sweeps{32};
  // Absolute tolerance for stopping once all off-diagonal elements fall below this threshold.
  double tolerance{1.0e-10};
};

void jacobi_symmetric(double* matrix, double* eigenvectors, std::size_t order, const JacobiParams& params);
void sort_eigenpairs(double* eigenvalues, double* eigenvectors, std::size_t order);

}  // namespace ndvis::detail

