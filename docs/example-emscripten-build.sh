# From project root
rm -f ndvis-web/src/wasm/ndvis.js ndvis-web/src/wasm/ndvis.wasm ndvis-web/src/wasm/ndvis-wasm.js ndvis-web/src/wasm/ndvis-wasm.wasm
mkdir -p ndvis-web/src/wasm
emcmake cmake -S ndvis-core -B build-web
emmake make -C build-web ndvis-core

emcc \
  build-web/libndvis-core.a \
  build-web/ndcalc-core/libndcalc.a \
  -o ndvis-web/src/wasm/ndvis-wasm.js \
  -sWASM=1 -O3 -flto -msimd128 \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web \
  -sALLOW_MEMORY_GROWTH=1 \
  -sEXPORTED_FUNCTIONS='["_malloc","_free","_ndvis_compute_pca_with_values","_ndvis_compute_overlays","_ndvis_generate_hypercube"]' \
  -sEXPORTED_RUNTIME_METHODS=ccall,cwrap,stringToUTF8,lengthBytesUTF8 \
  -sUSE_PTHREADS=1 -sPTHREAD_POOL_SIZE=8  # optional threads; requires COOP/COEP
