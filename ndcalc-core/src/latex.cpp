#include "ndcalc/latex.h"
#include "ndcalc/parser.h"
#include "ndcalc/compiler.h"
#include "ndcalc/vm.h"

#include <algorithm>
#include <cctype>
#include <cmath>
#include <cstdlib>
#include <cstring>
#include <regex>
#include <sstream>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

namespace {

constexpr size_t MAX_LATEX_LENGTH = 8192;

struct LatexParseException : public std::runtime_error {
    ndcalc_latex_status_t status;
    size_t start;
    size_t end;

    LatexParseException(ndcalc_latex_status_t status,
                        std::string message,
                        size_t start = 0,
                        size_t end = 0)
        : std::runtime_error(std::move(message)),
          status(status),
          start(start),
          end(end) {}
};

std::string trim_copy(const std::string& value) {
    size_t begin = 0;
    size_t finish = value.size();
    while (begin < finish && std::isspace(static_cast<unsigned char>(value[begin]))) {
        begin += 1;
    }
    while (finish > begin && std::isspace(static_cast<unsigned char>(value[finish - 1]))) {
        finish -= 1;
    }
    return value.substr(begin, finish - begin);
}

void replace_all(std::string& target, const std::string& from, const std::string& to) {
    if (from.empty()) {
        return;
    }
    size_t pos = 0;
    while ((pos = target.find(from, pos)) != std::string::npos) {
        target.replace(pos, from.size(), to);
        pos += to.size();
    }
}

std::string escape_for_regex(const std::string& input) {
    std::string escaped;
    escaped.reserve(input.size() * 2);
    for (char ch : input) {
        switch (ch) {
            case '\\':
                escaped += "\\\\";
                break;
            case '.':
            case '^':
            case '$':
            case '|':
            case '(': 
            case ')':
            case '[':
            case ']':
            case '{':
            case '}':
            case '*':
            case '+':
            case '?':
                escaped.push_back('\\');
                escaped.push_back(ch);
                break;
            default:
                escaped.push_back(ch);
                break;
        }
    }
    return escaped;
}

size_t find_matching_brace(const std::string& text, size_t open_index) {
    int depth = 0;
    for (size_t i = open_index; i < text.size(); ++i) {
        if (text[i] == '{') {
            depth++;
        } else if (text[i] == '}') {
            depth--;
            if (depth == 0) {
                return i;
            }
        }
    }
    return std::string::npos;
}

void ensure_length(const std::string& src) {
    if (src.size() > MAX_LATEX_LENGTH) {
        throw LatexParseException(
            NDCALC_LATEX_ERROR_MAX_LENGTH,
            "Input exceeds maximum length of " + std::to_string(MAX_LATEX_LENGTH) + " characters",
            0,
            src.size()
        );
    }
}

std::string format_number_like_js(double value) {
    if (value == 0.0) {
        return "0";
    }
    std::ostringstream oss;
    oss.setf(std::ios::fmtflags(0), std::ios::floatfield);
    oss.precision(15);
    oss << value;
    std::string out = oss.str();

    // Remove trailing zeros for fixed representations
    if (out.find('.') != std::string::npos && out.find('e') == std::string::npos && out.find('E') == std::string::npos) {
        while (!out.empty() && out.back() == '0') {
            out.pop_back();
        }
        if (!out.empty() && out.back() == '.') {
            out.pop_back();
        }
        if (out.empty()) {
            out = "0";
        }
    }
    if (out == "-0") {
        out = "0";
    }
    return out;
}

std::string latex_to_ascii_internal(const std::string& src);

std::vector<float> latex_to_hyperplane_coefficients(
    const std::string& src,
    size_t dimension,
    double& out_offset
);

std::vector<std::vector<double>> latex_to_matrix_internal(const std::string& src);

bool validate_hyperplane_internal(const float* coeffs, size_t count) {
    double norm_sq = 0.0;
    for (size_t i = 0; i < count; ++i) {
        norm_sq += static_cast<double>(coeffs[i]) * static_cast<double>(coeffs[i]);
    }
    return norm_sq > 0.0;
}

double evaluate_ascii_number(const std::string& ascii) {
    ndcalc::Parser parser;
    std::vector<std::string> vars;
    auto ast = parser.parse(ascii, vars);
    if (!ast) {
        throw LatexParseException(NDCALC_LATEX_ERROR_PARSE, "Invalid numeric expression", 0, ascii.size());
    }

    ndcalc::Compiler compiler;
    auto program = compiler.compile(*ast);
    if (!program) {
        throw LatexParseException(NDCALC_LATEX_ERROR_PARSE, "Invalid numeric expression", 0, ascii.size());
    }

    program->set_num_variables(0);
    ndcalc::VM vm;
    double output = 0.0;
    if (!vm.execute(*program, nullptr, 0, output)) {
        throw LatexParseException(NDCALC_LATEX_ERROR_PARSE, "Invalid numeric expression", 0, ascii.size());
    }
    return output;
}

std::string latex_to_ascii_internal(const std::string& src) {
    ensure_length(src);

    std::string result = trim_copy(src);

    replace_all(result, "\\left", "");
    replace_all(result, "\\right", "");

    static const std::regex var_braced(R"(x_\{(\d+)\})");
    result = std::regex_replace(result, var_braced, "x$1");

    static const std::regex var_simple(R"(x_(\d+))");
    result = std::regex_replace(result, var_simple, "x$1");

    size_t frac_pos = 0;
    while ((frac_pos = result.find("\\frac", frac_pos)) != std::string::npos) {
        size_t numerator_start = result.find('{', frac_pos + 5);
        if (numerator_start == std::string::npos) {
            break;
        }
        size_t numerator_end = find_matching_brace(result, numerator_start);
        if (numerator_end == std::string::npos) {
            break;
        }
        size_t denominator_start = result.find('{', numerator_end + 1);
        if (denominator_start == std::string::npos) {
            break;
        }
        size_t denominator_end = find_matching_brace(result, denominator_start);
        if (denominator_end == std::string::npos) {
            break;
        }

        std::string numerator = result.substr(numerator_start + 1, numerator_end - numerator_start - 1);
        std::string denominator = result.substr(denominator_start + 1, denominator_end - denominator_start - 1);

        result.replace(
            frac_pos,
            denominator_end - frac_pos + 1,
            "(" + numerator + ")/(" + denominator + ")"
        );

        frac_pos += numerator.size() + denominator.size() + 4;
    }

    static const std::regex pow_expr(R"(\^\{([^}]+)\})");
    result = std::regex_replace(result, pow_expr, "^($1)");

    static const std::pair<const char*, const char*> FN_MAP[] = {
        {"\\sin", "sin"},
        {"\\cos", "cos"},
        {"\\tan", "tan"},
        {"\\exp", "exp"},
        {"\\log", "log"},
        {"\\ln", "log"},
        {"\\sqrt", "sqrt"}
    };

    for (const auto& fn : FN_MAP) {
        const std::string latex_name = fn.first;
        const std::string ascii_name = fn.second;
        const std::string escaped = escape_for_regex(latex_name);

        std::regex brace_pattern(escaped + R"(\s*\{([^}]*)\})");
        result = std::regex_replace(result, brace_pattern, ascii_name + "($1)");

        std::regex paren_pattern(escaped + R"(\s*\()");
        result = std::regex_replace(result, paren_pattern, ascii_name + "(");
    }

    static const std::regex cdot_expr(R"(\s*\\cdot\s*)");
    result = std::regex_replace(result, cdot_expr, "*");

    static const std::regex times_expr(R"(\s*\\times\s*)");
    result = std::regex_replace(result, times_expr, " * ");

    static const std::regex whitespace_expr(R"(\s+)");
    result = std::regex_replace(result, whitespace_expr, " ");

    static const std::regex num_var_expr(R"((\d)\s*(x\d+))");
    result = std::regex_replace(result, num_var_expr, "$1*$2");

    static const std::regex num_fn_expr(R"((\d)\s*(sin|cos|tan|exp|log|sqrt)\s*\()");
    result = std::regex_replace(result, num_fn_expr, "$1*$2(");

    static const std::regex num_paren_expr(R"((\d)\s*\()");
    result = std::regex_replace(result, num_paren_expr, "$1*(");

    static const std::regex close_var_expr(R"((\))\s*(x\d+))");
    result = std::regex_replace(result, close_var_expr, "$1*$2");

    static const std::regex close_fn_expr(R"((\))\s*(sin|cos|tan|exp|log|sqrt)\s*\()");
    result = std::regex_replace(result, close_fn_expr, "$1*$2(");

    static const std::regex close_paren_expr(R"((\))\s*\()");
    result = std::regex_replace(result, close_paren_expr, "$1*(");

    return trim_copy(result);
}

std::vector<float> latex_to_hyperplane_coefficients(
    const std::string& src,
    size_t dimension,
    double& out_offset
) {
    ensure_length(src);

    const size_t eq_index = src.find('=');
    std::vector<std::string> parts;
    size_t pos = 0;
    while (true) {
        size_t next = src.find('=', pos);
        if (next == std::string::npos) {
            parts.push_back(trim_copy(src.substr(pos)));
            break;
        }
        parts.push_back(trim_copy(src.substr(pos, next - pos)));
        pos = next + 1;
    }

    if (parts.size() != 2) {
        throw LatexParseException(
            NDCALC_LATEX_ERROR_INVALID_INPUT,
            "Expected an equation with exactly one '='",
            0,
            src.size()
        );
    }

    const std::string& lhs_raw = parts[0];
    const std::string& rhs_raw = parts[1];

    if (lhs_raw.empty() || rhs_raw.empty()) {
        size_t empty_start = lhs_raw.empty() ? 0 : eq_index + 1;
        size_t empty_end = lhs_raw.empty() ? eq_index : src.size();
        throw LatexParseException(
            NDCALC_LATEX_ERROR_INVALID_INPUT,
            "Both sides of the equation must be non-empty",
            empty_start,
            empty_end
        );
    }

    const std::string lhs = latex_to_ascii_internal(lhs_raw);
    const std::string rhs = latex_to_ascii_internal(rhs_raw);

    std::string expr = "(" + lhs + ")-(" + rhs + ")";
    expr.erase(std::remove_if(expr.begin(), expr.end(), [](unsigned char ch) {
        return std::isspace(ch) != 0;
    }), expr.end());

    const char placeholder = '\x1D';
    while (true) {
        size_t neg_pos = expr.find("-(");
        if (neg_pos == std::string::npos) {
            break;
        }

        size_t depth = 0;
        size_t end_pos = neg_pos + 2;
        for (; end_pos < expr.size(); ++end_pos) {
            if (expr[end_pos] == '(') {
                depth += 1;
            } else if (expr[end_pos] == ')') {
                if (depth == 0) {
                    break;
                }
                depth -= 1;
            }
        }
        if (end_pos >= expr.size()) {
            throw LatexParseException(NDCALC_LATEX_ERROR_PARSE, "Unbalanced parentheses in equation", neg_pos, expr.size());
        }

        std::string inside = expr.substr(neg_pos + 2, end_pos - (neg_pos + 2));
        for (char& ch : inside) {
            if (ch == '+') {
                ch = placeholder;
            } else if (ch == '-') {
                ch = '+';
            } else if (ch == placeholder) {
                ch = '-';
            }
        }
        if (!inside.empty() && inside.front() != '+' && inside.front() != '-') {
            inside.insert(inside.begin(), '-');
        }
        for (char& ch : inside) {
            if (ch == placeholder) {
                ch = '-';
            }
        }

        expr = expr.substr(0, neg_pos) + "+" + inside + expr.substr(end_pos + 1);
    }

    expr.erase(std::remove(expr.begin(), expr.end(), '('), expr.end());
    expr.erase(std::remove(expr.begin(), expr.end(), ')'), expr.end());

    static const std::regex fraction_numbers(R"(([+-]?\d+\.?\d*)/([+-]?\d+\.?\d*))");
    std::smatch match;
    std::string processed = expr;
    while (std::regex_search(processed, match, fraction_numbers)) {
        const double numerator = std::stod(match[1].str());
        const double denominator = std::stod(match[2].str());
        if (denominator == 0.0) {
            throw LatexParseException(NDCALC_LATEX_ERROR_INVALID_INPUT, "Division by zero in fraction", 0, src.size());
        }
        std::string replacement = format_number_like_js(numerator / denominator);
        processed = match.prefix().str() + replacement + match.suffix().str();
    }

    std::string normalized = processed;
    for (size_t idx = 0; (idx = normalized.find('-', idx)) != std::string::npos; idx += 2) {
        normalized.replace(idx, 1, "+-");
    }

    std::vector<std::string> tokens;
    std::string current;
    for (char ch : normalized) {
        if (ch == '+') {
            if (!current.empty()) {
                tokens.push_back(trim_copy(current));
                current.clear();
            }
        } else {
            current.push_back(ch);
        }
    }
    if (!current.empty()) {
        tokens.push_back(trim_copy(current));
    }

    std::vector<float> coefficients(dimension, 0.0f);
    double constant = 0.0;

    static const std::regex token_pattern(R"(^([+-]?\d*\.?\d*)\*?(x(\d+))?$)");

    for (const std::string& raw_token : tokens) {
        const std::string token = trim_copy(raw_token);
        if (token.empty()) {
            continue;
        }

        std::smatch token_match;
        if (!std::regex_match(token, token_match, token_pattern)) {
            std::string cleaned = token;
            cleaned.erase(std::remove(cleaned.begin(), cleaned.end(), '('), cleaned.end());
            cleaned.erase(std::remove(cleaned.begin(), cleaned.end(), ')'), cleaned.end());
            size_t src_pos = src.find(cleaned);
            size_t start = src_pos == std::string::npos ? 0 : src_pos;
            size_t end = src_pos == std::string::npos ? src.size() : src_pos + cleaned.size();
            throw LatexParseException(
                NDCALC_LATEX_ERROR_NONLINEAR,
                "Nonlinear or unsupported term: '" + token + "'. Only linear combinations are allowed for hyperplanes.",
                start,
                end
            );
        }

        const std::string coeff_str = token_match[1].str();
        const bool has_variable = token_match[2].matched;
        const std::string var_index_str = token_match[3].str();

        double coeff = 0.0;
        if (coeff_str.empty() || coeff_str == "+") {
            coeff = 1.0;
        } else if (coeff_str == "-") {
            coeff = -1.0;
        } else {
            try {
                coeff = std::stod(coeff_str);
            } catch (...) {
                throw LatexParseException(
                    NDCALC_LATEX_ERROR_PARSE,
                    "Invalid coefficient: '" + coeff_str + "'",
                    0,
                    src.size()
                );
            }
        }

        if (has_variable) {
            const long index = std::stol(var_index_str);
            if (index <= 0 || static_cast<size_t>(index) > dimension) {
                throw LatexParseException(
                    NDCALC_LATEX_ERROR_DIMENSION,
                    "Variable index out of range: x" + std::to_string(index) + " (dimension is " + std::to_string(dimension) + ")",
                    0,
                    src.size()
                );
            }
            coefficients[static_cast<size_t>(index - 1)] += static_cast<float>(coeff);
        } else {
            if (coeff != 0.0) {
                constant += coeff;
            }
        }
    }

    out_offset = -constant;
    if (out_offset == 0.0) {
        out_offset = 0.0;
    }

    return coefficients;
}

std::vector<std::vector<double>> latex_to_matrix_internal(const std::string& src) {
    ensure_length(src);

    std::string body = src;
    replace_all(body, "\\left", "");
    replace_all(body, "\\right", "");
    replace_all(body, "\\begin{bmatrix}", "");
    replace_all(body, "\\end{bmatrix}", "");
    body = trim_copy(body);

    if (body.empty()) {
        throw LatexParseException(NDCALC_LATEX_ERROR_EMPTY, "Empty matrix", 0, src.size());
    }

    replace_all(body, "\\\\", "\n");

    std::vector<std::vector<double>> rows;
    std::stringstream row_stream(body);
    std::string row_str;
    size_t row_index = 0;
    while (std::getline(row_stream, row_str)) {
        row_str = trim_copy(row_str);
        if (row_str.empty()) {
            continue;
        }

        replace_all(row_str, "\\", " ");

        std::vector<double> row;
        const std::string col_delim = "&";
        size_t col_start = 0;
        size_t col_index = 0;

        while (true) {
            size_t col_end = row_str.find(col_delim, col_start);
            std::string cell = col_end == std::string::npos
                ? row_str.substr(col_start)
                : row_str.substr(col_start, col_end - col_start);
            cell = trim_copy(cell);

            if (cell.empty()) {
                throw LatexParseException(
                    NDCALC_LATEX_ERROR_INVALID_INPUT,
                    "Empty cell at row " + std::to_string(row_index + 1) + ", column " + std::to_string(col_index + 1)
                );
            }

            const std::string ascii = latex_to_ascii_internal(cell);

            double value = 0.0;
            bool parsed = false;
            try {
                size_t consumed = 0;
                std::string ascii_trim = trim_copy(ascii);
                value = std::stod(ascii_trim, &consumed);
                if (consumed == ascii_trim.size()) {
                    parsed = true;
                }
            } catch (...) {
                parsed = false;
            }

            if (!parsed) {
                static const std::regex numeric_ops(R"(^[\d+\-*/().\s]+$)");
                if (std::regex_match(ascii, numeric_ops)) {
                    value = evaluate_ascii_number(ascii);
                    parsed = true;
                }
            }

            if (!parsed || !std::isfinite(value)) {
                throw LatexParseException(
                    NDCALC_LATEX_ERROR_PARSE,
                    "Invalid number at row " + std::to_string(row_index + 1) + ", column " + std::to_string(col_index + 1) + ": '" + cell + "'"
                );
            }

            row.push_back(value);

            if (col_end == std::string::npos) {
                break;
            }
            col_start = col_end + col_delim.size();
            col_index += 1;
        }

        if (!row.empty()) {
            rows.push_back(std::move(row));
        }
        row_index += 1;
    }

    if (rows.empty()) {
        throw LatexParseException(NDCALC_LATEX_ERROR_EMPTY, "Matrix has no rows", 0, src.size());
    }

    const size_t column_count = rows.front().size();
    for (size_t i = 1; i < rows.size(); ++i) {
        if (rows[i].size() != column_count) {
            throw LatexParseException(
                NDCALC_LATEX_ERROR_INVALID_INPUT,
                "Inconsistent row lengths: row 1 has " + std::to_string(column_count) + " columns, row " + std::to_string(i + 1) + " has " + std::to_string(rows[i].size()) + " columns"
            );
        }
    }

    return rows;
}

void set_error_info(ndcalc_latex_error_t* out_error,
                    ndcalc_latex_status_t status,
                    const std::string& message,
                    size_t start,
                    size_t end) {
    if (!out_error) {
        return;
    }
    if (out_error->message) {
        std::free(out_error->message);
        out_error->message = nullptr;
    }
    out_error->status = status;
    out_error->start = start;
    out_error->end = end;
    out_error->message = static_cast<char*>(std::malloc(message.size() + 1));
    if (out_error->message) {
        std::memcpy(out_error->message, message.c_str(), message.size() + 1);
    }
}

char* duplicate_string(const std::string& src) {
    char* buffer = static_cast<char*>(std::malloc(src.size() + 1));
    if (!buffer) {
        return nullptr;
    }
    std::memcpy(buffer, src.c_str(), src.size() + 1);
    return buffer;
}

} // namespace

