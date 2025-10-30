# WASM Testing & Overlay Buffer Plan

## Vitest strategy for `hyperviz.spec.ts`

- Add a test hook in `ndvis-web/src/wasm/hyperviz.ts` (or nearby helper) that lets the suite install a mock `NdvisModule`.
- `loadNdvis()` should resolve the injected stub before attempting to fetch the real wasm.
- The Vitest suite calls the helper to supply a lightweight JS implementation (identity projection, empty overlays) and resets it after each test.
- This keeps the tests deterministic without pulling in the compiled wasm; only fall back to skipping when the stub is unavailable.

## Overlay stitching metadata

- Extend `OverlayBuffers` in the C++ core with extra arrays to describe stitched polylines, e.g.:
  - `float** slice_offsets` (or `slice_polyline_offsets`) and `std::size_t* slice_sizes` for per-polyline start/length.
  - A capacity field (`slice_collection_capacity`) mirroring the existing `slice_capacity` semantics.
- Populate the new metadata in the CPU fallback while maintaining the current flat list for backward compatibility.
- Update the WASM bindings to expose the extra arrays (e.g., `Uint32Array` views) so the web renderer can slice the `Float32Array` without copying.
- Modify `SceneViewport` to iterate per-polyline (`positions.subarray(offset, offset + size)`) when the metadata is present.
- The WebGPU compute path can use the same layout; older callers continue to work until the renderer consumes the metadata.
