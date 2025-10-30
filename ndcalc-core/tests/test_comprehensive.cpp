#include "ndcalc/api.h"
#include "ndcalc/parser.h"
#include "ndcalc/compiler.h"
#include "ndcalc/vm.h"
#include "ndcalc/autodiff.h"
#include "ndcalc/finite_diff.h"
#include <iostream>
#include <cassert>
#include <cmath>
#include <vector>
#include <string>

// M_PI is not standard on all platforms (MSVC, strict C++)
#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

using namespace ndcalc;

// Helper function for approximate equality
bool approx_equal(double a, double b, double epsilon = 1e-6) {
    return std::abs(a - b) < epsilon;
}

// =============================================================================
// Parser Precedence Tests
// =============================================================================

void test_parser_precedence_addition_subtraction() {
    std::cout << "Testing: 2 + 3 - 1 (left-to-right)\n";
    Parser parser;
    std::vector<std::string> vars = {};
    
    auto ast = parser.parse("2 + 3 - 1", vars);
    assert(ast != nullptr);
    assert(ast->type == ASTNodeType::BINARY_OP);
    assert(ast->value == "-");
    assert(ast->children[0]->type == ASTNodeType::BINARY_OP);
    assert(ast->children[0]->value == "+");
    
    std::cout << "✓ Addition/subtraction left-to-right\n";
}

void test_parser_precedence_multiplication_division() {
    std::cout << "Testing: 2 * 3 / 4 (left-to-right)\n";
    Parser parser;
    std::vector<std::string> vars = {};
    
    auto ast = parser.parse("2 * 3 / 4", vars);
    assert(ast != nullptr);
    assert(ast->type == ASTNodeType::BINARY_OP);
    assert(ast->value == "/");
    assert(ast->children[0]->type == ASTNodeType::BINARY_OP);
    assert(ast->children[0]->value == "*");
    
    std::cout << "✓ Multiplication/division left-to-right\n";
}

void test_parser_precedence_power_right_associative() {
    std::cout << "Testing: 2 ^ 3 ^ 2 (right-associative: 2^(3^2) = 2^9 = 512)\n";
    Parser parser;
    std::vector<std::string> vars = {};
    
    auto ast = parser.parse("2 ^ 3 ^ 2", vars);
    assert(ast != nullptr);
    assert(ast->type == ASTNodeType::BINARY_OP);
    assert(ast->value == "^");
    assert(ast->children[1]->type == ASTNodeType::BINARY_OP);
    assert(ast->children[1]->value == "^");
    
    Compiler compiler;
    auto program = compiler.compile(*ast);
    assert(program != nullptr);
    program->set_num_variables(0);
    
    VM vm;
    double result;
    assert(vm.execute(*program, nullptr, 0, result));
    assert(approx_equal(result, 512.0));
    
    std::cout << "✓ Power right-associative: 2^3^2 = " << result << "\n";
}

void test_parser_precedence_mixed() {
    std::cout << "Testing: 2 + 3 * 4 ^ 2 (order: ^, *, +)\n";
    Parser parser;
    std::vector<std::string> vars = {};
    
    auto ast = parser.parse("2 + 3 * 4 ^ 2", vars);
    assert(ast != nullptr);
    
    Compiler compiler;
    auto program = compiler.compile(*ast);
    assert(program != nullptr);
    program->set_num_variables(0);
    
    VM vm;
    double result;
    assert(vm.execute(*program, nullptr, 0, result));
    // Should be: 2 + 3 * (4^2) = 2 + 3 * 16 = 2 + 48 = 50
    assert(approx_equal(result, 50.0));
    
    std::cout << "✓ Mixed precedence: 2+3*4^2 = " << result << "\n";
}

void test_parser_precedence_unary_minus() {
    std::cout << "Testing: -2 ^ 2 (unary minus binds tightly: (-2)^2 = 4)\n";
    Parser parser;
    std::vector<std::string> vars = {};
    
    auto ast = parser.parse("-2 ^ 2", vars);
    assert(ast != nullptr);
    
    Compiler compiler;
    auto program = compiler.compile(*ast);
    assert(program != nullptr);
    program->set_num_variables(0);
    
    VM vm;
    double result;
    assert(vm.execute(*program, nullptr, 0, result));
    // Current implementation: (-2)^2 = 4
    assert(approx_equal(result, 4.0));
    
    std::cout << "✓ Unary minus: -2^2 = " << result << "\n";
}

