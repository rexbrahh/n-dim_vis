#include "ndcalc/compiler.h"
#include <sstream>

namespace ndcalc {

Compiler::Compiler() {}

std::unique_ptr<BytecodeProgram> Compiler::compile(const ASTNode& ast) {
    error_message_.clear();

    auto program = std::make_unique<BytecodeProgram>();

    try {
        compile_node(ast, *program);
        program->add_instruction(Instruction(OpCode::RETURN));
    } catch (const std::exception& e) {
        error_message_ = e.what();
        return nullptr;
    }

    return program;
}

void Compiler::compile_node(const ASTNode& node, BytecodeProgram& program) {
    switch (node.type) {
        case ASTNodeType::NUMBER: {
            double value = std::stod(node.value);
            program.add_instruction(Instruction(OpCode::PUSH_CONST, value));
            break;
        }

        case ASTNodeType::VARIABLE: {
            size_t index = std::stoull(node.value);
            program.add_instruction(Instruction(OpCode::LOAD_VAR, index));
            break;
        }

        case ASTNodeType::BINARY_OP: {
            if (node.children.size() != 2) {
                throw std::runtime_error("Binary operation requires exactly 2 operands");
            }

            // Compile operands
            compile_node(*node.children[0], program);
            compile_node(*node.children[1], program);

            // Emit operator instruction
            if (node.value == "+") {
                program.add_instruction(Instruction(OpCode::ADD));
            } else if (node.value == "-") {
                program.add_instruction(Instruction(OpCode::SUB));
            } else if (node.value == "*") {
                program.add_instruction(Instruction(OpCode::MUL));
            } else if (node.value == "/") {
                program.add_instruction(Instruction(OpCode::DIV));
            } else if (node.value == "^") {
                program.add_instruction(Instruction(OpCode::POW));
            } else {
                throw std::runtime_error("Unknown binary operator: " + node.value);
            }
            break;
        }

        case ASTNodeType::UNARY_OP: {
            if (node.children.size() != 1) {
                throw std::runtime_error("Unary operation requires exactly 1 operand");
            }

            compile_node(*node.children[0], program);

            if (node.value == "-") {
                program.add_instruction(Instruction(OpCode::NEG));
            } else {
                throw std::runtime_error("Unknown unary operator: " + node.value);
            }
            break;
        }

        case ASTNodeType::FUNCTION_CALL: {
            if (node.value == "sin") {
                if (node.children.size() != 1) {
                    throw std::runtime_error("sin() requires exactly 1 argument");
                }
                compile_node(*node.children[0], program);
                program.add_instruction(Instruction(OpCode::SIN));
            } else if (node.value == "cos") {
                if (node.children.size() != 1) {
                    throw std::runtime_error("cos() requires exactly 1 argument");
                }
                compile_node(*node.children[0], program);
                program.add_instruction(Instruction(OpCode::COS));
            } else if (node.value == "tan") {
                if (node.children.size() != 1) {
                    throw std::runtime_error("tan() requires exactly 1 argument");
                }
                compile_node(*node.children[0], program);
                program.add_instruction(Instruction(OpCode::TAN));
            } else if (node.value == "exp") {
                if (node.children.size() != 1) {
                    throw std::runtime_error("exp() requires exactly 1 argument");
                }
                compile_node(*node.children[0], program);
                program.add_instruction(Instruction(OpCode::EXP));
            } else if (node.value == "log") {
                if (node.children.size() != 1) {
                    throw std::runtime_error("log() requires exactly 1 argument");
                }
                compile_node(*node.children[0], program);
                program.add_instruction(Instruction(OpCode::LOG));
            } else if (node.value == "sqrt") {
                if (node.children.size() != 1) {
                    throw std::runtime_error("sqrt() requires exactly 1 argument");
                }
                compile_node(*node.children[0], program);
                program.add_instruction(Instruction(OpCode::SQRT));
            } else if (node.value == "abs") {
                if (node.children.size() != 1) {
                    throw std::runtime_error("abs() requires exactly 1 argument");
                }
                compile_node(*node.children[0], program);
                program.add_instruction(Instruction(OpCode::ABS));
            } else if (node.value == "pow") {
                if (node.children.size() != 2) {
                    throw std::runtime_error("pow() requires exactly 2 arguments");
                }
                compile_node(*node.children[0], program);
                compile_node(*node.children[1], program);
                program.add_instruction(Instruction(OpCode::POW));
            } else {
                throw std::runtime_error("Unknown function: " + node.value);
            }
            break;
        }
    }
}

} // namespace ndcalc
