#include "ndcalc/api.h"
#include "ndcalc/latex.h"

#include <emscripten/emscripten.h>
#include <emscripten/bind.h>
#include <emscripten/val.h>

#include <cstdint>
#include <string>
#include <vector>

using emscripten::val;

// Export all C API functions for WASM (low-level access retained for compatibility)
extern "C" {

EMSCRIPTEN_KEEPALIVE
ndcalc_context_handle wasm_context_create() {
    return ndcalc_context_create();
}

EMSCRIPTEN_KEEPALIVE
void wasm_context_destroy(ndcalc_context_handle ctx) {
    ndcalc_context_destroy(ctx);
}

EMSCRIPTEN_KEEPALIVE
ndcalc_error_t wasm_compile(
    ndcalc_context_handle ctx,
    const char* expression,
    size_t num_variables,
    const char* const* variable_names,
    ndcalc_program_handle* out_program) {
    return ndcalc_compile(ctx, expression, num_variables, variable_names, out_program);
}

EMSCRIPTEN_KEEPALIVE
void wasm_program_destroy(ndcalc_program_handle program) {
    ndcalc_program_destroy(program);
}

EMSCRIPTEN_KEEPALIVE
ndcalc_error_t wasm_eval(
    ndcalc_program_handle program,
    const double* inputs,
    size_t num_inputs,
    double* output) {
    return ndcalc_eval(program, inputs, num_inputs, output);
}

EMSCRIPTEN_KEEPALIVE
ndcalc_error_t wasm_eval_batch(
    ndcalc_program_handle program,
    const double* const* input_arrays,
    size_t num_variables,
    size_t num_points,
    double* output_array) {
    return ndcalc_eval_batch(program, input_arrays, num_variables, num_points, output_array);
}

EMSCRIPTEN_KEEPALIVE
ndcalc_error_t wasm_gradient(
    ndcalc_program_handle program,
    const double* inputs,
    size_t num_inputs,
    double* gradient_out) {
    return ndcalc_gradient(program, inputs, num_inputs, gradient_out);
}

EMSCRIPTEN_KEEPALIVE
ndcalc_error_t wasm_hessian(
    ndcalc_program_handle program,
    const double* inputs,
    size_t num_inputs,
    double* hessian_out) {
    return ndcalc_hessian(program, inputs, num_inputs, hessian_out);
}

EMSCRIPTEN_KEEPALIVE
void wasm_set_ad_mode(ndcalc_context_handle ctx, ndcalc_ad_mode_t mode) {
    ndcalc_set_ad_mode(ctx, mode);
}

EMSCRIPTEN_KEEPALIVE
void wasm_set_fd_epsilon(ndcalc_context_handle ctx, double epsilon) {
    ndcalc_set_fd_epsilon(ctx, epsilon);
}

EMSCRIPTEN_KEEPALIVE
void wasm_program_set_ad_mode(ndcalc_program_handle program, ndcalc_ad_mode_t mode) {
    ndcalc_program_set_ad_mode(program, mode);
}

EMSCRIPTEN_KEEPALIVE
void wasm_program_set_fd_epsilon(ndcalc_program_handle program, double epsilon) {
    ndcalc_program_set_fd_epsilon(program, epsilon);
}

EMSCRIPTEN_KEEPALIVE
const char* wasm_error_string(ndcalc_error_t error) {
    return ndcalc_error_string(error);
}

EMSCRIPTEN_KEEPALIVE
const char* wasm_get_last_error_message(ndcalc_context_handle ctx) {
    return ndcalc_get_last_error_message(ctx);
}

EMSCRIPTEN_KEEPALIVE
ndcalc_latex_status_t wasm_latex_to_ascii(
    const char* src,
    ndcalc_owned_string* out_ascii,
    ndcalc_latex_error_t* out_error) {
    return ndcalc_latex_to_ascii(src, out_ascii, out_error);
}

EMSCRIPTEN_KEEPALIVE
ndcalc_latex_status_t wasm_latex_to_hyperplane(
    const char* src,
    size_t dimension,
    float** out_coefficients,
    size_t* out_count,
    double* out_offset,
    ndcalc_latex_error_t* out_error) {
    return ndcalc_latex_to_hyperplane(src, dimension, out_coefficients, out_count, out_offset, out_error);
}

EMSCRIPTEN_KEEPALIVE
ndcalc_latex_status_t wasm_latex_to_matrix(
    const char* src,
    double** out_values,
    size_t* out_rows,
    size_t* out_cols,
    ndcalc_latex_error_t* out_error) {
    return ndcalc_latex_to_matrix(src, out_values, out_rows, out_cols, out_error);
}

EMSCRIPTEN_KEEPALIVE
bool wasm_latex_validate_hyperplane(const float* coefficients, size_t count) {
    return ndcalc_latex_validate_hyperplane(coefficients, count);
}

EMSCRIPTEN_KEEPALIVE
ndcalc_latex_status_t wasm_latex_normalize_hyperplane(
    float* coefficients,
    size_t count,
    double* offset,
    ndcalc_latex_error_t* out_error) {
    return ndcalc_latex_normalize_hyperplane(coefficients, count, offset, out_error);
}

EMSCRIPTEN_KEEPALIVE
void wasm_latex_free_string(ndcalc_owned_string* str) {
    ndcalc_latex_free_string(str);
}

EMSCRIPTEN_KEEPALIVE
void wasm_latex_free_error(ndcalc_latex_error_t* err) {
    ndcalc_latex_free_error(err);
}

EMSCRIPTEN_KEEPALIVE
void wasm_latex_free_float_array(float* array) {
    ndcalc_latex_free_float_array(array);
}

EMSCRIPTEN_KEEPALIVE
void wasm_latex_free_double_array(double* array) {
    ndcalc_latex_free_double_array(array);
}

} // extern "C"

