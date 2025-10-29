# From project root
WASM_OUT_DIR="ndvis-web/public/wasm"

rm -f "$WASM_OUT_DIR"/ndvis-wasm.js "$WASM_OUT_DIR"/ndvis-wasm.wasm
mkdir -p "$WASM_OUT_DIR"
emcmake cmake -S ndvis-core -B build-web
emmake make -C build-web ndvis-core

emcc \
  build-web/libndvis-core.a \
  build-web/ndcalc-core/libndcalc.a \
  -o "$WASM_OUT_DIR"/ndvis-wasm.js \
  -sWASM=1 -O3 -flto -msimd128 \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web \
  -sALLOW_MEMORY_GROWTH=1 \
  -sEXPORTED_FUNCTIONS='["_malloc","_free","_ndvis_compute_pca_with_values","_ndvis_compute_overlays","_ndvis_generate_hypercube"]' \
  -sEXPORTED_RUNTIME_METHODS=ccall,cwrap,stringToUTF8,lengthBytesUTF8 \
  -sUSE_PTHREADS=1 -sPTHREAD_POOL_SIZE=8  # optional threads; requires COOP/COEP

# Build ndcalc wasm bindings
pushd ndcalc-core/wasm >/dev/null
bash build.sh
popd >/dev/null

cp ndcalc-core/wasm/dist/ndcalc_wasm.js "$WASM_OUT_DIR"/
cp ndcalc-core/wasm/dist/ndcalc_wasm.wasm "$WASM_OUT_DIR"/