void test_parser_depth_limit() {
    std::cout << "Testing: depth limit enforcement\n";
    Parser parser;
    parser.set_max_depth(10);
    std::vector<std::string> vars = {"x"};
    
    // Create deeply nested expression
    std::string deep_expr = "x";
    for (int i = 0; i < 15; ++i) {
        deep_expr = "(" + deep_expr + " + 1)";
    }
    
    auto ast = parser.parse(deep_expr, vars);
    assert(ast == nullptr);
    assert(!parser.get_error().empty());
    assert(parser.get_error().find("deeply nested") != std::string::npos);
    
    std::cout << "✓ Depth limit enforced: " << parser.get_error() << "\n";
}

// =============================================================================
// Transcendental Function Tests
// =============================================================================

void test_transcendental_sin_cos() {
    std::cout << "Testing: sin(x)^2 + cos(x)^2 = 1\n";
    
    auto ctx = ndcalc_context_create();
    assert(ctx != nullptr);
    
    std::vector<std::string> vars = {"x"};
    const char* var_names[] = {"x"};
    
    ndcalc_program_handle program;
    auto err = ndcalc_compile(ctx, "sin(x)^2 + cos(x)^2", 1, var_names, &program);
    assert(err == NDCALC_OK);
    
    // Test at multiple points
    std::vector<double> test_points = {0.0, M_PI/4, M_PI/2, M_PI, 2*M_PI};
    for (double x : test_points) {
        double result;
        err = ndcalc_eval(program, &x, 1, &result);
        assert(err == NDCALC_OK);
        assert(approx_equal(result, 1.0, 1e-10));
    }
    
    ndcalc_program_destroy(program);
    ndcalc_context_destroy(ctx);
    
    std::cout << "✓ sin²(x) + cos²(x) = 1 for all test points\n";
}

void test_transcendental_exp_log() {
    std::cout << "Testing: log(exp(x)) = x\n";
    
    auto ctx = ndcalc_context_create();
    const char* var_names[] = {"x"};
    ndcalc_program_handle program;
    auto err = ndcalc_compile(ctx, "log(exp(x))", 1, var_names, &program);
    assert(err == NDCALC_OK);
    
    std::vector<double> test_points = {0.0, 1.0, 2.0, -1.0, 0.5};
    for (double x : test_points) {
        double result;
        err = ndcalc_eval(program, &x, 1, &result);
        assert(err == NDCALC_OK);
        assert(approx_equal(result, x, 1e-10));
    }
    
    ndcalc_program_destroy(program);
    ndcalc_context_destroy(ctx);
    
    std::cout << "✓ log(exp(x)) = x for all test points\n";
}

void test_transcendental_sqrt_pow() {
    std::cout << "Testing: sqrt(x^2) = abs(x)\n";
    
    auto ctx = ndcalc_context_create();
    const char* var_names[] = {"x"};
    ndcalc_program_handle program;
    auto err = ndcalc_compile(ctx, "sqrt(x^2)", 1, var_names, &program);
    assert(err == NDCALC_OK);
    
    std::vector<double> test_points = {0.0, 1.0, -1.0, 2.5, -2.5};
    for (double x : test_points) {
        double result;
        err = ndcalc_eval(program, &x, 1, &result);
        assert(err == NDCALC_OK);
        assert(approx_equal(result, std::abs(x), 1e-10));
    }
    
    ndcalc_program_destroy(program);
    ndcalc_context_destroy(ctx);
    
    std::cout << "✓ sqrt(x²) = |x| for all test points\n";
}

void test_transcendental_tan_identity() {
    std::cout << "Testing: tan(x) = sin(x) / cos(x)\n";
    
    auto ctx = ndcalc_context_create();
    const char* var_names[] = {"x"};
    ndcalc_program_handle prog_tan, prog_div;
    
    ndcalc_compile(ctx, "tan(x)", 1, var_names, &prog_tan);
    ndcalc_compile(ctx, "sin(x) / cos(x)", 1, var_names, &prog_div);
    
    std::vector<double> test_points = {0.0, M_PI/6, M_PI/4, -M_PI/6};
    for (double x : test_points) {
        double result_tan, result_div;
        ndcalc_eval(prog_tan, &x, 1, &result_tan);
        ndcalc_eval(prog_div, &x, 1, &result_div);
        assert(approx_equal(result_tan, result_div, 1e-10));
    }
    
    ndcalc_program_destroy(prog_tan);
    ndcalc_program_destroy(prog_div);
    ndcalc_context_destroy(ctx);
    
    std::cout << "✓ tan(x) = sin(x)/cos(x)\n";
}

