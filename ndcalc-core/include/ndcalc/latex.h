#ifndef NDCALC_LATEX_H
#define NDCALC_LATEX_H

#ifdef __cplusplus
extern "C" {
#endif

#include <stddef.h>
#include <stdbool.h>

// Status codes for LaTeX translation operations
typedef enum {
    NDCALC_LATEX_OK = 0,
    NDCALC_LATEX_ERROR_MAX_LENGTH = 1,
    NDCALC_LATEX_ERROR_PARSE = 2,
    NDCALC_LATEX_ERROR_NONLINEAR = 3,
    NDCALC_LATEX_ERROR_DIMENSION = 4,
    NDCALC_LATEX_ERROR_INVALID_INPUT = 5,
    NDCALC_LATEX_ERROR_EMPTY = 6,
    NDCALC_LATEX_ERROR_INTERNAL = 7
} ndcalc_latex_status_t;

// Structured error returned by LaTeX helpers
typedef struct {
    ndcalc_latex_status_t status;
    char* message;
    size_t start;
    size_t end;
} ndcalc_latex_error_t;

// Owned UTF-8 string container
typedef struct {
    char* data;
    size_t length;
} ndcalc_owned_string;

// Converts LaTeX expression to ASCII representation understood by ndcalc VM
ndcalc_latex_status_t ndcalc_latex_to_ascii(
    const char* src,
    ndcalc_owned_string* out_ascii,
    ndcalc_latex_error_t* out_error
);

// Parses linear equation into hyperplane coefficients (Float32) and offset
ndcalc_latex_status_t ndcalc_latex_to_hyperplane(
    const char* src,
    size_t dimension,
    float** out_coefficients,
    size_t* out_count,
    double* out_offset,
    ndcalc_latex_error_t* out_error
);

// Parses LaTeX bmatrix into row-major matrix (double values)
ndcalc_latex_status_t ndcalc_latex_to_matrix(
    const char* src,
    double** out_values,
    size_t* out_rows,
    size_t* out_cols,
    ndcalc_latex_error_t* out_error
);

// Validates hyperplane coefficients (non-zero normal vector)
bool ndcalc_latex_validate_hyperplane(const float* coefficients, size_t count);

// Normalizes hyperplane coefficients to unit vector; updates offset accordingly
ndcalc_latex_status_t ndcalc_latex_normalize_hyperplane(
    float* coefficients,
    size_t count,
    double* offset,
    ndcalc_latex_error_t* out_error
);

// Resource cleanup helpers
void ndcalc_latex_free_string(ndcalc_owned_string* str);
void ndcalc_latex_free_error(ndcalc_latex_error_t* err);
void ndcalc_latex_free_float_array(float* array);
void ndcalc_latex_free_double_array(double* array);

#ifdef __cplusplus
}
#endif

#endif // NDCALC_LATEX_H
