#include "ndvis/overlays.hpp"

#include <algorithm>
#include <array>
#include <cmath>
#include <limits>
#include <string>
#include <vector>

#include "ndcalc/api.h"
#include "ndvis/hyperplane.hpp"

namespace ndvis {
namespace {

constexpr float kIntersectionEpsilon = 1e-6f;
constexpr float kGradientEpsilon = 1e-6f;
constexpr float kTangentExtent = 0.5f;

struct ContextGuard {
  ndcalc_context_handle handle;
  ~ContextGuard() {
    if (handle) {
      ndcalc_context_destroy(handle);
    }
  }
};

struct ProgramGuard {
  ndcalc_program_handle handle;
  ~ProgramGuard() {
    if (handle) {
      ndcalc_program_destroy(handle);
    }
  }
};

void project_point(const GeometryInputs& geometry, const float* point, float* out3) {
  const std::size_t dimension = geometry.dimension;
  std::vector<float> rotated(dimension, 0.0f);

  for (std::size_t row = 0; row < dimension; ++row) {
    float sum = 0.0f;
    const float* row_ptr = geometry.rotation_matrix + row * dimension;
    for (std::size_t col = 0; col < dimension; ++col) {
      sum += row_ptr[col] * point[col];
    }
    rotated[row] = sum;
  }

  for (std::size_t component = 0; component < 3; ++component) {
    float sum = 0.0f;
    const float* basis_col = geometry.basis3 + component * dimension;
    for (std::size_t axis = 0; axis < dimension; ++axis) {
      sum += rotated[axis] * basis_col[axis];
    }
    out3[component] = sum;
  }
}

void project_vertices(const GeometryInputs& geometry, float* out_positions) {
  const std::size_t dimension = geometry.dimension;
  std::vector<float> scratch(dimension, 0.0f);

  for (std::size_t vertex = 0; vertex < geometry.vertex_count; ++vertex) {
    for (std::size_t axis = 0; axis < dimension; ++axis) {
      scratch[axis] = geometry.vertices[axis * geometry.vertex_count + vertex];
    }
    project_point(geometry, scratch.data(), out_positions + vertex * 3);
  }
}

OverlayResult compute_slice(
    const GeometryInputs& geometry,
    const HyperplaneInputs& hyperplane,
    float* out_positions,
    std::size_t capacity,
    std::size_t* out_count) {
  if (!hyperplane.enabled || hyperplane.coefficients == nullptr) {
    *out_count = 0;
    return OverlayResult::kSuccess;
  }

  const std::size_t dimension = geometry.dimension;
  std::vector<float> vertex_a(dimension);
  std::vector<float> vertex_b(dimension);
  std::vector<float> intersection(dimension);

  std::size_t count = 0;
  for (std::size_t edge = 0; edge < geometry.edge_count; ++edge) {
    const unsigned int v0 = geometry.edges[edge * 2];
    const unsigned int v1 = geometry.edges[edge * 2 + 1];

    for (std::size_t axis = 0; axis < dimension; ++axis) {
      vertex_a[axis] = geometry.vertices[axis * geometry.vertex_count + v0];
      vertex_b[axis] = geometry.vertices[axis * geometry.vertex_count + v1];
    }

    float dot_a = 0.0f;
    float dot_b = 0.0f;
    for (std::size_t axis = 0; axis < dimension; ++axis) {
      dot_a += hyperplane.coefficients[axis] * vertex_a[axis];
      dot_b += hyperplane.coefficients[axis] * vertex_b[axis];
    }
    dot_a -= hyperplane.offset;
    dot_b -= hyperplane.offset;

    if (dot_a == 0.0f && dot_b == 0.0f) {
      continue;
    }
    if (!(dot_a == 0.0f || dot_b == 0.0f || dot_a * dot_b < 0.0f)) {
      continue;
    }

    if (count >= capacity) {
      break;
    }

    const float denom = dot_a - dot_b;
    const float t = std::fabs(denom) > kIntersectionEpsilon ? dot_a / denom : 0.0f;

    for (std::size_t axis = 0; axis < dimension; ++axis) {
      intersection[axis] = vertex_a[axis] + t * (vertex_b[axis] - vertex_a[axis]);
    }

    project_point(geometry, intersection.data(), out_positions + count * 3);
    ++count;
  }

  *out_count = count;
  return OverlayResult::kSuccess;
}

bool normalize(std::vector<float>& values) {
  float norm_sq = 0.0f;
  for (float v : values) {
    norm_sq += v * v;
  }
  if (norm_sq <= kGradientEpsilon * kGradientEpsilon) {
    return false;
  }
  const float norm = std::sqrt(norm_sq);
  for (float& v : values) {
    v /= norm;
  }
  return true;
}

void project_probe_and_gradient(
    const GeometryInputs& geometry,
    const std::vector<float>& probe,
    const std::vector<float>& gradient,
    float gradient_scale,
    float* out_positions) {
  std::vector<float> end_point(probe);
  for (std::size_t axis = 0; axis < geometry.dimension; ++axis) {
    end_point[axis] += gradient[axis] * gradient_scale;
  }

  project_point(geometry, probe.data(), out_positions);
  project_point(geometry, end_point.data(), out_positions + 3);
}

bool build_tangent_basis(
    const std::vector<float>& gradient,
    std::vector<float>& tangent_u,
    std::vector<float>& tangent_v) {
  const std::size_t dimension = gradient.size();
  if (dimension < 2) {
    return false;
  }

  tangent_u.assign(dimension, 0.0f);
  tangent_v.assign(dimension, 0.0f);

  std::size_t weakest_axis = 0;
  for (std::size_t axis = 1; axis < dimension; ++axis) {
    if (std::fabs(gradient[axis]) < std::fabs(gradient[weakest_axis])) {
      weakest_axis = axis;
    }
  }
  tangent_u[weakest_axis] = 1.0f;

  const float dot_gu = gradient[weakest_axis];
  for (std::size_t axis = 0; axis < dimension; ++axis) {
    tangent_u[axis] -= dot_gu * gradient[axis];
  }
  if (!normalize(tangent_u)) {
    return false;
  }

  const std::size_t second_axis = (weakest_axis + 1) % dimension;
  tangent_v[second_axis] = 1.0f;
  const float dot_gv = gradient[second_axis];
  for (std::size_t axis = 0; axis < dimension; ++axis) {
    tangent_v[axis] -= dot_gv * gradient[axis];
  }
  float dot_uv = 0.0f;
  for (std::size_t axis = 0; axis < dimension; ++axis) {
    dot_uv += tangent_u[axis] * tangent_v[axis];
  }
  for (std::size_t axis = 0; axis < dimension; ++axis) {
    tangent_v[axis] -= dot_uv * tangent_u[axis];
  }
  return normalize(tangent_v);
}

void write_tangent_patch(
    const GeometryInputs& geometry,
    const std::vector<float>& probe,
    const std::vector<float>& tangent_u,
    const std::vector<float>& tangent_v,
    float* out_positions) {
  const std::array<std::array<float, 2>, 4> corners = {{{+kTangentExtent, +kTangentExtent},
                                                        {-kTangentExtent, +kTangentExtent},
                                                        {-kTangentExtent, -kTangentExtent},
                                                        {+kTangentExtent, -kTangentExtent}}};

  std::vector<float> nd_point(probe.size(), 0.0f);
  float* cursor = out_positions;
  for (const auto& corner : corners) {
    const float u = corner[0];
    const float v = corner[1];
    for (std::size_t axis = 0; axis < probe.size(); ++axis) {
      nd_point[axis] = probe[axis] + u * tangent_u[axis] + v * tangent_v[axis];
    }
    project_point(geometry, nd_point.data(), cursor);
    cursor += 3;
  }
}

}  // namespace

OverlayResult compute_overlays(
    const GeometryInputs& geometry,
    const HyperplaneInputs& hyperplane,
    const CalculusInputs& calculus,
    OverlayBuffers& buffers) {
  if (buffers.projected_vertices) {
    project_vertices(geometry, buffers.projected_vertices);
  }

  if (buffers.slice_positions && buffers.slice_count) {
    auto slice_status = compute_slice(geometry, hyperplane, buffers.slice_positions, buffers.slice_capacity, buffers.slice_count);
    if (slice_status != OverlayResult::kSuccess) {
      return slice_status;
    }
  }

  const bool wants_gradient = calculus.show_gradient && buffers.gradient_positions;
  const bool wants_tangent = calculus.show_tangent_plane && buffers.tangent_patch_positions;
  const bool wants_level_sets =
      calculus.show_level_sets && calculus.level_set_values && calculus.level_set_count > 0 &&
      buffers.level_set_curves && buffers.level_set_sizes && buffers.level_set_count;

  if (!wants_gradient && !wants_tangent && !wants_level_sets) {
    return OverlayResult::kSuccess;
  }

  if ((wants_gradient || wants_tangent) && !calculus.probe_point) {
    return OverlayResult::kInvalidInputs;
  }

  if (wants_level_sets) {
    if (buffers.level_set_capacity < calculus.level_set_count) {
      return OverlayResult::kNullBuffer;
    }
    *buffers.level_set_count = 0;
  }

  if (!calculus.expression_utf8 || calculus.expression_length == 0) {
    return OverlayResult::kInvalidInputs;
  }

  std::string expression(calculus.expression_utf8, calculus.expression_length);
  std::vector<std::string> variable_names;
  variable_names.reserve(geometry.dimension);
  std::vector<const char*> variable_ptrs;
  variable_ptrs.reserve(geometry.dimension);
  for (std::size_t axis = 0; axis < geometry.dimension; ++axis) {
    variable_names.emplace_back("x" + std::to_string(axis + 1));
    variable_ptrs.push_back(variable_names.back().c_str());
  }

  ContextGuard context{ndcalc_context_create()};
  if (!context.handle) {
    return OverlayResult::kEvalError;
  }

  ndcalc_set_ad_mode(context.handle, NDCALC_AD_MODE_FORWARD);

  ndcalc_program_handle compiled_program = nullptr;
  ndcalc_error_t compile_error = ndcalc_compile(
      context.handle,
      expression.c_str(),
      geometry.dimension,
      variable_ptrs.data(),
      &compiled_program);
  if (compile_error != NDCALC_OK || compiled_program == nullptr) {
    return OverlayResult::kEvalError;
  }

  ProgramGuard program{compiled_program};

  std::vector<float> probe;
  if (calculus.probe_point) {
    probe.assign(calculus.probe_point, calculus.probe_point + geometry.dimension);
  }

  std::vector<float> unit_gradient;
  if (wants_gradient || wants_tangent) {
    std::vector<double> probe_double(geometry.dimension, 0.0);
    for (std::size_t axis = 0; axis < geometry.dimension; ++axis) {
      probe_double[axis] = calculus.probe_point ? static_cast<double>(calculus.probe_point[axis]) : 0.0;
    }

    std::vector<double> gradient_double(geometry.dimension, 0.0);
    ndcalc_error_t gradient_error = ndcalc_gradient(
        program.handle,
        probe_double.data(),
        geometry.dimension,
        gradient_double.data());
    if (gradient_error != NDCALC_OK) {
      return OverlayResult::kGradientError;
    }

    unit_gradient.resize(geometry.dimension, 0.0f);
    for (std::size_t axis = 0; axis < geometry.dimension; ++axis) {
      unit_gradient[axis] = static_cast<float>(gradient_double[axis]);
    }
    if (!normalize(unit_gradient)) {
      return OverlayResult::kGradientError;
    }
  }

  if (wants_gradient) {
    project_probe_and_gradient(geometry, probe, unit_gradient, calculus.gradient_scale, buffers.gradient_positions);
  }

  if (wants_tangent) {
    std::vector<float> tangent_u;
    std::vector<float> tangent_v;
    if (!build_tangent_basis(unit_gradient, tangent_u, tangent_v)) {
      return OverlayResult::kGradientError;
    }
    write_tangent_patch(geometry, probe, tangent_u, tangent_v, buffers.tangent_patch_positions);
  }

  if (wants_level_sets) {
    const std::size_t max_levels = calculus.level_set_count;
    std::vector<double> inputs(geometry.dimension, 0.0);
    std::vector<double> vertex_values(geometry.vertex_count, 0.0);

    for (std::size_t vertex = 0; vertex < geometry.vertex_count; ++vertex) {
      for (std::size_t axis = 0; axis < geometry.dimension; ++axis) {
        inputs[axis] = static_cast<double>(geometry.vertices[axis * geometry.vertex_count + vertex]);
      }
      ndcalc_error_t eval_error = ndcalc_eval(
          program.handle,
          inputs.data(),
          geometry.dimension,
          &vertex_values[vertex]);
      if (eval_error != NDCALC_OK) {
        return OverlayResult::kEvalError;
      }
    }

    std::vector<float> intersection(geometry.dimension, 0.0f);

    for (std::size_t level_index = 0; level_index < max_levels; ++level_index) {
      float* curve_ptr = buffers.level_set_curves[level_index];
      if (curve_ptr == nullptr) {
        return OverlayResult::kNullBuffer;
      }

      std::vector<float> segments;
      segments.reserve(geometry.edge_count * 3);

      const double target = static_cast<double>(calculus.level_set_values[level_index]);
      for (std::size_t edge = 0; edge < geometry.edge_count; ++edge) {
        const unsigned int v0 = geometry.edges[edge * 2];
        const unsigned int v1 = geometry.edges[edge * 2 + 1];

        const double f0 = vertex_values[v0] - target;
        const double f1 = vertex_values[v1] - target;

        if (f0 == 0.0 && f1 == 0.0) {
          continue;
        }
        if (!(f0 == 0.0 || f1 == 0.0 || f0 * f1 < 0.0)) {
          continue;
        }

        const double denom = f0 - f1;
        const double t = std::fabs(denom) > static_cast<double>(kIntersectionEpsilon)
                             ? f0 / denom
                             : 0.0;

        for (std::size_t axis = 0; axis < geometry.dimension; ++axis) {
          const float value_a = geometry.vertices[axis * geometry.vertex_count + v0];
          const float value_b = geometry.vertices[axis * geometry.vertex_count + v1];
          intersection[axis] = value_a + static_cast<float>(t) * (value_b - value_a);
        }

        float projected[3];
        project_point(geometry, intersection.data(), projected);
        segments.push_back(projected[0]);
        segments.push_back(projected[1]);
        segments.push_back(projected[2]);
      }

      if (segments.empty()) {
        buffers.level_set_sizes[level_index] = 0;
        continue;
      }

      const std::size_t buffer_capacity = buffers.level_set_sizes[level_index];
      if (buffer_capacity < segments.size()) {
        return OverlayResult::kNullBuffer;
      }

      std::copy(segments.begin(), segments.end(), curve_ptr);
      buffers.level_set_sizes[level_index] = segments.size();
      (*buffers.level_set_count)++;
    }
  }

  return OverlayResult::kSuccess;
}

}  // namespace ndvis
