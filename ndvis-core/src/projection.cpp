#include "ndvis/projection.hpp"

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

void project_to_3d(ConstBufferView vertices, std::size_t dimension, std::size_t vertex_count, const float* rotation_matrix,
                   std::size_t rotation_stride, ConstBasis3 basis, float* out_positions) {
  if (vertices.data == nullptr || rotation_matrix == nullptr || basis.data == nullptr || out_positions == nullptr) {
    return;
  }
  if (dimension == 0 || vertex_count == 0) {
    return;
  }
  if (vertices.length < dimension * vertex_count) {
    return;
  }
  if (basis.dimension != dimension || basis.stride < dimension) {
    return;
  }
  if (rotation_stride == 0) {
    rotation_stride = dimension;
  }

  AutoBuffer scratch(dimension);
  AutoBuffer rotated(dimension);

  for (std::size_t vertex = 0; vertex < vertex_count; ++vertex) {
    for (std::size_t axis = 0; axis < dimension; ++axis) {
      scratch.data[axis] = vertices.data[axis * vertex_count + vertex];
    }

    for (std::size_t row = 0; row < dimension; ++row) {
      float sum = 0.0f;
      const float* row_ptr = rotation_matrix + row * rotation_stride;
      for (std::size_t col = 0; col < dimension; ++col) {
        sum += row_ptr[col] * scratch.data[col];
      }
      rotated.data[row] = sum;
    }

    for (std::size_t component = 0; component < 3; ++component) {
      float sum = 0.0f;
      const float* basis_column = basis.data + component * basis.stride;
      for (std::size_t axis = 0; axis < dimension; ++axis) {
        sum += rotated.data[axis] * basis_column[axis];
      }
      out_positions[vertex * 3 + component] = sum;
    }
  }
}

}  // namespace ndvis
