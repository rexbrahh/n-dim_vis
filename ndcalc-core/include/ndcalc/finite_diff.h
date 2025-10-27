#ifndef NDCALC_FINITE_DIFF_H
#define NDCALC_FINITE_DIFF_H

#include "bytecode.h"
#include "vm.h"
#include <vector>

namespace ndcalc {

class FiniteDiff {
public:
    FiniteDiff(double epsilon = 1e-8);

    // Compute gradient using central differences
    bool compute_gradient(const BytecodeProgram& program,
                          VM& vm,
                          const double* inputs,
                          size_t num_inputs,
                          double* gradient);

    // Compute Hessian using finite differences
    bool compute_hessian(const BytecodeProgram& program,
                         VM& vm,
                         const double* inputs,
                         size_t num_inputs,
                         double* hessian);

    void set_epsilon(double eps) { epsilon_ = eps; }
    double get_epsilon() const { return epsilon_; }

    const std::string& get_error() const { return error_message_; }

private:
    double epsilon_;
    std::string error_message_;
};

} // namespace ndcalc

#endif // NDCALC_FINITE_DIFF_H
