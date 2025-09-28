#pragma once

#include <cstddef>

namespace ndvis {

using index_type = unsigned int;

struct BufferView {
  float* data{nullptr};
  std::size_t length{0};
};

struct ConstBufferView {
  const float* data{nullptr};
  std::size_t length{0};
};

struct IndexBufferView {
  index_type* data{nullptr};
  std::size_t length{0};
};

struct ConstIndexBufferView {
  const index_type* data{nullptr};
  std::size_t length{0};
};

struct Basis3 {
  float* data{nullptr};
  std::size_t stride{0};
  std::size_t dimension{0};
};

struct ConstBasis3 {
  const float* data{nullptr};
  std::size_t stride{0};
  std::size_t dimension{0};
};

}  // namespace ndvis
