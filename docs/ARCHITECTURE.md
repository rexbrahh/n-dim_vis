# Architecture

## Module layout

/ndvis-core/ # C++ math & geometry (SoA buffers, Givens, QR, PCA) include/ src/ tests/ CMakeLists.txt /ndvis-web/ # Web app public/ src/ gpu/ # WebGPU/WebGL setup (if using JS-driven GPU glue) wasm/ # Emscripten loader/wrappers, TS types ui/ # React panels & HUD shaders/ # WGSL (WebGPU), GLSL ES (WebGL2) vite.config.ts package.json /docs/ # This documentation bundle /ndvis-render-headless/ # Native C++ WebGPU renderer for batch export src/ CMakeLists.txt
