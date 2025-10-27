#include "ndcalc/bytecode.h"
#include <sstream>

namespace ndcalc {

void BytecodeProgram::add_instruction(const Instruction& inst) {
    instructions_.push_back(inst);
}

std::string BytecodeProgram::disassemble() const {
    std::ostringstream oss;
    oss << "Bytecode (variables: " << num_variables_ << "):\n";

    for (size_t i = 0; i < instructions_.size(); ++i) {
        oss << "  " << i << ": ";

        switch (instructions_[i].opcode) {
            case OpCode::PUSH_CONST:
                oss << "PUSH_CONST " << instructions_[i].operand.const_value;
                break;
            case OpCode::LOAD_VAR:
                oss << "LOAD_VAR " << instructions_[i].operand.var_index;
                break;
            case OpCode::ADD:
                oss << "ADD";
                break;
            case OpCode::SUB:
                oss << "SUB";
                break;
            case OpCode::MUL:
                oss << "MUL";
                break;
            case OpCode::DIV:
                oss << "DIV";
                break;
            case OpCode::NEG:
                oss << "NEG";
                break;
            case OpCode::POW:
                oss << "POW";
                break;
            case OpCode::SIN:
                oss << "SIN";
                break;
            case OpCode::COS:
                oss << "COS";
                break;
            case OpCode::TAN:
                oss << "TAN";
                break;
            case OpCode::EXP:
                oss << "EXP";
                break;
            case OpCode::LOG:
                oss << "LOG";
                break;
            case OpCode::SQRT:
                oss << "SQRT";
                break;
            case OpCode::ABS:
                oss << "ABS";
                break;
            case OpCode::RETURN:
                oss << "RETURN";
                break;
        }
        oss << "\n";
    }

    return oss.str();
}

} // namespace ndcalc