ndcalc_latex_status_t ndcalc_latex_to_ascii(
    const char* src,
    ndcalc_owned_string* out_ascii,
    ndcalc_latex_error_t* out_error
) {
    if (out_ascii) {
        out_ascii->data = nullptr;
        out_ascii->length = 0;
    }
    if (out_error) {
        out_error->status = NDCALC_LATEX_OK;
        out_error->start = 0;
        out_error->end = 0;
        out_error->message = nullptr;
    }

    if (!src) {
        set_error_info(out_error, NDCALC_LATEX_ERROR_INVALID_INPUT, "Null input", 0, 0);
        return NDCALC_LATEX_ERROR_INVALID_INPUT;
    }

    try {
        std::string ascii = latex_to_ascii_internal(src);
        if (out_ascii) {
            out_ascii->data = duplicate_string(ascii);
            if (!out_ascii->data) {
                set_error_info(out_error, NDCALC_LATEX_ERROR_INTERNAL, "Out of memory", 0, 0);
                return NDCALC_LATEX_ERROR_INTERNAL;
            }
            out_ascii->length = ascii.size();
        }
        return NDCALC_LATEX_OK;
    } catch (const LatexParseException& ex) {
        set_error_info(out_error, ex.status, ex.what(), ex.start, ex.end);
        return ex.status;
    } catch (const std::exception& ex) {
        set_error_info(out_error, NDCALC_LATEX_ERROR_INTERNAL, ex.what(), 0, 0);
        return NDCALC_LATEX_ERROR_INTERNAL;
    }
}

