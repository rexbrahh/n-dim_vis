#include "ndvis/qr.hpp"

#include <cstddef>

namespace ndvis {

namespace {
struct AutoBuffer {
  AutoBuffer(std::size_t size) : data(size ? new float[size] : nullptr), length(size) {}
  ~AutoBuffer() { delete[] data; }
  float* data;
  std::size_t length;
};
}  // namespace

void reorthonormalize(float* matrix, std::size_t order) {
  if (matrix == nullptr || order == 0) {
    return;
  }

  AutoBuffer column(order);

  for (std::size_t col = 0; col < order; ++col) {
    for (std::size_t row = 0; row < order; ++row) {
      column.data[row] = matrix[row * order + col];
    }

    for (std::size_t prev = 0; prev < col; ++prev) {
      float dot = 0.0f;
      for (std::size_t row = 0; row < order; ++row) {
        dot += matrix[row * order + prev] * column.data[row];
      }
      for (std::size_t row = 0; row < order; ++row) {
        column.data[row] -= dot * matrix[row * order + prev];
      }
    }

    float norm = 0.0f;
    for (std::size_t row = 0; row < order; ++row) {
      const float value = column.data[row];
      norm += value * value;
    }

    if (norm <= 0.0f) {
      for (std::size_t row = 0; row < order; ++row) {
        column.data[row] = (row == col) ? 1.0f : 0.0f;
      }
      norm = 1.0f;
    }

    const float inv_norm = 1.0f / static_cast<float>(__builtin_sqrtf(norm));
    for (std::size_t row = 0; row < order; ++row) {
      matrix[row * order + col] = column.data[row] * inv_norm;
    }
  }
}

}  // namespace ndvis
