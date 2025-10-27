#include "ndcalc/autodiff.h"
#include <cmath>
#include <limits>

namespace ndcalc {

// Mathematical functions for dual numbers
Dual dual_sin(const Dual& x) {
    return Dual(std::sin(x.value), x.derivative * std::cos(x.value));
}

Dual dual_cos(const Dual& x) {
    return Dual(std::cos(x.value), -x.derivative * std::sin(x.value));
}

Dual dual_tan(const Dual& x) {
    double t = std::tan(x.value);
    return Dual(t, x.derivative * (1.0 + t * t));
}

Dual dual_exp(const Dual& x) {
    double e = std::exp(x.value);
    return Dual(e, x.derivative * e);
}

Dual dual_log(const Dual& x) {
    return Dual(std::log(x.value), x.derivative / x.value);
}

Dual dual_sqrt(const Dual& x) {
    double s = std::sqrt(x.value);
    return Dual(s, x.derivative / (2.0 * s));
}

Dual dual_abs(const Dual& x) {
    if (x.value >= 0.0) {
        return Dual(x.value, x.derivative);
    } else {
        return Dual(-x.value, -x.derivative);
    }
}

Dual dual_pow(const Dual& x, const Dual& y) {
    // d/dx[f^g] = f^g * (g' * ln(f) + g * f'/f)
    double pow_val = std::pow(x.value, y.value);
    double deriv = pow_val * (y.derivative * std::log(x.value) +
                              y.value * x.derivative / x.value);
    return Dual(pow_val, deriv);
}

AutoDiff::AutoDiff() {
    stack_.reserve(256);
}

bool AutoDiff::execute_dual(const BytecodeProgram& program,
                             const Dual* inputs,
                             size_t num_inputs,
                             Dual& result) {
    stack_.clear();

    if (num_inputs != program.num_variables()) {
        error_message_ = "Input count mismatch";
        return false;
    }

    for (const auto& inst : program.instructions()) {
        switch (inst.opcode) {
            case OpCode::PUSH_CONST:
                stack_.push_back(Dual(inst.operand.const_value, 0.0));
                break;

            case OpCode::LOAD_VAR: {
                size_t idx = inst.operand.var_index;
                if (idx >= num_inputs) {
                    error_message_ = "Variable index out of bounds";
                    return false;
                }
                stack_.push_back(inputs[idx]);
                break;
            }

            case OpCode::ADD: {
                if (stack_.size() < 2) {
                    error_message_ = "Stack underflow in ADD";
                    return false;
                }
                Dual b = stack_.back(); stack_.pop_back();
                Dual a = stack_.back(); stack_.pop_back();
                stack_.push_back(a + b);
                break;
            }

            case OpCode::SUB: {
                if (stack_.size() < 2) {
                    error_message_ = "Stack underflow in SUB";
                    return false;
                }
                Dual b = stack_.back(); stack_.pop_back();
                Dual a = stack_.back(); stack_.pop_back();
                stack_.push_back(a - b);
                break;
            }

            case OpCode::MUL: {
                if (stack_.size() < 2) {
                    error_message_ = "Stack underflow in MUL";
                    return false;
                }
                Dual b = stack_.back(); stack_.pop_back();
                Dual a = stack_.back(); stack_.pop_back();
                stack_.push_back(a * b);
                break;
            }

            case OpCode::DIV: {
                if (stack_.size() < 2) {
                    error_message_ = "Stack underflow in DIV";
                    return false;
                }
                Dual b = stack_.back(); stack_.pop_back();
                Dual a = stack_.back(); stack_.pop_back();
                if (b.value == 0.0) {
                    error_message_ = "Division by zero";
                    return false;
                }
                stack_.push_back(a / b);
                break;
            }

            case OpCode::NEG: {
                if (stack_.empty()) {
                    error_message_ = "Stack underflow in NEG";
                    return false;
                }
                stack_.back() = -stack_.back();
                break;
            }

            case OpCode::POW: {
                if (stack_.size() < 2) {
                    error_message_ = "Stack underflow in POW";
                    return false;
                }
                Dual b = stack_.back(); stack_.pop_back();
                Dual a = stack_.back(); stack_.pop_back();
                stack_.push_back(dual_pow(a, b));
                break;
            }

            case OpCode::SIN: {
                if (stack_.empty()) {
                    error_message_ = "Stack underflow in SIN";
                    return false;
                }
                stack_.back() = dual_sin(stack_.back());
                break;
            }

            case OpCode::COS: {
                if (stack_.empty()) {
                    error_message_ = "Stack underflow in COS";
                    return false;
                }
                stack_.back() = dual_cos(stack_.back());
                break;
            }

            case OpCode::TAN: {
                if (stack_.empty()) {
                    error_message_ = "Stack underflow in TAN";
                    return false;
                }
                stack_.back() = dual_tan(stack_.back());
                break;
            }

            case OpCode::EXP: {
                if (stack_.empty()) {
                    error_message_ = "Stack underflow in EXP";
                    return false;
                }
                stack_.back() = dual_exp(stack_.back());
                break;
            }

            case OpCode::LOG: {
                if (stack_.empty()) {
                    error_message_ = "Stack underflow in LOG";
                    return false;
                }
                if (stack_.back().value <= 0.0) {
                    error_message_ = "Logarithm of non-positive number";
                    return false;
                }
                stack_.back() = dual_log(stack_.back());
                break;
            }

            case OpCode::SQRT: {
                if (stack_.empty()) {
                    error_message_ = "Stack underflow in SQRT";
                    return false;
                }
                if (stack_.back().value < 0.0) {
                    error_message_ = "Square root of negative number";
                    return false;
                }
                stack_.back() = dual_sqrt(stack_.back());
                break;
            }

            case OpCode::ABS: {
                if (stack_.empty()) {
                    error_message_ = "Stack underflow in ABS";
                    return false;
                }
                stack_.back() = dual_abs(stack_.back());
                break;
            }

            case OpCode::RETURN: {
                if (stack_.size() != 1) {
                    error_message_ = "Invalid stack size at return";
                    return false;
                }
                result = stack_.back();
                return true;
            }
        }
    }

    error_message_ = "Missing return instruction";
    return false;
}

bool AutoDiff::compute_gradient(const BytecodeProgram& program,
                                 const double* inputs,
                                 size_t num_inputs,
                                 double* gradient) {
    error_message_.clear();

    if (num_inputs != program.num_variables()) {
        error_message_ = "Input count mismatch";
        return false;
    }

    std::vector<Dual> dual_inputs(num_inputs);

    // Compute partial derivative for each variable
    for (size_t i = 0; i < num_inputs; ++i) {
        // Set up dual numbers: seed the derivative for variable i
        for (size_t j = 0; j < num_inputs; ++j) {
            dual_inputs[j] = Dual(inputs[j], (i == j) ? 1.0 : 0.0);
        }

        Dual result;
        if (!execute_dual(program, dual_inputs.data(), num_inputs, result)) {
            return false;
        }

        gradient[i] = result.derivative;
    }

    return true;
}

bool AutoDiff::compute_hessian(const BytecodeProgram& program,
                                const double* inputs,
                                size_t num_inputs,
                                double* hessian) {
    error_message_.clear();

    if (num_inputs != program.num_variables()) {
        error_message_ = "Input count mismatch";
        return false;
    }

    // Nested forward-mode: For each pair (i,j), compute d²f/dx_i dx_j
    // This is simplified - a full implementation would use dual-of-dual numbers
    // For now, use finite differences on the gradient

    std::vector<double> grad_base(num_inputs);
    std::vector<double> grad_perturbed(num_inputs);
    std::vector<double> inputs_perturbed(inputs, inputs + num_inputs);
    const double h = 1e-8;

    // Compute base gradient
    if (!compute_gradient(program, inputs, num_inputs, grad_base.data())) {
        return false;
    }

    // Compute Hessian using finite differences on gradient
    for (size_t i = 0; i < num_inputs; ++i) {
        inputs_perturbed[i] = inputs[i] + h;

        if (!compute_gradient(program, inputs_perturbed.data(), num_inputs,
                             grad_perturbed.data())) {
            return false;
        }

        for (size_t j = 0; j < num_inputs; ++j) {
            hessian[i * num_inputs + j] = (grad_perturbed[j] - grad_base[j]) / h;
        }

        inputs_perturbed[i] = inputs[i];
    }

    return true;
}

} // namespace ndcalc
