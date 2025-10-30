#include "ndcalc/api.h"
#include "ndcalc/parser.h"
#include "ndcalc/compiler.h"
#include "ndcalc/bytecode.h"
#include "ndcalc/vm.h"
#include "ndcalc/autodiff.h"
#include "ndcalc/finite_diff.h"
#include <memory>
#include <string>
#include <vector>

struct ndcalc_context_t {
    std::string last_error;
    ndcalc_ad_mode_t ad_mode;
    double fd_epsilon;

    ndcalc_context_t()
        : ad_mode(NDCALC_AD_MODE_AUTO), fd_epsilon(1e-8) {}
};

struct ndcalc_program_t {
    std::unique_ptr<ndcalc::BytecodeProgram> bytecode;
    ndcalc::VM vm;
    ndcalc::AutoDiff autodiff;
    ndcalc::FiniteDiff finite_diff;
    ndcalc_ad_mode_t ad_mode;

    ndcalc_program_t() : finite_diff(1e-8), ad_mode(NDCALC_AD_MODE_AUTO) {}
};

// Context management
ndcalc_context_handle ndcalc_context_create(void) {
    return new ndcalc_context_t();
}

void ndcalc_context_destroy(ndcalc_context_handle ctx) {
    delete ctx;
}

// Program compilation
ndcalc_error_t ndcalc_compile(
    ndcalc_context_handle ctx,
    const char* expression,
    size_t num_variables,
    const char* const* variable_names,
    ndcalc_program_handle* out_program) {

    if (!ctx || !expression || !variable_names || !out_program) {
        if (ctx) ctx->last_error = "Null pointer argument";
        return NDCALC_ERROR_NULL_POINTER;
    }

    try {
        // Parse expression
        ndcalc::Parser parser;
        std::vector<std::string> vars;
        for (size_t i = 0; i < num_variables; ++i) {
            vars.push_back(variable_names[i]);
        }

        auto ast = parser.parse(expression, vars);
        if (!ast) {
            ctx->last_error = parser.get_error();
            return NDCALC_ERROR_PARSE;
        }

        // Compile to bytecode
        ndcalc::Compiler compiler;
        auto bytecode = compiler.compile(*ast);
        if (!bytecode) {
            ctx->last_error = compiler.get_error();
            return NDCALC_ERROR_INVALID_EXPR;
        }

        bytecode->set_num_variables(num_variables);

        // Create program with context settings
        auto program = new ndcalc_program_t();
        program->bytecode = std::move(bytecode);
        program->finite_diff.set_epsilon(ctx->fd_epsilon);
        program->ad_mode = ctx->ad_mode;

        *out_program = program;
        return NDCALC_OK;

    } catch (const std::exception& e) {
        ctx->last_error = e.what();
        return NDCALC_ERROR_INVALID_EXPR;
    }
}

void ndcalc_program_destroy(ndcalc_program_handle program) {
    delete program;
}

// Evaluation
ndcalc_error_t ndcalc_eval(
    ndcalc_program_handle program,
    const double* inputs,
    size_t num_inputs,
    double* output) {

    if (!program || !inputs || !output) {
        return NDCALC_ERROR_NULL_POINTER;
    }

    if (!program->vm.execute(*program->bytecode, inputs, num_inputs, *output)) {
        return NDCALC_ERROR_EVAL;
    }

    return NDCALC_OK;
}

// Batch evaluation
ndcalc_error_t ndcalc_eval_batch(
    ndcalc_program_handle program,
    const double* const* input_arrays,
    size_t num_variables,
    size_t num_points,
    double* output_array) {

    if (!program || !input_arrays || !output_array) {
        return NDCALC_ERROR_NULL_POINTER;
    }

    if (!program->vm.execute_batch(*program->bytecode, input_arrays,
                                    num_variables, num_points, output_array)) {
        return NDCALC_ERROR_EVAL;
    }

    return NDCALC_OK;
}

