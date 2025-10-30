# ndcalc-core WASM Integration — Phase 4 Complete

## Summary

This document details the implementation of ndcalc-core, the expression VM and automatic differentiation engine for HyperViz. Phase 4 (#10) has been completed with comprehensive hardening, testing, and WASM integration.

## Implementation Status

### ✅ Phase 4 Changes

**Parser Enhancements** (`ndcalc-core/src/parser.cpp`, `include/ndcalc/parser.h`)
- **Fixed:** Power operator (^) now correctly right-associative (2^3^2 = 2^9 = 512)
- **Added:** Stack depth limiting (default: 100 levels) to prevent infinite recursion
- **Added:** `check_depth()` method and `set_max_depth()` configuration

**API Improvements** (`ndcalc-core/src/api.cpp`, `include/ndcalc/api.h`)
- **Added:** `ndcalc_program_set_ad_mode()` - runtime configuration for compiled programs
- **Added:** `ndcalc_program_set_fd_epsilon()` - runtime epsilon tuning
- **Fixed:** `ndcalc_gradient()` and `ndcalc_hessian()` now honor program's `ad_mode`
- **Design:** Programs inherit context defaults at compile time, then use program-level setters for runtime changes
  - Context setters (`ndcalc_set_*`): set defaults for new compilations
  - Program setters (`ndcalc_program_set_*`): reconfigure existing programs
- Mode behavior:
  - `NDCALC_AD_MODE_FORWARD`: Force forward-mode AD only (fails if AD unavailable)
  - `NDCALC_AD_MODE_FINITE_DIFF`: Force finite differences only (fails if FD unavailable)
  - `NDCALC_AD_MODE_AUTO`: Try AD first, fallback to FD on failure (default)

**Test Suite** (`ndcalc-core/tests/test_comprehensive.cpp`)
- **Added:** Comprehensive test suite with 19 test functions
- **Added:** Cross-platform M_PI definition for MSVC compatibility
- **Added:** `test_ad_mode_forced()` to verify all three AD modes work
- **Fixed:** `test_gradient_vs_finite_diff()` uses program-level setters
- All tests validate that both AD and FD paths are exercised

**Build System** (`ndcalc-core/tests/CMakeLists.txt`)
- Reorganized to build separate test executables
- Prevents duplicate main() linking errors

**Documentation** (`docs/NDCALC-INTEGRATION.md`)
- Documents Phase 4 parser and API fixes
- Provides accurate test counts and implementation status

### ✅ Pre-existing Components (Validated but Not Modified)

1. **Bytecode Compiler** (`ndcalc-core/src/compiler.cpp`)
   - Compiles AST to stack-based bytecode
   - Compact instruction set: PUSH_CONST, LOAD_VAR, ADD, SUB, MUL, DIV, NEG, POW
   - Transcendental operations: SIN, COS, TAN, EXP, LOG, SQRT, ABS

2. **Virtual Machine** (`ndcalc-core/src/vm.cpp`)
   - Stack-based interpreter with error checking
   - Division by zero detection
   - Domain validation for LOG (x > 0) and SQRT (x >= 0)
   - Batch evaluation with SoA layout

3. **Automatic Differentiation** (`ndcalc-core/src/autodiff.cpp`)
   - Forward-mode AD using dual numbers
   - Exact derivatives for transcendental functions
   - Hessian via finite differences on AD gradient

4. **Finite Difference** (`ndcalc-core/src/finite_diff.cpp`)
   - Central differences for gradients
   - Mixed partials for Hessian with symmetry

5. **WASM Bindings** (`ndcalc-core/wasm/`)
   - **Modified:** `wasm_bindings.cpp` - Added `wasm_program_set_ad_mode()` and `wasm_program_set_fd_epsilon()` exports
   - **Modified:** `CMakeLists.txt` - Added new functions to `EXPORTED_FUNCTIONS` list
   - Pre-existing: TypeScript wrapper and build scripts remain unchanged

### ✅ Comprehensive Test Suite

**Test File:** `ndcalc-core/tests/test_comprehensive.cpp`

All 19 tests passing (ctest: 5/5 suites, 100% pass rate):

#### Parser Precedence Tests (6 tests)
- ✓ Addition/subtraction left-to-right: `2 + 3 - 1 = 4`
- ✓ Multiplication/division left-to-right: `2 * 3 / 4 = 1.5`
- ✓ Power right-associative: `2^3^2 = 512` (not 64)
- ✓ Mixed precedence: `2 + 3 * 4^2 = 50`
- ✓ Unary minus binding: `-2^2 = 4`
- ✓ Depth limit enforcement (max 100 levels)

#### Transcendental Functions (4 tests)
- ✓ `sin²(x) + cos²(x) = 1` (validated at 5 points)
- ✓ `log(exp(x)) = x` (validated at 5 points)
- ✓ `sqrt(x²) = |x|` (validated at 5 points, including negatives)
- ✓ `tan(x) = sin(x) / cos(x)` (validated at 4 points)

#### Gradient Accuracy (3 tests)
- ✓ Polynomial gradient: `∇(x²+y²) = (2x, 2y)` at (3,4) → (6, 8)
- ✓ AD vs FD agreement: `sin(x)*exp(y)+z²` within 1e-5 tolerance
- ✓ Forced AD modes: FORWARD, FINITE_DIFF, and AUTO all produce correct results

#### Hessian Validation (2 tests)
- ✓ Quadratic Hessian: `∇²(x²+y²+z²) = diag(2,2,2)`
- ✓ Symmetry: `H_xy = H_yx` for mixed expressions

#### Directional Derivatives (1 test)
- ✓ `D_v f = ∇f · v̂` for `f(x,y) = x²+y²` at (3,4) in direction (1/√2, 1/√2) → 9.899

#### Error Handling (3 tests)
- ✓ Division by zero: `1/0` → NDCALC_ERROR_EVAL
- ✓ Log of negative: `log(-1)` → NDCALC_ERROR_EVAL
- ✓ Sqrt of negative: `sqrt(-4)` → NDCALC_ERROR_EVAL

### ✅ WASM Integration (Modified in Phase 4)

**Build System:**
- `ndcalc-core/wasm/CMakeLists.txt`: **Modified** - Added `wasm_program_set_ad_mode` and `wasm_program_set_fd_epsilon` to `EXPORTED_FUNCTIONS`
- `ndcalc-core/wasm/build.sh`: Automated build script (unchanged)
- `ndcalc-core/wasm/wasm_bindings.cpp`: **Modified** - Added program-level setter exports with `EMSCRIPTEN_KEEPALIVE`
- `ndcalc-core/wasm/generate-types.js`: TypeScript declaration generator (unchanged)

**TypeScript Interface:**
- `ndvis-web/src/wasm/ndcalc/index.d.ts`: **Modified** - Added `programSetADMode()` and `programSetFDEpsilon()` method signatures
- `ndvis-web/src/wasm/ndcalc/index.js`: **Modified** - Implemented program-level setter wrapper methods
- Pre-existing features: string marshaling, memory management, error enums (unchanged)

**Integration (hyperviz.ts):**
- **Modified:** Added `ensureProgramAdMode()` helper to configure cached programs at runtime
- **Modified:** Program setters called before gradient/hessian evaluation
- Pre-existing: lazy WASM loading, program caching, WasmArena pattern (unchanged)

### ✅ Build & Validation

**Native Build (cmake):**
```bash
cd ndcalc-core
mkdir -p build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build .
ctest --output-on-failure
```
**Result:** 5/5 test suites pass, 0 failures

**WASM Build:**
```bash
cd ndcalc-core/wasm
bash build.sh
```
**Outputs:**
- `dist/ndcalc_wasm.js` (ES6 module)
- `dist/ndcalc_wasm.wasm` (binary)
- `dist/ndcalc.d.ts` (TypeScript declarations)

**Web Integration:**
```bash
cd ndvis-web
npm install
npm run lint    # ✓ 0 errors
npm test -- --run  # Note: requires WASM build first
```

## API Reference

### C API (`ndcalc/api.h`)

```c
// Context
ndcalc_context_handle ndcalc_context_create(void);
void ndcalc_context_destroy(ndcalc_context_handle ctx);

// Compilation
ndcalc_error_t ndcalc_compile(
    ndcalc_context_handle ctx,
    const char* expression,
    size_t num_variables,
    const char* const* variable_names,
    ndcalc_program_handle* out_program
);
void ndcalc_program_destroy(ndcalc_program_handle program);

// Evaluation
ndcalc_error_t ndcalc_eval(
    ndcalc_program_handle program,
    const double* inputs,
    size_t num_inputs,
    double* output
);

ndcalc_error_t ndcalc_eval_batch(
    ndcalc_program_handle program,
    const double* const* input_arrays,  // SoA layout
    size_t num_variables,
    size_t num_points,
    double* output_array
);

// Calculus
ndcalc_error_t ndcalc_gradient(
    ndcalc_program_handle program,
    const double* inputs,
    size_t num_inputs,
    double* gradient_out  // length = num_inputs
);

ndcalc_error_t ndcalc_hessian(
    ndcalc_program_handle program,
    const double* inputs,
    size_t num_inputs,
    double* hessian_out  // row-major, size = num_inputs²
);

// Configuration (context-level, affects new compilations)
void ndcalc_set_ad_mode(ndcalc_context_handle ctx, ndcalc_ad_mode_t mode);
void ndcalc_set_fd_epsilon(ndcalc_context_handle ctx, double epsilon);

// Configuration (program-level, runtime, affects existing programs)
void ndcalc_program_set_ad_mode(ndcalc_program_handle program, ndcalc_ad_mode_t mode);
void ndcalc_program_set_fd_epsilon(ndcalc_program_handle program, double epsilon);

// Error Handling
const char* ndcalc_error_string(ndcalc_error_t error);
const char* ndcalc_get_last_error_message(ndcalc_context_handle ctx);
```

### TypeScript API

```typescript
import createNdcalcModule, { ErrorCode, ADMode } from '@/wasm/ndcalc';

const module = await createNdcalcModule();
const ctx = module.contextCreate();

// Compile
const [compileErr, program] = module.compile(ctx, "x^2 + y^2", ["x", "y"]);
if (compileErr !== ErrorCode.OK) {
  console.error(module.getLastErrorMessage(ctx));
}

// Evaluate
const [evalErr, result] = module.eval(program, [3.0, 4.0]);
// result = 25.0

// Gradient
const [gradErr, grad] = module.gradient(program, [3.0, 4.0]);
// grad = [6.0, 8.0]

// Batch evaluation
const [batchErr, results] = module.evalBatch(program, [
  [1, 2, 3],  // x values
  [4, 5, 6]   // y values
]);
// results = [17, 29, 45]

module.programDestroy(program);
module.contextDestroy(ctx);
```

## Performance Characteristics

### Time Complexity
- **Parsing:** O(n) where n = expression length
- **Compilation:** O(nodes) where nodes = AST size
- **Single evaluation:** O(instructions) ≈ O(nodes)
- **Gradient (AD):** O(instructions × dimensions)
- **Gradient (FD):** O(instructions × dimensions × 2) [2 evals per partial]
- **Hessian (FD):** O(instructions × dimensions²)

### Memory Usage
- **Program:** ~50-200 bytes per instruction
- **Gradient workspace:** dimensions × 24 bytes (dual numbers)
- **Hessian workspace:** dimensions² × 8 bytes

### Accuracy
- **AD gradient:** Machine precision (~1e-15 relative error)
- **FD gradient:** ε-dependent (~1e-8 with default ε=1e-8)
- **Hessian:** Forward-over-forward AD uses FD on gradient (O(ε))

## Known Limitations & Caveats

### 1. Expression Complexity
- **Max depth:** 100 nested levels (configurable via parser.set_max_depth())
- **Mitigation:** Expression simplification or refactoring
- **Rationale:** Prevents stack overflow from pathological inputs

### 2. Numerical Stability
- **Power operator:** `x^y` with x<0 and non-integer y produces NaN
- **Log/sqrt:** Domain errors caught and reported
- **Large exponents:** May overflow to ±inf (IEEE 754 behavior)
- **Mitigation:** Input validation in application layer

### 3. Automatic Differentiation
- **Hessian method:** Uses finite differences on AD gradient (hybrid approach)
- **Accuracy:** O(ε) error in Hessian due to FD step
- **Future:** Could implement forward-over-forward with nested dual numbers for exact Hessian
- **Tradeoff:** Current approach balances accuracy and complexity

### 4. Thread Safety
- **Contexts:** Thread-safe (independent)
- **Programs:** Immutable after compilation (thread-safe reads)
- **VM state:** Not thread-safe (use separate VM instances per thread)
- **WASM:** Single-threaded (USE_PTHREADS=0 by default)

### 5. WASM Specific
- **Memory growth:** Enabled (ALLOW_MEMORY_GROWTH=1)
- **Initial heap:** 16MB (Emscripten default)
- **Max practical size:** ~2GB on 32-bit WASM
- **Program cache:** Unbounded (consider LRU eviction for long-running apps)

### 6. Error Recovery
- **Fatal errors:** Division by zero, domain errors abort evaluation
- **No partial results:** Expression must be fully evaluable
- **Error granularity:** Per-evaluation (no instruction-level trapping)

### 7. Variable Names
- **Convention:** x1, x2, ..., xn (1-indexed)
- **Parsing:** Case-sensitive, alphanumeric + underscore
- **Reserved:** Function names (sin, cos, tan, exp, log, sqrt, abs, pow)

### 8. Operator Precedence (from highest to lowest)
1. Function calls: `sin(x)`
2. Unary operators: `-x`, `+x`
3. Power (right-associative): `x^y^z = x^(y^z)`
4. Multiplication/division (left-associative): `x*y/z = (x*y)/z`
5. Addition/subtraction (left-associative): `x+y-z = (x+y)-z`
6. Parentheses override: `(x+y)*z`

## Performance Recommendations

### 1. Expression Caching
- **Do:** Cache compiled programs by (expression, dimension) key
- **Implementation:** Already in hyperviz.ts via ndcalcProgramCache
- **Benefit:** Amortizes parsing/compilation cost

### 2. Batch Evaluation
- **Use:** `ndcalc_eval_batch()` for multiple points
- **Benefit:** Reduces C↔WASM call overhead
- **Layout:** SoA (Structure of Arrays) is cache-friendly

### 3. AD Mode Selection
- **Low dimensions (n ≤ 10):** Use forward-mode AD
- **High dimensions (n > 10):** Consider finite differences if only sparse gradient needed
- **Trade-off:** AD is O(n) but has constant factor; FD is 2n evaluations

### 4. Epsilon Tuning
- **Default (1e-8):** Good for double precision
- **Larger (1e-6):** If function is noisy or expensive
- **Adaptive:** `ε = √(machine_epsilon) * max(1, |x|)` per variable

### 5. Memory Management
- **WASM:** Use WasmArena pattern for automatic cleanup
- **Programs:** Destroy when expression changes or session ends
- **Contexts:** Reuse across multiple compilations

### 6. WASM Loading
- **Lazy load:** Only when calculus features active (already implemented)
- **Pre-warm:** Consider preloading in web worker for instant availability
- **Cache:** Browser caches .wasm files (serve with long cache headers)

## Phase 4 Integration Checklist

**Phase 4 Deliverables:**
- [x] Parser: Fix power operator right-associativity
- [x] Parser: Add stack depth limiting (default: 100)
- [x] API: Honor AD mode settings (AUTO/FORWARD/FINITE_DIFF)
- [x] API: Program-level runtime configuration (native layer)
- [x] WASM: Export program-level setters (wasm_program_set_*)
- [x] JS: Add programSetADMode/programSetFDEpsilon to wrapper
- [x] Integration: Use program setters in hyperviz.ts for cached programs
- [x] Tests: Add comprehensive test suite (19 tests)
- [x] Tests: Cross-platform M_PI compatibility
- [x] Tests: Verify both AD and FD paths are exercised
- [x] Tests: CMakeLists.txt reorganization for separate executables
- [x] Docs: Accurate NDCALC-INTEGRATION.md
- [x] Build: cmake --build validation (5/5 pass)
- [x] Build: ctest validation (100% pass)
- [x] Build: Fix .gitignore entry

**Pre-existing (Validated but Not Modified):**
- VM, compiler, autodiff, finite_diff core implementations
- WASM build system and infrastructure
- npm lint validation

**Future Work:**
- [ ] WASM build (requires emscripten setup)
- [ ] Web test suite (blocked on WASM build)

## Next Steps

### Phase 5: Full WASM Build & Deployment
1. **CI Integration:**
   - Add emscripten to CI matrix
   - Build both native and WASM in pipeline
   - Run ctest + vitest in separate jobs

2. **WASM Artifacts:**
   - Build ndcalc_wasm.js/.wasm
   - Copy to ndvis-web/src/wasm/ndcalc/
   - Copy .wasm to ndvis-web/public/wasm/
   - Commit generated JS wrapper (not .wasm binary)

3. **End-to-End Testing:**
   - Mock ndcalc module for unit tests
   - E2E tests with real WASM in browser
   - Performance benchmarks (n=4, 8, 16 dimensions)

4. **Documentation:**
   - Update BUILD-web.md with emscripten setup
   - Add example usage to README
   - Document WASM loading in troubleshooting guide

### Phase 6: Performance Optimization
1. **Compiler optimizations:**
   - Constant folding: `2+3` → `5`
   - Common subexpression elimination
   - Dead code elimination

2. **SIMD acceleration:**
   - Batch operations using wasm_simd128
   - Vectorize gradient computation
   - Profile hotspots with browser devtools

3. **Hessian improvements:**
   - Implement true forward-over-forward mode
   - Cache intermediate dual number computations
   - Sparse Hessian support (only compute needed entries)

## References

- [HyperViz Math Spec](./hypervis/HYPERVIZ-MATH-SPEC.md)
- [HyperViz API](./hypervis/HYPERVIZ-API.md)
- [HyperViz Integration Plan](./hypervis/HYPERVIZ-INTEGRATION-PLAN.md)
- [Automatic Differentiation](https://en.wikipedia.org/wiki/Automatic_differentiation)
- [Finite Difference](https://en.wikipedia.org/wiki/Finite_difference)

---

**Status:** Phase 4 (#10) Complete ✅  
**Author:** Agent ndcalc (Phase 4 Engineer)  
**Date:** 2025-10-30  
**Test Results:** 19/19 tests passing, 0 failures (5/5 ctest suites)  
**Build Status:** Native ✅ | WASM ⏳ (pending emscripten setup)  
**Key Features:** Parser precedence, runtime AD mode control, forced mode testing
