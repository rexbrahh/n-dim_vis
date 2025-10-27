#ifndef NDCALC_COMPILER_H
#define NDCALC_COMPILER_H

#include "parser.h"
#include "bytecode.h"
#include <memory>

namespace ndcalc {

class Compiler {
public:
    Compiler();

    // Compile AST to bytecode
    std::unique_ptr<BytecodeProgram> compile(const ASTNode& ast);

    const std::string& get_error() const { return error_message_; }

private:
    void compile_node(const ASTNode& node, BytecodeProgram& program);

    std::string error_message_;
};

} // namespace ndcalc

#endif // NDCALC_COMPILER_H