// Gradient computation
ndcalc_error_t ndcalc_gradient(
    ndcalc_program_handle program,
    const double* inputs,
    size_t num_inputs,
    double* gradient_out) {

    if (!program || !inputs || !gradient_out) {
        return NDCALC_ERROR_NULL_POINTER;
    }

    // Honor AD mode setting
    switch (program->ad_mode) {
        case NDCALC_AD_MODE_FORWARD:
            // Force forward-mode AD
            if (program->autodiff.compute_gradient(*program->bytecode, inputs,
                                                    num_inputs, gradient_out)) {
                return NDCALC_OK;
            }
            return NDCALC_ERROR_EVAL;

        case NDCALC_AD_MODE_FINITE_DIFF:
            // Force finite differences
            if (program->finite_diff.compute_gradient(*program->bytecode, program->vm,
                                                       inputs, num_inputs, gradient_out)) {
                return NDCALC_OK;
            }
            return NDCALC_ERROR_EVAL;

        case NDCALC_AD_MODE_AUTO:
        default:
            // Try AD first, fallback to FD
            if (program->autodiff.compute_gradient(*program->bytecode, inputs,
                                                    num_inputs, gradient_out)) {
                return NDCALC_OK;
            }
            if (program->finite_diff.compute_gradient(*program->bytecode, program->vm,
                                                       inputs, num_inputs, gradient_out)) {
                return NDCALC_OK;
            }
            return NDCALC_ERROR_EVAL;
    }
}

// Hessian computation
ndcalc_error_t ndcalc_hessian(
    ndcalc_program_handle program,
    const double* inputs,
    size_t num_inputs,
    double* hessian_out) {

    if (!program || !inputs || !hessian_out) {
        return NDCALC_ERROR_NULL_POINTER;
    }

    // Honor AD mode setting
    switch (program->ad_mode) {
        case NDCALC_AD_MODE_FORWARD:
            // Force forward-mode AD (uses FD on gradient)
            if (program->autodiff.compute_hessian(*program->bytecode, inputs,
                                                   num_inputs, hessian_out)) {
                return NDCALC_OK;
            }
            return NDCALC_ERROR_EVAL;

        case NDCALC_AD_MODE_FINITE_DIFF:
            // Force finite differences
            if (program->finite_diff.compute_hessian(*program->bytecode, program->vm,
                                                      inputs, num_inputs, hessian_out)) {
                return NDCALC_OK;
            }
            return NDCALC_ERROR_EVAL;

        case NDCALC_AD_MODE_AUTO:
        default:
            // Try AD first, fallback to FD
            if (program->autodiff.compute_hessian(*program->bytecode, inputs,
                                                   num_inputs, hessian_out)) {
                return NDCALC_OK;
            }
            if (program->finite_diff.compute_hessian(*program->bytecode, program->vm,
                                                      inputs, num_inputs, hessian_out)) {
                return NDCALC_OK;
            }
            return NDCALC_ERROR_EVAL;
    }
}

// Configuration
void ndcalc_set_ad_mode(ndcalc_context_handle ctx, ndcalc_ad_mode_t mode) {
    if (ctx) {
        ctx->ad_mode = mode;
    }
}

void ndcalc_set_fd_epsilon(ndcalc_context_handle ctx, double epsilon) {
    if (ctx) {
        ctx->fd_epsilon = epsilon;
    }
}

// Error handling
const char* ndcalc_error_string(ndcalc_error_t error) {
    switch (error) {
        case NDCALC_OK:
            return "Success";
        case NDCALC_ERROR_PARSE:
            return "Parse error";
        case NDCALC_ERROR_INVALID_EXPR:
            return "Invalid expression";
        case NDCALC_ERROR_EVAL:
            return "Evaluation error";
        case NDCALC_ERROR_OUT_OF_MEMORY:
            return "Out of memory";
        case NDCALC_ERROR_INVALID_DIMENSION:
            return "Invalid dimension";
        case NDCALC_ERROR_NULL_POINTER:
            return "Null pointer";
        default:
            return "Unknown error";
    }
}

const char* ndcalc_get_last_error_message(ndcalc_context_handle ctx) {
    if (!ctx) return "Invalid context";
    return ctx->last_error.c_str();
}
