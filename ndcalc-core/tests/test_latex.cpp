#include "ndcalc/latex.h"

#include <cassert>
#include <cmath>
#include <iostream>
#include <string>

void test_latex_to_ascii_basic() {
    ndcalc_owned_string ascii{};
    ndcalc_latex_error_t error{};

    auto status = ndcalc_latex_to_ascii("\\sin{x_1} + x_2", &ascii, &error);
    assert(status == NDCALC_LATEX_OK);
    std::string result(ascii.data, ascii.length);
    assert(result == "sin(x1) + x2");
    ndcalc_latex_free_string(&ascii);
    ndcalc_latex_free_error(&error);

    std::cout << "✓ latex_to_ascii basic expression\n";
}

void test_latex_to_ascii_fraction() {
    ndcalc_owned_string ascii{};
    ndcalc_latex_error_t error{};

  auto status = ndcalc_latex_to_ascii("\\frac{1}{2}x_2", &ascii, &error);
  assert(status == NDCALC_LATEX_OK);
  std::string result(ascii.data, ascii.length);
  assert(result == "(1)/(2)*x2" || result == "(1)/(2) * x2");
    ndcalc_latex_free_string(&ascii);
    ndcalc_latex_free_error(&error);

    std::cout << "✓ latex_to_ascii fraction handling\n";
}

void test_latex_to_ascii_length_error() {
    std::string long_input(9000, 'x');
    ndcalc_owned_string ascii{};
    ndcalc_latex_error_t error{};

    auto status = ndcalc_latex_to_ascii(long_input.c_str(), &ascii, &error);
    assert(status == NDCALC_LATEX_ERROR_MAX_LENGTH);
    assert(error.message != nullptr);
    std::string message(error.message);
    assert(message.find("maximum length") != std::string::npos);
    ndcalc_latex_free_string(&ascii);
    ndcalc_latex_free_error(&error);

    std::cout << "✓ latex_to_ascii length guard\n";
}

void test_latex_to_hyperplane_success() {
    float* coeffs = nullptr;
    size_t count = 0;
    double offset = 0.0;
    ndcalc_latex_error_t error{};

    auto status = ndcalc_latex_to_hyperplane("x_1 + 2x_3 = 7", 4, &coeffs, &count, &offset, &error);
    assert(status == NDCALC_LATEX_OK);
    assert(count == 4);
    assert(std::abs(coeffs[0] - 1.0f) < 1e-6f);
    assert(std::abs(coeffs[1] - 0.0f) < 1e-6f);
    assert(std::abs(coeffs[2] - 2.0f) < 1e-6f);
    assert(std::abs(coeffs[3] - 0.0f) < 1e-6f);
    assert(std::abs(offset - 7.0) < 1e-9);

    ndcalc_latex_free_float_array(coeffs);
    ndcalc_latex_free_error(&error);

    std::cout << "✓ latex_to_hyperplane linear equation\n";
}

void test_latex_to_hyperplane_error() {
    float* coeffs = nullptr;
    size_t count = 0;
    double offset = 0.0;
    ndcalc_latex_error_t error{};

    auto status = ndcalc_latex_to_hyperplane("x_1^2 = 1", 2, &coeffs, &count, &offset, &error);
    assert(status == NDCALC_LATEX_ERROR_NONLINEAR);
    assert(error.message != nullptr);
    std::string message(error.message);
    assert(message.find("Nonlinear") != std::string::npos);
    ndcalc_latex_free_float_array(coeffs);
    ndcalc_latex_free_error(&error);

    std::cout << "✓ latex_to_hyperplane nonlinear guard\n";
}

void test_latex_to_matrix_success() {
    const char* src = "\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}";
    double* values = nullptr;
    size_t rows = 0;
    size_t cols = 0;
    ndcalc_latex_error_t error{};

  auto status = ndcalc_latex_to_matrix(src, &values, &rows, &cols, &error);
  if (status != NDCALC_LATEX_OK) {
    std::cout << "Matrix error: '" << (error.message ? error.message : "null") << "'\n";
  }
  assert(status == NDCALC_LATEX_OK);
    assert(rows == 2);
    assert(cols == 2);
    assert(std::abs(values[0] - 1.0) < 1e-9);
    assert(std::abs(values[1] - 2.0) < 1e-9);
    assert(std::abs(values[2] - 3.0) < 1e-9);
    assert(std::abs(values[3] - 4.0) < 1e-9);

    ndcalc_latex_free_double_array(values);
    ndcalc_latex_free_error(&error);

    std::cout << "✓ latex_to_matrix basic matrix\n";
}

void test_latex_to_matrix_error() {
    const char* src = "\\begin{bmatrix}1&2\\\\3&4&5\\end{bmatrix}";
    double* values = nullptr;
    size_t rows = 0;
    size_t cols = 0;
    ndcalc_latex_error_t error{};

    auto status = ndcalc_latex_to_matrix(src, &values, &rows, &cols, &error);
    assert(status == NDCALC_LATEX_ERROR_INVALID_INPUT);
    assert(error.message != nullptr);
    std::string message(error.message);
    assert(message.find("Inconsistent row lengths") != std::string::npos);
    ndcalc_latex_free_double_array(values);
    ndcalc_latex_free_error(&error);

    std::cout << "✓ latex_to_matrix row length guard\n";
}

void test_hyperplane_validation_and_normalization() {
    float coeffs[] = {3.0f, 4.0f};
    double offset = 5.0;
    ndcalc_latex_error_t error{};

    assert(ndcalc_latex_validate_hyperplane(coeffs, 2));
    auto status = ndcalc_latex_normalize_hyperplane(coeffs, 2, &offset, &error);
    assert(status == NDCALC_LATEX_OK);
    assert(std::abs(coeffs[0] - 0.6f) < 1e-6f);
    assert(std::abs(coeffs[1] - 0.8f) < 1e-6f);
    assert(std::abs(offset - 1.0) < 1e-9);
    ndcalc_latex_free_error(&error);

    std::cout << "✓ hyperplane normalization\n";
}

void test_hyperplane_normalize_zero() {
    float coeffs[] = {0.0f, 0.0f};
    double offset = 1.0;
    ndcalc_latex_error_t error{};

    auto status = ndcalc_latex_normalize_hyperplane(coeffs, 2, &offset, &error);
    assert(status == NDCALC_LATEX_ERROR_INVALID_INPUT);
    assert(error.message != nullptr);
    std::string message(error.message);
    assert(message.find("zero normal vector") != std::string::npos);
    ndcalc_latex_free_error(&error);

    std::cout << "✓ hyperplane normalization guard\n";
}

int main() {
    std::cout << "Running LaTeX translator tests...\n";

    test_latex_to_ascii_basic();
    test_latex_to_ascii_fraction();
    test_latex_to_ascii_length_error();
    test_latex_to_hyperplane_success();
    test_latex_to_hyperplane_error();
    test_latex_to_matrix_success();
    test_latex_to_matrix_error();
    test_hyperplane_validation_and_normalization();
    test_hyperplane_normalize_zero();

    std::cout << "All LaTeX translator tests passed.\n";
    return 0;
}
