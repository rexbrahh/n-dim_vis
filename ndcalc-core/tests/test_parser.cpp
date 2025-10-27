#include "ndcalc/parser.h"
#include "ndcalc/compiler.h"
#include <iostream>
#include <cassert>
#include <cmath>

using namespace ndcalc;

void test_simple_expression() {
    Parser parser;
    std::vector<std::string> vars = {"x", "y"};

    auto ast = parser.parse("x + y", vars);
    assert(ast != nullptr);
    assert(ast->type == ASTNodeType::BINARY_OP);
    assert(ast->value == "+");

    std::cout << "✓ test_simple_expression passed\n";
}

void test_complex_expression() {
    Parser parser;
    std::vector<std::string> vars = {"x", "y", "z"};

    auto ast = parser.parse("x * y + sin(z)", vars);
    assert(ast != nullptr);

    std::cout << "✓ test_complex_expression passed\n";
}

void test_function_call() {
    Parser parser;
    std::vector<std::string> vars = {"x"};

    auto ast = parser.parse("sin(x) + cos(x)", vars);
    assert(ast != nullptr);

    std::cout << "✓ test_function_call passed\n";
}

void test_nested_functions() {
    Parser parser;
    std::vector<std::string> vars = {"x"};

    auto ast = parser.parse("exp(sin(x * 2))", vars);
    assert(ast != nullptr);

    std::cout << "✓ test_nested_functions passed\n";
}

void test_power_operator() {
    Parser parser;
    std::vector<std::string> vars = {"x"};

    auto ast = parser.parse("x^2 + x^3", vars);
    assert(ast != nullptr);

    std::cout << "✓ test_power_operator passed\n";
}

void test_compile() {
    Parser parser;
    Compiler compiler;
    std::vector<std::string> vars = {"x", "y"};

    auto ast = parser.parse("x + y * 2", vars);
    assert(ast != nullptr);

    auto program = compiler.compile(*ast);
    assert(program != nullptr);
    program->set_num_variables(2);

    std::cout << "✓ test_compile passed\n";
}

int main() {
    std::cout << "Running parser tests...\n";

    test_simple_expression();
    test_complex_expression();
    test_function_call();
    test_nested_functions();
    test_power_operator();
    test_compile();

    std::cout << "All parser tests passed!\n";
    return 0;
}
