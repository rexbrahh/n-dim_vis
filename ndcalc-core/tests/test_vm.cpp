#include "ndcalc/parser.h"
#include "ndcalc/compiler.h"
#include "ndcalc/vm.h"
#include <iostream>
#include <cassert>
#include <cmath>

using namespace ndcalc;

bool approx_equal(double a, double b, double epsilon = 1e-10) {
    return std::abs(a - b) < epsilon;
}

void test_basic_arithmetic() {
    Parser parser;
    Compiler compiler;
    VM vm;

    std::vector<std::string> vars = {"x", "y"};
    auto ast = parser.parse("x + y", vars);
    assert(ast != nullptr);

    auto program = compiler.compile(*ast);
    assert(program != nullptr);
    program->set_num_variables(2);

    double inputs[] = {3.0, 4.0};
    double result;
    assert(vm.execute(*program, inputs, 2, result));
    assert(approx_equal(result, 7.0));

    std::cout << "✓ test_basic_arithmetic passed\n";
}

void test_multiplication() {
    Parser parser;
    Compiler compiler;
    VM vm;

    std::vector<std::string> vars = {"x", "y"};
    auto ast = parser.parse("x * y", vars);
    auto program = compiler.compile(*ast);
    program->set_num_variables(2);

    double inputs[] = {3.0, 4.0};
    double result;
    assert(vm.execute(*program, inputs, 2, result));
    assert(approx_equal(result, 12.0));

    std::cout << "✓ test_multiplication passed\n";
}

void test_power() {
    Parser parser;
    Compiler compiler;
    VM vm;

    std::vector<std::string> vars = {"x"};
    auto ast = parser.parse("x^2", vars);
    auto program = compiler.compile(*ast);
    program->set_num_variables(1);

    double inputs[] = {5.0};
    double result;
    assert(vm.execute(*program, inputs, 1, result));
    assert(approx_equal(result, 25.0));

    std::cout << "✓ test_power passed\n";
}

void test_sin() {
    Parser parser;
    Compiler compiler;
    VM vm;

    std::vector<std::string> vars = {"x"};
    auto ast = parser.parse("sin(x)", vars);
    auto program = compiler.compile(*ast);
    program->set_num_variables(1);

    double inputs[] = {M_PI / 2.0};
    double result;
    assert(vm.execute(*program, inputs, 1, result));
    assert(approx_equal(result, 1.0));

    std::cout << "✓ test_sin passed\n";
}

void test_complex_expression() {
    Parser parser;
    Compiler compiler;
    VM vm;

    std::vector<std::string> vars = {"x", "y"};
    auto ast = parser.parse("x^2 + y^2", vars);
    auto program = compiler.compile(*ast);
    program->set_num_variables(2);

    double inputs[] = {3.0, 4.0};
    double result;
    assert(vm.execute(*program, inputs, 2, result));
    assert(approx_equal(result, 25.0));

    std::cout << "✓ test_complex_expression passed\n";
}

void test_batch_execution() {
    Parser parser;
    Compiler compiler;
    VM vm;

    std::vector<std::string> vars = {"x", "y"};
    auto ast = parser.parse("x + y", vars);
    auto program = compiler.compile(*ast);
    program->set_num_variables(2);

    // SoA layout
    double x_array[] = {1.0, 2.0, 3.0};
    double y_array[] = {4.0, 5.0, 6.0};
    const double* inputs[] = {x_array, y_array};
    double outputs[3];

    assert(vm.execute_batch(*program, inputs, 2, 3, outputs));
    assert(approx_equal(outputs[0], 5.0));
    assert(approx_equal(outputs[1], 7.0));
    assert(approx_equal(outputs[2], 9.0));

    std::cout << "✓ test_batch_execution passed\n";
}

int main() {
    std::cout << "Running VM tests...\n";

    test_basic_arithmetic();
    test_multiplication();
    test_power();
    test_sin();
    test_complex_expression();
    test_batch_execution();

    std::cout << "All VM tests passed!\n";
    return 0;
}
