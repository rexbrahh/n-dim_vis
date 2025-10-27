#include "ndcalc/vm.h"
#include <cmath>
#include <limits>

namespace ndcalc {

VM::VM() {
    stack_.reserve(256);
}

bool VM::execute(const BytecodeProgram& program,
                 const double* inputs,
                 size_t num_inputs,
                 double& result) {
    clear_error();
    stack_.clear();

    if (num_inputs != program.num_variables()) {
        set_error("Input count mismatch");
        return false;
    }

    for (const auto& inst : program.instructions()) {
        switch (inst.opcode) {
            case OpCode::PUSH_CONST:
                stack_.push_back(inst.operand.const_value);
                break;

            case OpCode::LOAD_VAR: {
                size_t idx = inst.operand.var_index;
                if (idx >= num_inputs) {
                    set_error("Variable index out of bounds");
                    return false;
                }
                stack_.push_back(inputs[idx]);
                break;
            }

            case OpCode::ADD: {
                if (stack_.size() < 2) {
                    set_error("Stack underflow in ADD");
                    return false;
                }
                double b = stack_.back(); stack_.pop_back();
                double a = stack_.back(); stack_.pop_back();
                stack_.push_back(a + b);
                break;
            }

            case OpCode::SUB: {
                if (stack_.size() < 2) {
                    set_error("Stack underflow in SUB");
                    return false;
                }
                double b = stack_.back(); stack_.pop_back();
                double a = stack_.back(); stack_.pop_back();
                stack_.push_back(a - b);
                break;
            }

            case OpCode::MUL: {
                if (stack_.size() < 2) {
                    set_error("Stack underflow in MUL");
                    return false;
                }
                double b = stack_.back(); stack_.pop_back();
                double a = stack_.back(); stack_.pop_back();
                stack_.push_back(a * b);
                break;
            }

            case OpCode::DIV: {
                if (stack_.size() < 2) {
                    set_error("Stack underflow in DIV");
                    return false;
                }
                double b = stack_.back(); stack_.pop_back();
                double a = stack_.back(); stack_.pop_back();
                if (b == 0.0) {
                    set_error("Division by zero");
                    return false;
                }
                stack_.push_back(a / b);
                break;
            }

            case OpCode::NEG: {
                if (stack_.empty()) {
                    set_error("Stack underflow in NEG");
                    return false;
                }
                stack_.back() = -stack_.back();
                break;
            }

            case OpCode::POW: {
                if (stack_.size() < 2) {
                    set_error("Stack underflow in POW");
                    return false;
                }
                double b = stack_.back(); stack_.pop_back();
                double a = stack_.back(); stack_.pop_back();
                stack_.push_back(std::pow(a, b));
                break;
            }

            case OpCode::SIN: {
                if (stack_.empty()) {
                    set_error("Stack underflow in SIN");
                    return false;
                }
                stack_.back() = std::sin(stack_.back());
                break;
            }

            case OpCode::COS: {
                if (stack_.empty()) {
                    set_error("Stack underflow in COS");
                    return false;
                }
                stack_.back() = std::cos(stack_.back());
                break;
            }

            case OpCode::TAN: {
                if (stack_.empty()) {
                    set_error("Stack underflow in TAN");
                    return false;
                }
                stack_.back() = std::tan(stack_.back());
                break;
            }

            case OpCode::EXP: {
                if (stack_.empty()) {
                    set_error("Stack underflow in EXP");
                    return false;
                }
                stack_.back() = std::exp(stack_.back());
                break;
            }

            case OpCode::LOG: {
                if (stack_.empty()) {
                    set_error("Stack underflow in LOG");
                    return false;
                }
                if (stack_.back() <= 0.0) {
                    set_error("Logarithm of non-positive number");
                    return false;
                }
                stack_.back() = std::log(stack_.back());
                break;
            }

            case OpCode::SQRT: {
                if (stack_.empty()) {
                    set_error("Stack underflow in SQRT");
                    return false;
                }
                if (stack_.back() < 0.0) {
                    set_error("Square root of negative number");
                    return false;
                }
                stack_.back() = std::sqrt(stack_.back());
                break;
            }

            case OpCode::ABS: {
                if (stack_.empty()) {
                    set_error("Stack underflow in ABS");
                    return false;
                }
                stack_.back() = std::abs(stack_.back());
                break;
            }

            case OpCode::RETURN: {
                if (stack_.size() != 1) {
                    set_error("Invalid stack size at return");
                    return false;
                }
                result = stack_.back();
                return true;
            }
        }
    }

    set_error("Missing return instruction");
    return false;
}

bool VM::execute_batch(const BytecodeProgram& program,
                       const double* const* input_arrays,
                       size_t num_variables,
                       size_t num_points,
                       double* output_array) {
    clear_error();

    if (num_variables != program.num_variables()) {
        set_error("Input count mismatch");
        return false;
    }

    std::vector<double> point_inputs(num_variables);

    for (size_t i = 0; i < num_points; ++i) {
        // Gather inputs for this point
        for (size_t v = 0; v < num_variables; ++v) {
            point_inputs[v] = input_arrays[v][i];
        }

        // Execute for this point
        if (!execute(program, point_inputs.data(), num_variables, output_array[i])) {
            return false;
        }
    }

    return true;
}

} // namespace ndcalc