// =============================================================================
// Gradient vs Finite Difference Tests
// =============================================================================

void test_gradient_polynomial() {
    std::cout << "Testing: ∇(x^2 + y^2) = (2x, 2y)\n";
    
    auto ctx = ndcalc_context_create();
    const char* var_names[] = {"x", "y"};
    ndcalc_program_handle program;
    auto err = ndcalc_compile(ctx, "x^2 + y^2", 2, var_names, &program);
    assert(err == NDCALC_OK);
    
    double point[] = {3.0, 4.0};
    double gradient[2];
    
    err = ndcalc_gradient(program, point, 2, gradient);
    assert(err == NDCALC_OK);
    
    // ∇(x²+y²) = (2x, 2y) at (3,4) should be (6, 8)
    assert(approx_equal(gradient[0], 6.0));
    assert(approx_equal(gradient[1], 8.0));
    
    ndcalc_program_destroy(program);
    ndcalc_context_destroy(ctx);
    
    std::cout << "✓ Gradient of x²+y² at (3,4) = (" << gradient[0] << ", " << gradient[1] << ")\n";
}

void test_gradient_vs_finite_diff() {
    std::cout << "Testing: AD gradient vs finite difference\n";
    
    auto ctx = ndcalc_context_create();
    const char* var_names[] = {"x", "y", "z"};
    ndcalc_program_handle program;
    auto err = ndcalc_compile(ctx, "sin(x) * exp(y) + z^2", 3, var_names, &program);
    assert(err == NDCALC_OK);
    
    double point[] = {1.0, 0.5, 2.0};
    double grad_ad[3], grad_fd[3];
    
    // Get AD gradient using program-level setter
    ndcalc_program_set_ad_mode(program, NDCALC_AD_MODE_FORWARD);
    err = ndcalc_gradient(program, point, 3, grad_ad);
    assert(err == NDCALC_OK);
    
    // Get FD gradient using program-level setters
    ndcalc_program_set_ad_mode(program, NDCALC_AD_MODE_FINITE_DIFF);
    ndcalc_program_set_fd_epsilon(program, 1e-8);
    err = ndcalc_gradient(program, point, 3, grad_fd);
    assert(err == NDCALC_OK);
    
    // Compare - should be very close
    for (int i = 0; i < 3; ++i) {
        assert(approx_equal(grad_ad[i], grad_fd[i], 1e-5));
    }
    
    std::cout << "✓ AD gradient matches FD gradient\n";
    std::cout << "  AD: (" << grad_ad[0] << ", " << grad_ad[1] << ", " << grad_ad[2] << ")\n";
    std::cout << "  FD: (" << grad_fd[0] << ", " << grad_fd[1] << ", " << grad_fd[2] << ")\n";
    
    ndcalc_program_destroy(program);
    ndcalc_context_destroy(ctx);
}

