#include "ndcalc/parser.h"
#include <cctype>
#include <cmath>
#include <sstream>

namespace ndcalc {

Parser::Parser() {}

std::vector<Token> Parser::tokenize(const std::string& expression) {
    std::vector<Token> tokens;
    size_t pos = 0;

    while (pos < expression.length()) {
        // Skip whitespace
        if (std::isspace(expression[pos])) {
            ++pos;
            continue;
        }

        // Numbers
        if (std::isdigit(expression[pos]) || expression[pos] == '.') {
            size_t start = pos;
            while (pos < expression.length() &&
                   (std::isdigit(expression[pos]) || expression[pos] == '.' ||
                    expression[pos] == 'e' || expression[pos] == 'E' ||
                    (pos > start && (expression[pos] == '+' || expression[pos] == '-')))) {
                ++pos;
            }
            tokens.push_back({TokenType::NUMBER, expression.substr(start, pos - start), start});
            continue;
        }

        // Variables and functions
        if (std::isalpha(expression[pos]) || expression[pos] == '_') {
            size_t start = pos;
            while (pos < expression.length() &&
                   (std::isalnum(expression[pos]) || expression[pos] == '_')) {
                ++pos;
            }
            std::string name = expression.substr(start, pos - start);

            // Check if it's a known function
            if (name == "sin" || name == "cos" || name == "tan" ||
                name == "exp" || name == "log" || name == "sqrt" || name == "abs" ||
                name == "pow") {
                tokens.push_back({TokenType::FUNCTION, name, start});
            } else {
                tokens.push_back({TokenType::VARIABLE, name, start});
            }
            continue;
        }

        // Operators and delimiters
        switch (expression[pos]) {
            case '+':
            case '-':
            case '*':
            case '/':
            case '^':
                tokens.push_back({TokenType::OPERATOR, std::string(1, expression[pos]), pos});
                ++pos;
                break;
            case '(':
                tokens.push_back({TokenType::LPAREN, "(", pos});
                ++pos;
                break;
            case ')':
                tokens.push_back({TokenType::RPAREN, ")", pos});
                ++pos;
                break;
            case ',':
                tokens.push_back({TokenType::COMMA, ",", pos});
                ++pos;
                break;
            default:
                error_message_ = "Unexpected character at position " + std::to_string(pos);
                return {};
        }
    }

    tokens.push_back({TokenType::END, "", expression.length()});
    return tokens;
}

std::unique_ptr<ASTNode> Parser::parse(const std::string& expression,
                                        const std::vector<std::string>& variables) {
    error_message_.clear();
    variable_indices_.clear();

    for (size_t i = 0; i < variables.size(); ++i) {
        variable_indices_[variables[i]] = i;
    }

    tokens_ = tokenize(expression);
    if (tokens_.empty()) {
        return nullptr;
    }

    size_t pos = 0;
    auto result = parse_expression(pos, 0);

    if (result && tokens_[pos].type != TokenType::END) {
        error_message_ = "Unexpected tokens after expression";
        return nullptr;
    }

    return result;
}

bool Parser::check_depth(size_t depth) {
    if (depth >= max_depth_) {
        error_message_ = "Expression too deeply nested (max depth: " + std::to_string(max_depth_) + ")";
        return false;
    }
    return true;
}

std::unique_ptr<ASTNode> Parser::parse_expression(size_t& pos, size_t depth) {
    if (!check_depth(depth)) return nullptr;
    
    auto left = parse_term(pos, depth + 1);
    if (!left) return nullptr;

    while (pos < tokens_.size() && tokens_[pos].type == TokenType::OPERATOR &&
           (tokens_[pos].value == "+" || tokens_[pos].value == "-")) {
        std::string op = tokens_[pos].value;
        ++pos;

        auto right = parse_term(pos, depth + 1);
        if (!right) return nullptr;

        auto node = std::make_unique<ASTNode>(ASTNodeType::BINARY_OP, op);
        node->children.push_back(std::move(left));
        node->children.push_back(std::move(right));
        left = std::move(node);
    }

    return left;
}

std::unique_ptr<ASTNode> Parser::parse_term(size_t& pos, size_t depth) {
    if (!check_depth(depth)) return nullptr;
    
    auto left = parse_factor(pos, depth + 1);
    if (!left) return nullptr;

    while (pos < tokens_.size() && tokens_[pos].type == TokenType::OPERATOR &&
           (tokens_[pos].value == "*" || tokens_[pos].value == "/")) {
        std::string op = tokens_[pos].value;
        ++pos;

        auto right = parse_factor(pos, depth + 1);
        if (!right) return nullptr;

        auto node = std::make_unique<ASTNode>(ASTNodeType::BINARY_OP, op);
        node->children.push_back(std::move(left));
        node->children.push_back(std::move(right));
        left = std::move(node);
    }

    return left;
}

std::unique_ptr<ASTNode> Parser::parse_factor(size_t& pos, size_t depth) {
    if (!check_depth(depth)) return nullptr;
    
    auto left = parse_primary(pos, depth + 1);
    if (!left) return nullptr;

    // Right-associative: x^y^z = x^(y^z)
    if (pos < tokens_.size() && tokens_[pos].type == TokenType::OPERATOR &&
        tokens_[pos].value == "^") {
        ++pos;

        auto right = parse_factor(pos, depth + 1);  // Recursive for right-associativity
        if (!right) return nullptr;

        auto node = std::make_unique<ASTNode>(ASTNodeType::BINARY_OP, "^");
        node->children.push_back(std::move(left));
        node->children.push_back(std::move(right));
        return node;
    }

    return left;
}

std::unique_ptr<ASTNode> Parser::parse_primary(size_t& pos, size_t depth) {
    if (!check_depth(depth)) return nullptr;
    
    if (pos >= tokens_.size()) {
        error_message_ = "Unexpected end of expression";
        return nullptr;
    }

    // Unary minus
    if (tokens_[pos].type == TokenType::OPERATOR && tokens_[pos].value == "-") {
        ++pos;
        auto operand = parse_primary(pos, depth + 1);
        if (!operand) return nullptr;

        auto node = std::make_unique<ASTNode>(ASTNodeType::UNARY_OP, "-");
        node->children.push_back(std::move(operand));
        return node;
    }

    // Unary plus
    if (tokens_[pos].type == TokenType::OPERATOR && tokens_[pos].value == "+") {
        ++pos;
        return parse_primary(pos, depth + 1);
    }

    // Numbers
    if (tokens_[pos].type == TokenType::NUMBER) {
        auto node = std::make_unique<ASTNode>(ASTNodeType::NUMBER, tokens_[pos].value);
        ++pos;
        return node;
    }

    // Variables
    if (tokens_[pos].type == TokenType::VARIABLE) {
        std::string var_name = tokens_[pos].value;
        if (variable_indices_.find(var_name) == variable_indices_.end()) {
            error_message_ = "Unknown variable: " + var_name;
            return nullptr;
        }
        auto node = std::make_unique<ASTNode>(ASTNodeType::VARIABLE,
                                               std::to_string(variable_indices_[var_name]));
        ++pos;
        return node;
    }

    // Functions
    if (tokens_[pos].type == TokenType::FUNCTION) {
        std::string func_name = tokens_[pos].value;
        ++pos;

        if (pos >= tokens_.size() || tokens_[pos].type != TokenType::LPAREN) {
            error_message_ = "Expected '(' after function name";
            return nullptr;
        }
        ++pos;

        auto node = std::make_unique<ASTNode>(ASTNodeType::FUNCTION_CALL, func_name);

        // Parse arguments
        if (tokens_[pos].type != TokenType::RPAREN) {
            while (true) {
                auto arg = parse_expression(pos, depth + 1);
                if (!arg) return nullptr;
                node->children.push_back(std::move(arg));

                if (tokens_[pos].type == TokenType::RPAREN) {
                    break;
                } else if (tokens_[pos].type == TokenType::COMMA) {
                    ++pos;
                } else {
                    error_message_ = "Expected ',' or ')' in function call";
                    return nullptr;
                }
            }
        }
        ++pos; // consume ')'

        return node;
    }

    // Parenthesized expression
    if (tokens_[pos].type == TokenType::LPAREN) {
        ++pos;
        auto node = parse_expression(pos, depth + 1);
        if (!node) return nullptr;

        if (pos >= tokens_.size() || tokens_[pos].type != TokenType::RPAREN) {
            error_message_ = "Expected closing parenthesis";
            return nullptr;
        }
        ++pos;
        return node;
    }

    error_message_ = "Unexpected token";
    return nullptr;
}

} // namespace ndcalc