namespace {

inline ndcalc_context_handle to_context(uintptr_t value) {
    return reinterpret_cast<ndcalc_context_handle>(value);
}

inline ndcalc_program_handle to_program(uintptr_t value) {
    return reinterpret_cast<ndcalc_program_handle>(value);
}

inline uintptr_t from_context(ndcalc_context_handle ctx) {
    return reinterpret_cast<uintptr_t>(ctx);
}

inline uintptr_t from_program(ndcalc_program_handle program) {
    return reinterpret_cast<uintptr_t>(program);
}

val make_number_array(const std::vector<double>& values) {
    val array = val::array();
    for (size_t i = 0; i < values.size(); ++i) {
        array.set(i, values[i]);
    }
    return array;
}

val make_float_array(const std::vector<float>& values) {
    val array = val::array();
    for (size_t i = 0; i < values.size(); ++i) {
        array.set(i, values[i]);
    }
    return array;
}

val make_latex_error_object(const ndcalc_latex_error_t& err) {
    val obj = val::object();
    obj.set("status", static_cast<int>(err.status));
    obj.set("message", err.message ? std::string(err.message) : std::string());
    obj.set("start", static_cast<unsigned int>(err.start));
    obj.set("end", static_cast<unsigned int>(err.end));
    return obj;
}

} // namespace

uintptr_t context_create_binding() {
    return from_context(ndcalc_context_create());
}

void context_destroy_binding(uintptr_t ctx_value) {
    ndcalc_context_destroy(to_context(ctx_value));
}

val compile_binding(uintptr_t ctx_value, const std::string& expression, val variables_val) {
    ndcalc_context_handle ctx = to_context(ctx_value);
    std::vector<std::string> variables = emscripten::vecFromJSArray<std::string>(variables_val);
    std::vector<const char*> variable_ptrs;
    variable_ptrs.reserve(variables.size());
    for (const auto& v : variables) {
        variable_ptrs.push_back(v.c_str());
    }

    ndcalc_program_handle program = nullptr;
    ndcalc_error_t error = ndcalc_compile(
        ctx,
        expression.c_str(),
        variable_ptrs.size(),
        variable_ptrs.empty() ? nullptr : variable_ptrs.data(),
        &program
    );

    val result = val::object();
    result.set("error", static_cast<int>(error));
    if (error == NDCALC_OK) {
        result.set("program", from_program(program));
        result.set("message", std::string());
    } else {
        const char* message = ndcalc_get_last_error_message(ctx);
        result.set("program", val::null());
        result.set("message", message ? std::string(message) : std::string());
    }
    return result;
}

void program_destroy_binding(uintptr_t program_value) {
    ndcalc_program_destroy(to_program(program_value));
}

val eval_binding(uintptr_t program_value, val inputs_val) {
    ndcalc_program_handle program = to_program(program_value);
    std::vector<double> inputs = emscripten::vecFromJSArray<double>(inputs_val);
    double output = 0.0;
    ndcalc_error_t error = ndcalc_eval(program, inputs.data(), inputs.size(), &output);

    val result = val::object();
    result.set("error", static_cast<int>(error));
    result.set("value", output);
    return result;
}

