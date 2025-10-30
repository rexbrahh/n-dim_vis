cmake_minimum_required(VERSION 3.20)

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

target_compile_options(ndcalc_wasm PRIVATE -fexceptions -fno-rtti)

# Emscripten-specific link flags
set_target_properties(ndcalc_wasm PROPERTIES
    SUFFIX ".js"
    LINK_FLAGS "\
        -s WASM=1 \
        -s EXPORTED_FUNCTIONS='[\"_malloc\",\"_free\",\"_wasm_context_create\",\"_wasm_context_destroy\",\"_wasm_compile\",\"_wasm_program_destroy\",\"_wasm_eval\",\"_wasm_eval_batch\",\"_wasm_gradient\",\"_wasm_hessian\",\"_wasm_set_ad_mode\",\"_wasm_set_fd_epsilon\",\"_wasm_program_set_ad_mode\",\"_wasm_program_set_fd_epsilon\",\"_wasm_error_string\",\"_wasm_get_last_error_message\"]' \
        -s EXPORTED_RUNTIME_METHODS='[\"ccall\",\"cwrap\",\"getValue\",\"setValue\"]' \
        -s ALLOW_MEMORY_GROWTH=1 \
        -s DISABLE_EXCEPTION_CATCHING=0 \
        -s MODULARIZE=1 \
        -s EXPORT_ES6=1 \
        -s EXPORT_NAME='createNdcalcModule' \
        -s ENVIRONMENT='web,worker' \
        --no-entry \
        -O3"
)
