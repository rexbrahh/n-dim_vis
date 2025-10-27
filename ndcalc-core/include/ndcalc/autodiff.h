#ifndef NDCALC_AUTODIFF_H
#define NDCALC_AUTODIFF_H

#include "bytecode.h"
#include <vector>

namespace ndcalc {

// Dual number for forward-mode AD
struct Dual {
    double value;      // Primal value
    double derivative; // Tangent value

    Dual(double v = 0.0, double d = 0.0) : value(v), derivative(d) {}

    Dual operator+(const Dual& other) const {
        return Dual(value + other.value, derivative + other.derivative);
    }

    Dual operator-(const Dual& other) const {
        return Dual(value - other.value, derivative - other.derivative);
    }

    Dual operator*(const Dual& other) const {
        return Dual(value * other.value,
                   derivative * other.value + value * other.derivative);
    }

    Dual operator/(const Dual& other) const {
        return Dual(value / other.value,
                   (derivative * other.value - value * other.derivative) /
                   (other.value * other.value));
    }

    Dual operator-() const {
        return Dual(-value, -derivative);
    }
};

// Mathematical functions for dual numbers
Dual dual_sin(const Dual& x);
Dual dual_cos(const Dual& x);
Dual dual_tan(const Dual& x);
Dual dual_exp(const Dual& x);
Dual dual_log(const Dual& x);
Dual dual_sqrt(const Dual& x);
Dual dual_abs(const Dual& x);
Dual dual_pow(const Dual& x, const Dual& y);

class AutoDiff {
public:
    AutoDiff();

    // Compute gradient using forward-mode AD
    bool compute_gradient(const BytecodeProgram& program,
                          const double* inputs,
                          size_t num_inputs,
                          double* gradient);

    // Compute Hessian using nested forward-mode AD
    bool compute_hessian(const BytecodeProgram& program,
                         const double* inputs,
                         size_t num_inputs,
                         double* hessian);

    const std::string& get_error() const { return error_message_; }

private:
    std::vector<Dual> stack_;
    std::string error_message_;

    bool execute_dual(const BytecodeProgram& program,
                      const Dual* inputs,
                      size_t num_inputs,
                      Dual& result);
};

} // namespace ndcalc

#endif // NDCALC_AUTODIFF_H
