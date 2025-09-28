# From project root
mkdir -p ndvis-web/src/wasm
emcmake cmake -S ndvis-core -B build-web
emmake make -C build-web ndvis-core

emcc \
  build-web/libndvis-core.a \
  -o ndvis-web/src/wasm/ndvis.js \
  -sWASM=1 -O3 -flto -msimd128 -sWASM_SIMD=1 \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web \
  -sALLOW_MEMORY_GROWTH=1 \
  -sEXPORTED_FUNCTIONS=_malloc,_free \
  -sEXPORTED_RUNTIME_METHODS=ccall,cwrap \
  -sUSE_PTHREADS=1 -sPTHREAD_POOL_SIZE=8  # optional threads; requires COOP/COEP

