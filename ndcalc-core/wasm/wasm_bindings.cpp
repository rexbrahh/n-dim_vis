#include "ndcalc/api.h"
#include <emscripten/emscripten.h>

// Export all C API functions for WASM
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
const char* wasm_error_string(ndcalc_error_t error) {
    return ndcalc_error_string(error);
}

EMSCRIPTEN_KEEPALIVE
const char* wasm_get_last_error_message(ndcalc_context_handle ctx) {
    return ndcalc_get_last_error_message(ctx);
}

} // extern "C"