val eval_batch_binding(uintptr_t program_value, val input_arrays_val) {
    ndcalc_program_handle program = to_program(program_value);
    const size_t num_variables = input_arrays_val["length"].as<size_t>();

    std::vector<std::vector<double>> inputs;
    inputs.reserve(num_variables);
    for (size_t i = 0; i < num_variables; ++i) {
        inputs.emplace_back(emscripten::vecFromJSArray<double>(input_arrays_val[i]));
    }

    size_t num_points = inputs.empty() ? 0 : inputs.front().size();
    std::vector<const double*> ptrs;
    ptrs.reserve(inputs.size());
    for (auto& vec : inputs) {
        ptrs.push_back(vec.data());
    }

    std::vector<double> outputs(num_points, 0.0);
    ndcalc_error_t error = ndcalc_eval_batch(
        program,
        ptrs.empty() ? nullptr : ptrs.data(),
        inputs.size(),
        num_points,
        outputs.empty() ? nullptr : outputs.data()
    );

    val result = val::object();
    result.set("error", static_cast<int>(error));
    result.set("values", make_number_array(outputs));
    return result;
}

val gradient_binding(uintptr_t program_value, val inputs_val) {
    ndcalc_program_handle program = to_program(program_value);
    std::vector<double> inputs = emscripten::vecFromJSArray<double>(inputs_val);
    std::vector<double> gradient(inputs.size(), 0.0);

    ndcalc_error_t error = ndcalc_gradient(
        program,
        inputs.data(),
        inputs.size(),
        gradient.data()
    );

    val result = val::object();
    result.set("error", static_cast<int>(error));
    result.set("gradient", make_number_array(gradient));
    return result;
}

val hessian_binding(uintptr_t program_value, val inputs_val) {
    ndcalc_program_handle program = to_program(program_value);
    std::vector<double> inputs = emscripten::vecFromJSArray<double>(inputs_val);
    const size_t dimension = inputs.size();
    std::vector<double> hessian(dimension * dimension, 0.0);

    ndcalc_error_t error = ndcalc_hessian(
        program,
        inputs.data(),
        inputs.size(),
        hessian.data()
    );

    val result = val::object();
    result.set("error", static_cast<int>(error));

    val matrix = val::array();
    for (size_t row = 0; row < dimension; ++row) {
        val row_values = val::array();
        for (size_t col = 0; col < dimension; ++col) {
            row_values.set(col, hessian[row * dimension + col]);
        }
        matrix.set(row, row_values);
    }
    result.set("hessian", matrix);
    return result;
}

void set_ad_mode_binding(uintptr_t ctx_value, int mode) {
    ndcalc_set_ad_mode(to_context(ctx_value), static_cast<ndcalc_ad_mode_t>(mode));
}

void set_fd_epsilon_binding(uintptr_t ctx_value, double epsilon) {
    ndcalc_set_fd_epsilon(to_context(ctx_value), epsilon);
}

void program_set_ad_mode_binding(uintptr_t program_value, int mode) {
    ndcalc_program_set_ad_mode(to_program(program_value), static_cast<ndcalc_ad_mode_t>(mode));
}

void program_set_fd_epsilon_binding(uintptr_t program_value, double epsilon) {
    ndcalc_program_set_fd_epsilon(to_program(program_value), epsilon);
}

std::string error_string_binding(int error) {
    return ndcalc_error_string(static_cast<ndcalc_error_t>(error));
}

std::string get_last_error_binding(uintptr_t ctx_value) {
    const char* message = ndcalc_get_last_error_message(to_context(ctx_value));
    return message ? std::string(message) : std::string();
}

val latex_to_ascii_binding(const std::string& src) {
    ndcalc_owned_string ascii{};
    ndcalc_latex_error_t error{};
    ndcalc_latex_status_t status = ndcalc_latex_to_ascii(src.c_str(), &ascii, &error);

    val result = val::object();
    result.set("status", static_cast<int>(status));
    if (status == NDCALC_LATEX_OK && ascii.data) {
        result.set("value", std::string(ascii.data, ascii.length));
        result.set("error", val::undefined());
    } else {
        result.set("value", val::undefined());
        result.set("error", make_latex_error_object(error));
    }

    ndcalc_latex_free_string(&ascii);
    ndcalc_latex_free_error(&error);
    return result;
}

