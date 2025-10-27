#ifndef NDCALC_VM_H
#define NDCALC_VM_H

#include "bytecode.h"
#include <vector>
#include <string>

namespace ndcalc {

class VM {
public:
    VM();

    // Execute program with given inputs
    bool execute(const BytecodeProgram& program,
                 const double* inputs,
                 size_t num_inputs,
                 double& result);

    // Batch execution (SoA)
    bool execute_batch(const BytecodeProgram& program,
                       const double* const* input_arrays,
                       size_t num_variables,
                       size_t num_points,
                       double* output_array);

    const std::string& get_error() const { return error_message_; }

private:
    std::vector<double> stack_;
    std::string error_message_;

    void clear_error() { error_message_.clear(); }
    void set_error(const std::string& msg) { error_message_ = msg; }
};

} // namespace ndcalc

#endif // NDCALC_VM_H