ndcalc_latex_status_t ndcalc_latex_to_hyperplane(
    const char* src,
    size_t dimension,
    float** out_coefficients,
    size_t* out_count,
    double* out_offset,
    ndcalc_latex_error_t* out_error
) {
    if (out_coefficients) {
        *out_coefficients = nullptr;
    }
    if (out_count) {
        *out_count = 0;
    }
    if (out_offset) {
        *out_offset = 0.0;
    }
    if (out_error) {
        out_error->status = NDCALC_LATEX_OK;
        out_error->start = 0;
        out_error->end = 0;
        out_error->message = nullptr;
    }

    if (!src) {
        set_error_info(out_error, NDCALC_LATEX_ERROR_INVALID_INPUT, "Null input", 0, 0);
        return NDCALC_LATEX_ERROR_INVALID_INPUT;
    }
    if (dimension == 0) {
        set_error_info(out_error, NDCALC_LATEX_ERROR_INVALID_INPUT, "Dimension must be greater than zero", 0, 0);
        return NDCALC_LATEX_ERROR_INVALID_INPUT;
    }

    try {
        double offset = 0.0;
        std::vector<float> coeffs = latex_to_hyperplane_coefficients(src, dimension, offset);

        if (out_coefficients) {
            float* buffer = static_cast<float*>(std::malloc(coeffs.size() * sizeof(float)));
            if (!buffer) {
                set_error_info(out_error, NDCALC_LATEX_ERROR_INTERNAL, "Out of memory", 0, 0);
                return NDCALC_LATEX_ERROR_INTERNAL;
            }
            std::memcpy(buffer, coeffs.data(), coeffs.size() * sizeof(float));
            *out_coefficients = buffer;
        }
        if (out_count) {
            *out_count = coeffs.size();
        }
        if (out_offset) {
            *out_offset = offset;
        }
        return NDCALC_LATEX_OK;
    } catch (const LatexParseException& ex) {
        set_error_info(out_error, ex.status, ex.what(), ex.start, ex.end);
        return ex.status;
    } catch (const std::exception& ex) {
        set_error_info(out_error, NDCALC_LATEX_ERROR_INTERNAL, ex.what(), 0, 0);
        return NDCALC_LATEX_ERROR_INTERNAL;
    }
}

