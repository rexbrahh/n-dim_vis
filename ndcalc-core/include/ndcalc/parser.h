#ifndef NDCALC_PARSER_H
#define NDCALC_PARSER_H

#include <string>
#include <vector>
#include <memory>
#include <unordered_map>

namespace ndcalc {

// Token types
enum class TokenType {
    NUMBER,
    VARIABLE,
    OPERATOR,
    LPAREN,
    RPAREN,
    COMMA,
    FUNCTION,
    END
};

struct Token {
    TokenType type;
    std::string value;
    size_t position;
};

// AST node types
enum class ASTNodeType {
    NUMBER,
    VARIABLE,
    BINARY_OP,
    UNARY_OP,
    FUNCTION_CALL
};

struct ASTNode {
    ASTNodeType type;
    std::string value;
    std::vector<std::unique_ptr<ASTNode>> children;

    ASTNode(ASTNodeType t, std::string v = "") : type(t), value(std::move(v)) {}
};

class Parser {
public:
    Parser();

    // Parse expression into AST
    std::unique_ptr<ASTNode> parse(const std::string& expression,
                                     const std::vector<std::string>& variables);

    // Get error message if parsing failed
    const std::string& get_error() const { return error_message_; }

    // Set maximum recursion depth (default: 100)
    void set_max_depth(size_t depth) { max_depth_ = depth; }

private:
    std::vector<Token> tokenize(const std::string& expression);
    std::unique_ptr<ASTNode> parse_expression(size_t& pos, size_t depth = 0);
    std::unique_ptr<ASTNode> parse_term(size_t& pos, size_t depth = 0);
    std::unique_ptr<ASTNode> parse_factor(size_t& pos, size_t depth = 0);
    std::unique_ptr<ASTNode> parse_primary(size_t& pos, size_t depth = 0);
    
    bool check_depth(size_t depth);

    std::vector<Token> tokens_;
    std::unordered_map<std::string, size_t> variable_indices_;
    std::string error_message_;
    size_t max_depth_ = 100;
};

} // namespace ndcalc

#endif // NDCALC_PARSER_H
