#include "ndcalc/finite_diff.h"
#include <vector>
#include <cmath>

namespace ndcalc {

FiniteDiff::FiniteDiff(double epsilon) : epsilon_(epsilon) {}

bool FiniteDiff::compute_gradient(const BytecodeProgram& program,
                                   VM& vm,
                                   const double* inputs,
                                   size_t num_inputs,
                                   double* gradient) {
    error_message_.clear();

    if (num_inputs != program.num_variables()) {
        error_message_ = "Input count mismatch";
        return false;
    }

    std::vector<double> inputs_plus(inputs, inputs + num_inputs);
    std::vector<double> inputs_minus(inputs, inputs + num_inputs);

    double f_plus, f_minus;

    // Central difference for each variable
    for (size_t i = 0; i < num_inputs; ++i) {
        // f(x + h*e_i)
        inputs_plus[i] = inputs[i] + epsilon_;
        if (!vm.execute(program, inputs_plus.data(), num_inputs, f_plus)) {
            error_message_ = "Failed to evaluate at perturbed point (+): " + vm.get_error();
            return false;
        }

        // f(x - h*e_i)
        inputs_minus[i] = inputs[i] - epsilon_;
        if (!vm.execute(program, inputs_minus.data(), num_inputs, f_minus)) {
            error_message_ = "Failed to evaluate at perturbed point (-): " + vm.get_error();
            return false;
        }

        // Central difference: (f(x+h) - f(x-h)) / (2h)
        gradient[i] = (f_plus - f_minus) / (2.0 * epsilon_);

        // Restore inputs
        inputs_plus[i] = inputs[i];
        inputs_minus[i] = inputs[i];
    }

    return true;
}

bool FiniteDiff::compute_hessian(const BytecodeProgram& program,
                                  VM& vm,
                                  const double* inputs,
                                  size_t num_inputs,
                                  double* hessian) {
    error_message_.clear();

    if (num_inputs != program.num_variables()) {
        error_message_ = "Input count mismatch";
        return false;
    }

    std::vector<double> inputs_perturbed(inputs, inputs + num_inputs);
    double f_base, f_i_plus, f_i_minus, f_j_plus, f_j_minus, f_ij;

    // Compute base value
    if (!vm.execute(program, inputs, num_inputs, f_base)) {
        error_message_ = "Failed to evaluate at base point: " + vm.get_error();
        return false;
    }

    // Compute Hessian using finite differences
    for (size_t i = 0; i < num_inputs; ++i) {
        // Diagonal elements: H_ii = (f(x+h*e_i) - 2*f(x) + f(x-h*e_i)) / h²
        inputs_perturbed[i] = inputs[i] + epsilon_;
        if (!vm.execute(program, inputs_perturbed.data(), num_inputs, f_i_plus)) {
            error_message_ = "Failed to evaluate at perturbed point: " + vm.get_error();
            return false;
        }

        inputs_perturbed[i] = inputs[i] - epsilon_;
        if (!vm.execute(program, inputs_perturbed.data(), num_inputs, f_i_minus)) {
            error_message_ = "Failed to evaluate at perturbed point: " + vm.get_error();
            return false;
        }

        hessian[i * num_inputs + i] = (f_i_plus - 2.0 * f_base + f_i_minus) / (epsilon_ * epsilon_);

        inputs_perturbed[i] = inputs[i];

        // Off-diagonal elements: H_ij = (f(x+h*e_i+h*e_j) - f(x+h*e_i) - f(x+h*e_j) + f(x)) / h²
        for (size_t j = i + 1; j < num_inputs; ++j) {
            // f(x + h*e_i + h*e_j)
            inputs_perturbed[i] = inputs[i] + epsilon_;
            inputs_perturbed[j] = inputs[j] + epsilon_;
            if (!vm.execute(program, inputs_perturbed.data(), num_inputs, f_ij)) {
                error_message_ = "Failed to evaluate at perturbed point: " + vm.get_error();
                return false;
            }

            // f(x + h*e_j)
            inputs_perturbed[i] = inputs[i];
            inputs_perturbed[j] = inputs[j] + epsilon_;
            if (!vm.execute(program, inputs_perturbed.data(), num_inputs, f_j_plus)) {
                error_message_ = "Failed to evaluate at perturbed point: " + vm.get_error();
                return false;
            }

            // Mixed partial
            double h_ij = (f_ij - f_i_plus - f_j_plus + f_base) / (epsilon_ * epsilon_);
            hessian[i * num_inputs + j] = h_ij;
            hessian[j * num_inputs + i] = h_ij; // Symmetry

            inputs_perturbed[j] = inputs[j];
        }
    }

    return true;
}

} // namespace ndcalc