ndcalc_latex_status_t ndcalc_latex_to_matrix(
    const char* src,
    double** out_values,
    size_t* out_rows,
    size_t* out_cols,
    ndcalc_latex_error_t* out_error
) {
    if (out_values) {
        *out_values = nullptr;
    }
    if (out_rows) {
        *out_rows = 0;
    }
    if (out_cols) {
        *out_cols = 0;
    }
    if (out_error) {
        out_error->status = NDCALC_LATEX_OK;
        out_error->start = 0;
        out_error->end = 0;
        out_error->message = nullptr;
    }

    if (!src) {
        set_error_info(out_error, NDCALC_LATEX_ERROR_INVALID_INPUT, "Null input", 0, 0);
        return NDCALC_LATEX_ERROR_INVALID_INPUT;
    }

    try {
        std::vector<std::vector<double>> matrix = latex_to_matrix_internal(src);
        if (matrix.empty()) {
            set_error_info(out_error, NDCALC_LATEX_ERROR_EMPTY, "Matrix has no rows", 0, 0);
            return NDCALC_LATEX_ERROR_EMPTY;
        }

        const size_t rows = matrix.size();
        const size_t cols = matrix.front().size();

        if (out_values) {
            double* buffer = static_cast<double*>(std::malloc(rows * cols * sizeof(double)));
            if (!buffer) {
                set_error_info(out_error, NDCALC_LATEX_ERROR_INTERNAL, "Out of memory", 0, 0);
                return NDCALC_LATEX_ERROR_INTERNAL;
            }
            for (size_t i = 0; i < rows; ++i) {
                std::memcpy(buffer + i * cols, matrix[i].data(), cols * sizeof(double));
            }
            *out_values = buffer;
        }
        if (out_rows) {
            *out_rows = rows;
        }
        if (out_cols) {
            *out_cols = cols;
        }
        return NDCALC_LATEX_OK;
    } catch (const LatexParseException& ex) {
        set_error_info(out_error, ex.status, ex.what(), ex.start, ex.end);
        return ex.status;
    } catch (const std::exception& ex) {
        set_error_info(out_error, NDCALC_LATEX_ERROR_INTERNAL, ex.what(), 0, 0);
        return NDCALC_LATEX_ERROR_INTERNAL;
    }
}

