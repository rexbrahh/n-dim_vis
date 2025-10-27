#ifndef NDCALC_API_H
#define NDCALC_API_H

#ifdef __cplusplus
extern "C" {
#endif

#include <stddef.h>
#include <stdint.h>

// Error codes
typedef enum {
    NDCALC_OK = 0,
    NDCALC_ERROR_PARSE = 1,
    NDCALC_ERROR_INVALID_EXPR = 2,
    NDCALC_ERROR_EVAL = 3,
    NDCALC_ERROR_OUT_OF_MEMORY = 4,
    NDCALC_ERROR_INVALID_DIMENSION = 5,
    NDCALC_ERROR_NULL_POINTER = 6
} ndcalc_error_t;

// Opaque handle types
typedef struct ndcalc_program_t* ndcalc_program_handle;
typedef struct ndcalc_context_t* ndcalc_context_handle;

// Context management
ndcalc_context_handle ndcalc_context_create(void);
void ndcalc_context_destroy(ndcalc_context_handle ctx);

// Program compilation
ndcalc_error_t ndcalc_compile(
    ndcalc_context_handle ctx,
    const char* expression,
    size_t num_variables,
    const char* const* variable_names,
    ndcalc_program_handle* out_program
);

void ndcalc_program_destroy(ndcalc_program_handle program);

// Evaluation
ndcalc_error_t ndcalc_eval(
    ndcalc_program_handle program,
    const double* inputs,
    size_t num_inputs,
    double* output
);

// Batch evaluation (SoA)
ndcalc_error_t ndcalc_eval_batch(
    ndcalc_program_handle program,
    const double* const* input_arrays,  // array of pointers to input arrays
    size_t num_variables,
    size_t num_points,
    double* output_array
);

// Gradient computation (forward-mode AD)
ndcalc_error_t ndcalc_gradient(
    ndcalc_program_handle program,
    const double* inputs,
    size_t num_inputs,
    double* gradient_out
);

// Hessian computation
ndcalc_error_t ndcalc_hessian(
    ndcalc_program_handle program,
    const double* inputs,
    size_t num_inputs,
    double* hessian_out  // row-major, size = num_inputs * num_inputs
);

// Finite-difference fallback configuration
typedef enum {
    NDCALC_AD_MODE_AUTO = 0,     // Use AD when possible, fallback to FD
    NDCALC_AD_MODE_FORWARD = 1,  // Force forward-mode AD
    NDCALC_AD_MODE_FINITE_DIFF = 2  // Force finite differences
} ndcalc_ad_mode_t;

void ndcalc_set_ad_mode(ndcalc_context_handle ctx, ndcalc_ad_mode_t mode);
void ndcalc_set_fd_epsilon(ndcalc_context_handle ctx, double epsilon);

// Error handling
const char* ndcalc_error_string(ndcalc_error_t error);
const char* ndcalc_get_last_error_message(ndcalc_context_handle ctx);

#ifdef __cplusplus
}
#endif

#endif // NDCALC_API_H
