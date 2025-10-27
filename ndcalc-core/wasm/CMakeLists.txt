cmake_minimum_required(VERSION 3.20)

# WASM-specific compilation flags
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fno-exceptions -fno-rtti")

# WASM bindings
add_executable(ndcalc_wasm
    wasm_bindings.cpp
    ../src/parser.cpp
    ../src/bytecode.cpp
    ../src/compiler.cpp
    ../src/vm.cpp
    ../src/autodiff.cpp
    ../src/finite_diff.cpp
    ../src/api.cpp
)

target_include_directories(ndcalc_wasm PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/../include
)

# Emscripten-specific link flags
set_target_properties(ndcalc_wasm PROPERTIES
    SUFFIX ".js"
    LINK_FLAGS "\
        -s WASM=1 \
        -s EXPORTED_FUNCTIONS='[\"_malloc\",\"_free\"]' \
        -s EXPORTED_RUNTIME_METHODS='[\"ccall\",\"cwrap\",\"getValue\",\"setValue\"]' \
        -s ALLOW_MEMORY_GROWTH=1 \
        -s MODULARIZE=1 \
        -s EXPORT_ES6=1 \
        -s EXPORT_NAME='createNdcalcModule' \
        -s ENVIRONMENT='web,worker' \
        --no-entry \
        -O3"
)