bool ndcalc_latex_validate_hyperplane(const float* coefficients, size_t count) {
    if (!coefficients || count == 0) {
        return false;
    }
    return validate_hyperplane_internal(coefficients, count);
}

ndcalc_latex_status_t ndcalc_latex_normalize_hyperplane(
    float* coefficients,
    size_t count,
    double* offset,
    ndcalc_latex_error_t* out_error
) {
    if (out_error) {
        out_error->status = NDCALC_LATEX_OK;
        out_error->start = 0;
        out_error->end = 0;
        out_error->message = nullptr;
    }

    if (!coefficients || count == 0 || !offset) {
        set_error_info(out_error, NDCALC_LATEX_ERROR_INVALID_INPUT, "Invalid hyperplane inputs", 0, 0);
        return NDCALC_LATEX_ERROR_INVALID_INPUT;
    }

    double norm_sq = 0.0;
    for (size_t i = 0; i < count; ++i) {
        norm_sq += static_cast<double>(coefficients[i]) * static_cast<double>(coefficients[i]);
    }

    if (norm_sq == 0.0) {
        set_error_info(out_error, NDCALC_LATEX_ERROR_INVALID_INPUT, "Cannot normalize zero normal vector", 0, 0);
        return NDCALC_LATEX_ERROR_INVALID_INPUT;
    }

    const double norm = std::sqrt(norm_sq);
    for (size_t i = 0; i < count; ++i) {
        coefficients[i] = static_cast<float>(coefficients[i] / norm);
    }
    *offset /= norm;

    return NDCALC_LATEX_OK;
}

void ndcalc_latex_free_string(ndcalc_owned_string* str) {
    if (!str || !str->data) {
        return;
    }
    std::free(str->data);
    str->data = nullptr;
    str->length = 0;
}

void ndcalc_latex_free_error(ndcalc_latex_error_t* err) {
    if (!err) {
        return;
    }
    if (err->message) {
        std::free(err->message);
        err->message = nullptr;
    }
    err->start = 0;
    err->end = 0;
    err->status = NDCALC_LATEX_OK;
}

void ndcalc_latex_free_float_array(float* array) {
    std::free(array);
}

void ndcalc_latex_free_double_array(double* array) {
    std::free(array);
}
