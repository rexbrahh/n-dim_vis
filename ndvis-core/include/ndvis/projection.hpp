#pragma once

#include <cstddef>

#include "ndvis/types.hpp"

namespace ndvis {

void project_to_3d(ConstBufferView vertices, std::size_t dimension, std::size_t vertex_count, const float* rotation_matrix,
                   std::size_t rotation_stride, ConstBasis3 basis, float* out_positions);

}  // namespace ndvis