void test_ad_mode_forced() {
    std::cout << "Testing: Forced AD modes (FORWARD and FINITE_DIFF)\n";
    
    auto ctx = ndcalc_context_create();
    const char* var_names[] = {"x", "y"};
    ndcalc_program_handle program;
    auto err = ndcalc_compile(ctx, "x^2 + y^2", 2, var_names, &program);
    assert(err == NDCALC_OK);
    
    double point[] = {3.0, 4.0};
    double gradient[2];
    
    // Test FORWARD mode (should succeed for simple expressions)
    ndcalc_program_set_ad_mode(program, NDCALC_AD_MODE_FORWARD);
    err = ndcalc_gradient(program, point, 2, gradient);
    assert(err == NDCALC_OK);
    assert(approx_equal(gradient[0], 6.0));
    assert(approx_equal(gradient[1], 8.0));
    std::cout << "  ✓ FORWARD mode: gradient = (" << gradient[0] << ", " << gradient[1] << ")\n";
    
    // Test FINITE_DIFF mode (should also succeed)
    ndcalc_program_set_ad_mode(program, NDCALC_AD_MODE_FINITE_DIFF);
    ndcalc_program_set_fd_epsilon(program, 1e-8);
    err = ndcalc_gradient(program, point, 2, gradient);
    assert(err == NDCALC_OK);
    assert(approx_equal(gradient[0], 6.0, 1e-6));
    assert(approx_equal(gradient[1], 8.0, 1e-6));
    std::cout << "  ✓ FINITE_DIFF mode: gradient = (" << gradient[0] << ", " << gradient[1] << ")\n";
    
    // Test AUTO mode (should use AD and succeed)
    ndcalc_program_set_ad_mode(program, NDCALC_AD_MODE_AUTO);
    err = ndcalc_gradient(program, point, 2, gradient);
    assert(err == NDCALC_OK);
    assert(approx_equal(gradient[0], 6.0));
    assert(approx_equal(gradient[1], 8.0));
    std::cout << "  ✓ AUTO mode: gradient = (" << gradient[0] << ", " << gradient[1] << ")\n";
    
    std::cout << "✓ All AD modes work correctly\n";
    
    ndcalc_program_destroy(program);
    ndcalc_context_destroy(ctx);
}

// =============================================================================
// Hessian Tests
// =============================================================================

void test_hessian_quadratic() {
    std::cout << "Testing: Hessian of x^2 + y^2 + z^2\n";
    
    auto ctx = ndcalc_context_create();
    const char* var_names[] = {"x", "y", "z"};
    ndcalc_program_handle program;
    auto err = ndcalc_compile(ctx, "x^2 + y^2 + z^2", 3, var_names, &program);
    assert(err == NDCALC_OK);
    
    double point[] = {1.0, 2.0, 3.0};
    double hessian[9];  // 3x3 matrix
    
    err = ndcalc_hessian(program, point, 3, hessian);
    assert(err == NDCALC_OK);
    
    // Hessian of x²+y²+z² should be diag(2, 2, 2)
    assert(approx_equal(hessian[0], 2.0));  // H_xx
    assert(approx_equal(hessian[4], 2.0));  // H_yy
    assert(approx_equal(hessian[8], 2.0));  // H_zz
    
    // Off-diagonal should be 0
    for (int i = 0; i < 3; ++i) {
        for (int j = 0; j < 3; ++j) {
            if (i != j) {
                assert(approx_equal(hessian[i*3 + j], 0.0, 1e-5));
            }
        }
    }
    
    std::cout << "✓ Hessian is diagonal with values (2, 2, 2)\n";
    
    ndcalc_program_destroy(program);
    ndcalc_context_destroy(ctx);
}

void test_hessian_symmetry() {
    std::cout << "Testing: Hessian symmetry\n";
    
    auto ctx = ndcalc_context_create();
    const char* var_names[] = {"x", "y"};
    ndcalc_program_handle program;
    auto err = ndcalc_compile(ctx, "x^3 * y^2 + sin(x*y)", 2, var_names, &program);
    assert(err == NDCALC_OK);
    
    double point[] = {1.5, 2.0};
    double hessian[4];  // 2x2 matrix
    
    err = ndcalc_hessian(program, point, 2, hessian);
    assert(err == NDCALC_OK);
    
    // H_xy should equal H_yx (symmetry)
    assert(approx_equal(hessian[1], hessian[2], 1e-5));
    
    std::cout << "✓ Hessian is symmetric: H_xy = H_yx = " << hessian[1] << "\n";
    
    ndcalc_program_destroy(program);
    ndcalc_context_destroy(ctx);
}

// =============================================================================
// Directional Derivatives
// =============================================================================

