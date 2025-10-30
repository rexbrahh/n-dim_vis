# From project root
JS_OUT_DIR="ndvis-web/src/wasm"
WASM_OUT_DIR="ndvis-web/public/wasm"

rm -f "$JS_OUT_DIR"/ndvis-wasm.js "$JS_OUT_DIR"/ndvis-wasm.wasm "$WASM_OUT_DIR"/ndvis-wasm.wasm
mkdir -p "$JS_OUT_DIR" "$WASM_OUT_DIR"
emcmake cmake -S ndvis-core -B build-web
emmake make -C build-web ndvis-core

THREAD_FLAGS=(-sUSE_PTHREADS=0)
if [ "${NDVIS_WASM_THREADS:-0}" = "1" ]; then
  POOL_SIZE=${NDVIS_WASM_PTHREAD_POOL_SIZE:-8}
  THREAD_FLAGS=(-sUSE_PTHREADS=1 -sPTHREAD_POOL_SIZE=${POOL_SIZE})
  echo "Building ndvis wasm with pthreads enabled (pool size ${POOL_SIZE})"
else
  echo "Building ndvis wasm without pthreads (single-threaded)"
fi

emcc \
  build-web/libndvis-core.a \
  build-web/ndcalc-core/libndcalc.a \
  -o "$JS_OUT_DIR"/ndvis-wasm.js \
  -sWASM=1 -O3 -flto -msimd128 \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web \
  -sALLOW_MEMORY_GROWTH=1 \
  -sEXPORTED_FUNCTIONS='["_malloc","_free","_ndvis_compute_pca_with_values","_ndvis_compute_overlays","_ndvis_generate_hypercube"]' \
  -sEXPORTED_RUNTIME_METHODS=ccall,cwrap,stringToUTF8,lengthBytesUTF8,HEAPF32,HEAPU8,HEAPU32,HEAP32 \
  "${THREAD_FLAGS[@]}"

# Ensure the wasm sidecar lands under public/ so Vite serves it with the application/wasm MIME type.
if [ -f "$JS_OUT_DIR"/ndvis-wasm.wasm ]; then
  mv "$JS_OUT_DIR"/ndvis-wasm.wasm "$WASM_OUT_DIR"/
fi

# Build ndcalc wasm bindings
pushd ndcalc-core/wasm >/dev/null
bash build.sh
popd >/dev/null

cp ndcalc-core/wasm/dist/ndcalc_wasm.js "$JS_OUT_DIR"/ndcalc/
cp ndcalc-core/wasm/dist/ndcalc_wasm.wasm "$WASM_OUT_DIR"/
