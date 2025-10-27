#ifndef NDCALC_BYTECODE_H
#define NDCALC_BYTECODE_H

#include <vector>
#include <cstdint>
#include <string>

namespace ndcalc {

// Bytecode operations
enum class OpCode : uint8_t {
    // Stack operations
    PUSH_CONST,      // Push constant value
    LOAD_VAR,        // Load variable by index

    // Arithmetic
    ADD,
    SUB,
    MUL,
    DIV,
    NEG,
    POW,

    // Mathematical functions
    SIN,
    COS,
    TAN,
    EXP,
    LOG,
    SQRT,
    ABS,

    // Control
    RETURN
};

struct Instruction {
    OpCode opcode;
    union {
        double const_value;
        size_t var_index;
        size_t arg_count;
    } operand;

    Instruction(OpCode op) : opcode(op) { operand.const_value = 0.0; }
    Instruction(OpCode op, double value) : opcode(op) { operand.const_value = value; }
    Instruction(OpCode op, size_t index) : opcode(op) { operand.var_index = index; }
};

class BytecodeProgram {
public:
    BytecodeProgram() = default;

    void add_instruction(const Instruction& inst);
    const std::vector<Instruction>& instructions() const { return instructions_; }

    void set_num_variables(size_t n) { num_variables_ = n; }
    size_t num_variables() const { return num_variables_; }

    std::string disassemble() const;

private:
    std::vector<Instruction> instructions_;
    size_t num_variables_ = 0;
};

} // namespace ndcalc

#endif // NDCALC_BYTECODE_H