void test_directional_derivative() {
    std::cout << "Testing: Directional derivative D_v f\n";
    
    auto ctx = ndcalc_context_create();
    const char* var_names[] = {"x", "y"};
    ndcalc_program_handle program;
    auto err = ndcalc_compile(ctx, "x^2 + y^2", 2, var_names, &program);
    assert(err == NDCALC_OK);
    
    double point[] = {3.0, 4.0};
    double gradient[2];
    
    err = ndcalc_gradient(program, point, 2, gradient);
    assert(err == NDCALC_OK);
    
    // Direction: unit vector at 45 degrees
    double direction[] = {1.0/std::sqrt(2.0), 1.0/std::sqrt(2.0)};
    
    // D_v f = ∇f · v
    double dir_deriv = gradient[0] * direction[0] + gradient[1] * direction[1];
    
    // At (3,4): ∇f = (6, 8), v = (1/√2, 1/√2)
    // D_v f = 6/√2 + 8/√2 = 14/√2 ≈ 9.899
    double expected = 14.0 / std::sqrt(2.0);
    assert(approx_equal(dir_deriv, expected, 1e-6));
    
    std::cout << "✓ Directional derivative: D_v f = " << dir_deriv << "\n";
    
    ndcalc_program_destroy(program);
    ndcalc_context_destroy(ctx);
}

// =============================================================================
// Error Handling Tests
// =============================================================================

void test_error_division_by_zero() {
    std::cout << "Testing: Division by zero detection\n";
    
    auto ctx = ndcalc_context_create();
    const char* var_names[] = {"x"};
    ndcalc_program_handle program;
    auto err = ndcalc_compile(ctx, "1 / x", 1, var_names, &program);
    assert(err == NDCALC_OK);
    
    double x = 0.0;
    double result;
    err = ndcalc_eval(program, &x, 1, &result);
    assert(err == NDCALC_ERROR_EVAL);
    
    std::cout << "✓ Division by zero detected\n";
    
    ndcalc_program_destroy(program);
    ndcalc_context_destroy(ctx);
}

void test_error_log_negative() {
    std::cout << "Testing: Log of negative number detection\n";
    
    auto ctx = ndcalc_context_create();
    const char* var_names[] = {"x"};
    ndcalc_program_handle program;
    auto err = ndcalc_compile(ctx, "log(x)", 1, var_names, &program);
    assert(err == NDCALC_OK);
    
    double x = -1.0;
    double result;
    err = ndcalc_eval(program, &x, 1, &result);
    assert(err == NDCALC_ERROR_EVAL);
    
    std::cout << "✓ Log of negative number detected\n";
    
    ndcalc_program_destroy(program);
    ndcalc_context_destroy(ctx);
}

void test_error_sqrt_negative() {
    std::cout << "Testing: Sqrt of negative number detection\n";
    
    auto ctx = ndcalc_context_create();
    const char* var_names[] = {"x"};
    ndcalc_program_handle program;
    auto err = ndcalc_compile(ctx, "sqrt(x)", 1, var_names, &program);
    assert(err == NDCALC_OK);
    
    double x = -4.0;
    double result;
    err = ndcalc_eval(program, &x, 1, &result);
    assert(err == NDCALC_ERROR_EVAL);
    
    std::cout << "✓ Sqrt of negative number detected\n";
    
    ndcalc_program_destroy(program);
    ndcalc_context_destroy(ctx);
}

// =============================================================================
// Main Test Runner
// =============================================================================

int main() {
    std::cout << "\n=== ndcalc Comprehensive Test Suite ===\n\n";
    
    std::cout << "--- Parser Precedence Tests ---\n";
    test_parser_precedence_addition_subtraction();
    test_parser_precedence_multiplication_division();
    test_parser_precedence_power_right_associative();
    test_parser_precedence_mixed();
    test_parser_precedence_unary_minus();
    test_parser_depth_limit();
    
    std::cout << "\n--- Transcendental Function Tests ---\n";
    test_transcendental_sin_cos();
    test_transcendental_exp_log();
    test_transcendental_sqrt_pow();
    test_transcendental_tan_identity();
    
    std::cout << "\n--- Gradient Tests ---\n";
    test_gradient_polynomial();
    test_gradient_vs_finite_diff();
    test_ad_mode_forced();
    
    std::cout << "\n--- Hessian Tests ---\n";
    test_hessian_quadratic();
    test_hessian_symmetry();
    
    std::cout << "\n--- Directional Derivative Tests ---\n";
    test_directional_derivative();
    
    std::cout << "\n--- Error Handling Tests ---\n";
    test_error_division_by_zero();
    test_error_log_negative();
    test_error_sqrt_negative();
    
    std::cout << "\n=== All tests passed! ===\n";
    return 0;
}