val latex_to_hyperplane_binding(const std::string& src, std::size_t dimension) {
    float* coefficients = nullptr;
    size_t count = 0;
    double offset = 0.0;
    ndcalc_latex_error_t error{};

    ndcalc_latex_status_t status = ndcalc_latex_to_hyperplane(
        src.c_str(),
        dimension,
        &coefficients,
        &count,
        &offset,
        &error
    );

    val result = val::object();
    result.set("status", static_cast<int>(status));
    if (status == NDCALC_LATEX_OK && coefficients) {
        std::vector<float> coeff_vec(coefficients, coefficients + count);
        result.set("coefficients", make_float_array(coeff_vec));
        result.set("offset", offset);
        result.set("error", val::undefined());
    } else {
        result.set("coefficients", val::undefined());
        result.set("offset", val::undefined());
        result.set("error", make_latex_error_object(error));
    }

    ndcalc_latex_free_float_array(coefficients);
    ndcalc_latex_free_error(&error);
    return result;
}

val latex_to_matrix_binding(const std::string& src) {
    double* values = nullptr;
    size_t rows = 0;
    size_t cols = 0;
    ndcalc_latex_error_t error{};

    ndcalc_latex_status_t status = ndcalc_latex_to_matrix(
        src.c_str(),
        &values,
        &rows,
        &cols,
        &error
    );

    val result = val::object();
    result.set("status", static_cast<int>(status));
    if (status == NDCALC_LATEX_OK && values) {
        val matrix = val::array();
        for (size_t r = 0; r < rows; ++r) {
            val row_values = val::array();
            for (size_t c = 0; c < cols; ++c) {
                row_values.set(c, values[r * cols + c]);
            }
            matrix.set(r, row_values);
        }
        result.set("matrix", matrix);
        result.set("error", val::undefined());
    } else {
        result.set("matrix", val::undefined());
        result.set("error", make_latex_error_object(error));
    }

    ndcalc_latex_free_double_array(values);
    ndcalc_latex_free_error(&error);
    return result;
}

bool validate_hyperplane_binding(val coefficients_val) {
    std::vector<float> coefficients = emscripten::vecFromJSArray<float>(coefficients_val);
    return ndcalc_latex_validate_hyperplane(coefficients.data(), coefficients.size());
}

val normalize_hyperplane_binding(val coefficients_val, double offset) {
    std::vector<float> coefficients = emscripten::vecFromJSArray<float>(coefficients_val);
    ndcalc_latex_error_t error{};
    ndcalc_latex_status_t status = ndcalc_latex_normalize_hyperplane(
        coefficients.data(),
        coefficients.size(),
        &offset,
        &error
    );

    val result = val::object();
    result.set("status", static_cast<int>(status));
    if (status == NDCALC_LATEX_OK) {
        result.set("coefficients", make_float_array(coefficients));
        result.set("offset", offset);
        result.set("error", val::undefined());
    } else {
        result.set("coefficients", val::undefined());
        result.set("offset", val::undefined());
        result.set("error", make_latex_error_object(error));
    }

    ndcalc_latex_free_error(&error);
    return result;
}

EMSCRIPTEN_BINDINGS(ndcalc_module_bindings) {
    emscripten::function("contextCreate", &context_create_binding);
    emscripten::function("contextDestroy", &context_destroy_binding);
    emscripten::function("compile", &compile_binding);
    emscripten::function("programDestroy", &program_destroy_binding);
    emscripten::function("eval", &eval_binding);
    emscripten::function("evalBatch", &eval_batch_binding);
    emscripten::function("gradient", &gradient_binding);
    emscripten::function("hessian", &hessian_binding);
    emscripten::function("setADMode", &set_ad_mode_binding);
    emscripten::function("setFDEpsilon", &set_fd_epsilon_binding);
    emscripten::function("programSetADMode", &program_set_ad_mode_binding);
    emscripten::function("programSetFDEpsilon", &program_set_fd_epsilon_binding);
    emscripten::function("errorString", &error_string_binding);
    emscripten::function("getLastErrorMessage", &get_last_error_binding);

    emscripten::function("latexToAscii", &latex_to_ascii_binding);
    emscripten::function("latexToHyperplane", &latex_to_hyperplane_binding);
    emscripten::function("latexToMatrix", &latex_to_matrix_binding);
    emscripten::function("validateHyperplane", &validate_hyperplane_binding);
    emscripten::function("normalizeHyperplane", &normalize_hyperplane_binding);
}

