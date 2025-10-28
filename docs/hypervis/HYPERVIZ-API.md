# HyperViz — API (C ABI from WASM + TypeScript surface)

## C ABI (WASM)

```c
// --- lifecycle & buffers
int hv_init(int n, int max_vertices, int max_edges);
void hv_free();

// Geometry
int hv_make_polytope(int type /*0=cube,1=simplex,2=orthoplex*/, int n);
int hv_get_vertex_count();
int hv_get_edge_count();
const float* hv_vertices_soa();   // returns pointer to SoA base (n arrays of length N)
const uint32_t* hv_edges();       // pairs (2 x E)

// Rotations & projection
void hv_set_basis3(const float* basis_nx3);
void hv_apply_givens_batch(const int* i, const int* j, const float* theta, int k);

// Hyperplane slicing
int hv_slice_hyperplane(const float* a_n, float b,
                        float* out_points /*3D*/, int max_out, int* out_count);

// Field programs
typedef int hv_prog_t;
hv_prog_t hv_compile_expr(const char* ascii);    // returns program id or <0 on error
int hv_eval_on_points(hv_prog_t p, const float* points /*Nxn SoA or AoS*/, int N, float* out);
int hv_gradient(hv_prog_t p, const double* x /* n */, double* g /* n */);
int hv_hessian(hv_prog_t p, const double* x /* n */, double* H /* nxn row-major */);

// Utilities
void hv_qr_reorthonormalize(float* R /* nxn */);
```

**Notes**
- Expressions support `+ - * / ^`, unary `-`, `sin cos tan exp log sqrt abs`, parentheses, and symbols `x1..xn`.
- `hv_compile_expr` emits a compact bytecode: `OP_ADD, OP_MUL, OP_SIN, ...` with a const pool.
- Forward‑mode AD (v1) uses dual‑number stacks to return ∇ and H efficiently for small n.

## TypeScript bindings

```ts
export interface HyperViz {
  init(n: number, caps?: { vertices?: number; edges?: number }): Promise<void>;
  makePolytope(type: "cube" | "simplex" | "orthoplex"): void;
  setBasis3(B3: Float32Array): void;
  applyGivensBatch(planes: Array<{ i: number; j: number; theta: number }>): void;

  sliceHyperplane(a: Float32Array, b: number): Float32Array;    // returns packed 3D points
  compileExpr(expr: string): number;
  evalOnPoints(prog: number, points: Float32Array, layout: "SoA" | "AoS"): Float32Array;
  gradient(prog: number, x: Float64Array): Float64Array;
  hessian(prog: number, x: Float64Array): Float64Array;
}
```

## GPU uniforms & buffers (sketch)

- `uBasis3` (n×3), `uPlanes[K]` (i,j,θ), `uLOD`, `uCamera`.
- SSBOs: `positionsN` (SoA n×N), `edges` (2×E), `sliceOut` (dynamic).
