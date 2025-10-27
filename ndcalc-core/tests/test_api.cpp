#include "ndcalc/api.h"
#include <iostream>
#include <cassert>
#include <cmath>

bool approx_equal(double a, double b, double epsilon = 1e-6) {
    return std::abs(a - b) < epsilon;
}

void test_compile_and_eval() {
    ndcalc_context_handle ctx = ndcalc_context_create();
    assert(ctx != nullptr);

    const char* vars[] = {"x", "y"};
    ndcalc_program_handle program;

    ndcalc_error_t err = ndcalc_compile(ctx, "x + y", 2, vars, &program);
    assert(err == NDCALC_OK);
    assert(program != nullptr);

    double inputs[] = {3.0, 4.0};
    double output;
    err = ndcalc_eval(program, inputs, 2, &output);
    assert(err == NDCALC_OK);
    assert(approx_equal(output, 7.0));

    ndcalc_program_destroy(program);
    ndcalc_context_destroy(ctx);

    std::cout << "✓ test_compile_and_eval passed\n";
}

void test_gradient() {
    ndcalc_context_handle ctx = ndcalc_context_create();

    const char* vars[] = {"x", "y"};
    ndcalc_program_handle program;

    ndcalc_error_t err = ndcalc_compile(ctx, "x^2 + y^2", 2, vars, &program);
    assert(err == NDCALC_OK);

    double inputs[] = {3.0, 4.0};
    double gradient[2];
    err = ndcalc_gradient(program, inputs, 2, gradient);
    assert(err == NDCALC_OK);

    assert(approx_equal(gradient[0], 6.0));
    assert(approx_equal(gradient[1], 8.0));

    ndcalc_program_destroy(program);
    ndcalc_context_destroy(ctx);

    std::cout << "✓ test_gradient passed\n";
}

void test_hessian() {
    ndcalc_context_handle ctx = ndcalc_context_create();

    const char* vars[] = {"x", "y"};
    ndcalc_program_handle program;

    ndcalc_error_t err = ndcalc_compile(ctx, "x^2 + y^2", 2, vars, &program);
    assert(err == NDCALC_OK);

    double inputs[] = {3.0, 4.0};
    double hessian[4];
    err = ndcalc_hessian(program, inputs, 2, hessian);
    assert(err == NDCALC_OK);

    assert(approx_equal(hessian[0], 2.0, 1e-4));
    assert(approx_equal(hessian[3], 2.0, 1e-4));
    assert(approx_equal(hessian[1], 0.0, 1e-4));
    assert(approx_equal(hessian[2], 0.0, 1e-4));

    ndcalc_program_destroy(program);
    ndcalc_context_destroy(ctx);

    std::cout << "✓ test_hessian passed\n";
}

void test_batch_eval() {
    ndcalc_context_handle ctx = ndcalc_context_create();

    const char* vars[] = {"x", "y"};
    ndcalc_program_handle program;

    ndcalc_error_t err = ndcalc_compile(ctx, "x + y", 2, vars, &program);
    assert(err == NDCALC_OK);

    double x_array[] = {1.0, 2.0, 3.0};
    double y_array[] = {4.0, 5.0, 6.0};
    const double* inputs[] = {x_array, y_array};
    double outputs[3];

    err = ndcalc_eval_batch(program, inputs, 2, 3, outputs);
    assert(err == NDCALC_OK);

    assert(approx_equal(outputs[0], 5.0));
    assert(approx_equal(outputs[1], 7.0));
    assert(approx_equal(outputs[2], 9.0));

    ndcalc_program_destroy(program);
    ndcalc_context_destroy(ctx);

    std::cout << "✓ test_batch_eval passed\n";
}

void test_error_handling() {
    ndcalc_context_handle ctx = ndcalc_context_create();

    const char* vars[] = {"x"};
    ndcalc_program_handle program;

    // Invalid expression
    ndcalc_error_t err = ndcalc_compile(ctx, "x +", 1, vars, &program);
    assert(err != NDCALC_OK);

    const char* error_msg = ndcalc_get_last_error_message(ctx);
    assert(error_msg != nullptr);

    ndcalc_context_destroy(ctx);

    std::cout << "✓ test_error_handling passed\n";
}

void test_trig_functions() {
    ndcalc_context_handle ctx = ndcalc_context_create();

    const char* vars[] = {"x"};
    ndcalc_program_handle program;

    ndcalc_error_t err = ndcalc_compile(ctx, "sin(x) + cos(x)", 1, vars, &program);
    assert(err == NDCALC_OK);

    double inputs[] = {M_PI / 4.0};
    double output;
    err = ndcalc_eval(program, inputs, 1, &output);
    assert(err == NDCALC_OK);

    double expected = std::sin(M_PI / 4.0) + std::cos(M_PI / 4.0);
    assert(approx_equal(output, expected));

    ndcalc_program_destroy(program);
    ndcalc_context_destroy(ctx);

    std::cout << "✓ test_trig_functions passed\n";
}

int main() {
    std::cout << "Running API tests...\n";

    test_compile_and_eval();
    test_gradient();
    test_hessian();
    test_batch_eval();
    test_error_handling();
    test_trig_functions();

    std::cout << "All API tests passed!\n";
    return 0;
}
