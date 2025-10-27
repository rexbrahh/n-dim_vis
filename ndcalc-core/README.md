# ndcalc-core

n-dimensional calculus VM with automatic differentiation and WASM support.

## Features

- **Expression Parser**: Recursive descent parser supporting variables, operators, and mathematical functions
- **Bytecode VM**: Stack-based virtual machine for efficient expression evaluation
- **Automatic Differentiation**: Forward-mode AD for exact gradient and Hessian computation
- **Finite Differences**: Fallback numerical differentiation with configurable epsilon
- **Batch Evaluation**: SoA (Structure-of-Arrays) support for efficient multi-point evaluation
- **C API**: Clean C interface for native integration
- **WASM Export**: Full WASM module with TypeScript declarations

## Building

### Native (with tests)

```bash
mkdir build
cd build
cmake .. -DNDCALC_BUILD_TESTS=ON
make -j
ctest
```

### WASM

Requires Emscripten SDK:

```bash
cd wasm
./build.sh
```

Output: `wasm/dist/ndcalc_wasm.{js,wasm}` and TypeScript declarations.

## API Overview

### C API

```c
#include <ndcalc/api.h>

// Create context
ndcalc_context_handle ctx = ndcalc_context_create();

// Compile expression
const char* vars[] = {"x", "y"};
ndcalc_program_handle program;
ndcalc_compile(ctx, "x^2 + y^2", 2, vars, &program);

// Evaluate
double inputs[] = {3.0, 4.0};
double result;
ndcalc_eval(program, inputs, 2, &result);

// Compute gradient
double gradient[2];
ndcalc_gradient(program, inputs, 2, gradient);

// Cleanup
ndcalc_program_destroy(program);
ndcalc_context_destroy(ctx);
```

### TypeScript (WASM)

```typescript
import createNdcalcModule from './dist/index.js';

const ndcalc = await createNdcalcModule();

const ctx = ndcalc.contextCreate();
const [err, program] = ndcalc.compile(ctx, "x^2 + y^2", ["x", "y"]);

if (err === 0) {
  const [evalErr, result] = ndcalc.eval(program, [3.0, 4.0]);
  console.log("f(3,4) =", result); // 25

  const [gradErr, grad] = ndcalc.gradient(program, [3.0, 4.0]);
  console.log("∇f =", grad); // [6.0, 8.0]

  ndcalc.programDestroy(program);
}

ndcalc.contextDestroy(ctx);
```

## Supported Operations

### Operators
- Arithmetic: `+`, `-`, `*`, `/`, `^`
- Unary: `-` (negation)

### Functions
- Trigonometric: `sin`, `cos`, `tan`
- Exponential: `exp`, `log`, `sqrt`
- Other: `abs`, `pow`

## Architecture

1. **Parser** (`parser.cpp`): Tokenizes and builds AST from expression string
2. **Compiler** (`compiler.cpp`): Converts AST to bytecode instructions
3. **VM** (`vm.cpp`): Executes bytecode with double precision
4. **AutoDiff** (`autodiff.cpp`): Forward-mode AD using dual numbers
5. **FiniteDiff** (`finite_diff.cpp`): Central differences fallback
6. **API** (`api.cpp`): C interface wrapping internal components

## Integration with HyperViz

ndcalc-core provides:
- User-defined scalar/vector field evaluation
- Gradient computation for tangent plane visualization
- Hessian for curvature analysis
- Batch evaluation for level-set tracing
- Zero-copy WASM interface for browser integration

See `docs/integration-plan.md` in parent repository for full integration details.
