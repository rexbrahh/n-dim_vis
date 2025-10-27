#include "ndcalc/parser.h"
#include "ndcalc/compiler.h"
#include "ndcalc/autodiff.h"
#include <iostream>
#include <cassert>
#include <cmath>

using namespace ndcalc;

bool approx_equal(double a, double b, double epsilon = 1e-6) {
    return std::abs(a - b) < epsilon;
}

void test_gradient_linear() {
    Parser parser;
    Compiler compiler;
    AutoDiff autodiff;

    // f(x, y) = x + y
    // ∂f/∂x = 1, ∂f/∂y = 1
    std::vector<std::string> vars = {"x", "y"};
    auto ast = parser.parse("x + y", vars);
    auto program = compiler.compile(*ast);
    program->set_num_variables(2);

    double inputs[] = {3.0, 4.0};
    double gradient[2];
    assert(autodiff.compute_gradient(*program, inputs, 2, gradient));

    assert(approx_equal(gradient[0], 1.0));
    assert(approx_equal(gradient[1], 1.0));

    std::cout << "✓ test_gradient_linear passed\n";
}

void test_gradient_quadratic() {
    Parser parser;
    Compiler compiler;
    AutoDiff autodiff;

    // f(x, y) = x^2 + y^2
    // ∂f/∂x = 2x, ∂f/∂y = 2y
    std::vector<std::string> vars = {"x", "y"};
    auto ast = parser.parse("x^2 + y^2", vars);
    auto program = compiler.compile(*ast);
    program->set_num_variables(2);

    double inputs[] = {3.0, 4.0};
    double gradient[2];
    assert(autodiff.compute_gradient(*program, inputs, 2, gradient));

    assert(approx_equal(gradient[0], 6.0));  // 2 * 3
    assert(approx_equal(gradient[1], 8.0));  // 2 * 4

    std::cout << "✓ test_gradient_quadratic passed\n";
}

void test_gradient_product() {
    Parser parser;
    Compiler compiler;
    AutoDiff autodiff;

    // f(x, y) = x * y
    // ∂f/∂x = y, ∂f/∂y = x
    std::vector<std::string> vars = {"x", "y"};
    auto ast = parser.parse("x * y", vars);
    auto program = compiler.compile(*ast);
    program->set_num_variables(2);

    double inputs[] = {3.0, 4.0};
    double gradient[2];
    assert(autodiff.compute_gradient(*program, inputs, 2, gradient));

    assert(approx_equal(gradient[0], 4.0));  // y
    assert(approx_equal(gradient[1], 3.0));  // x

    std::cout << "✓ test_gradient_product passed\n";
}

void test_gradient_sin() {
    Parser parser;
    Compiler compiler;
    AutoDiff autodiff;

    // f(x) = sin(x)
    // ∂f/∂x = cos(x)
    std::vector<std::string> vars = {"x"};
    auto ast = parser.parse("sin(x)", vars);
    auto program = compiler.compile(*ast);
    program->set_num_variables(1);

    double inputs[] = {M_PI / 4.0};
    double gradient[1];
    assert(autodiff.compute_gradient(*program, inputs, 1, gradient));

    assert(approx_equal(gradient[0], std::cos(M_PI / 4.0)));

    std::cout << "✓ test_gradient_sin passed\n";
}

void test_gradient_exp() {
    Parser parser;
    Compiler compiler;
    AutoDiff autodiff;

    // f(x) = exp(x)
    // ∂f/∂x = exp(x)
    std::vector<std::string> vars = {"x"};
    auto ast = parser.parse("exp(x)", vars);
    auto program = compiler.compile(*ast);
    program->set_num_variables(1);

    double inputs[] = {2.0};
    double gradient[1];
    assert(autodiff.compute_gradient(*program, inputs, 1, gradient));

    assert(approx_equal(gradient[0], std::exp(2.0)));

    std::cout << "✓ test_gradient_exp passed\n";
}

void test_hessian_simple() {
    Parser parser;
    Compiler compiler;
    AutoDiff autodiff;

    // f(x, y) = x^2 + y^2
    // H = [[2, 0], [0, 2]]
    std::vector<std::string> vars = {"x", "y"};
    auto ast = parser.parse("x^2 + y^2", vars);
    auto program = compiler.compile(*ast);
    program->set_num_variables(2);

    double inputs[] = {3.0, 4.0};
    double hessian[4];
    assert(autodiff.compute_hessian(*program, inputs, 2, hessian));

    // Check diagonal elements (should be approximately 2)
    assert(approx_equal(hessian[0], 2.0, 1e-4));
    assert(approx_equal(hessian[3], 2.0, 1e-4));

    // Check off-diagonal elements (should be approximately 0)
    assert(approx_equal(hessian[1], 0.0, 1e-4));
    assert(approx_equal(hessian[2], 0.0, 1e-4));

    std::cout << "✓ test_hessian_simple passed\n";
}

int main() {
    std::cout << "Running autodiff tests...\n";

    test_gradient_linear();
    test_gradient_quadratic();
    test_gradient_product();
    test_gradient_sin();
    test_gradient_exp();
    test_hessian_simple();

    std::cout << "All autodiff tests passed!\n";
    return 0;
}
