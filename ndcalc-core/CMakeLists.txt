cmake_minimum_required(VERSION 3.20)
project(ndcalc-core VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Library sources
set(NDCALC_SOURCES
    src/parser.cpp
    src/bytecode.cpp
    src/vm.cpp
    src/autodiff.cpp
    src/finite_diff.cpp
    src/api.cpp
)

# Main library
add_library(ndcalc STATIC ${NDCALC_SOURCES})
target_include_directories(ndcalc PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

# Compiler warnings
if(MSVC)
    target_compile_options(ndcalc PRIVATE /W4)
else()
    target_compile_options(ndcalc PRIVATE -Wall -Wextra -pedantic)
endif()

# Native tests
option(NDCALC_BUILD_TESTS "Build native tests" ON)
if(NDCALC_BUILD_TESTS)
    enable_testing()
    add_subdirectory(tests)
endif()

# WASM build
option(NDCALC_BUILD_WASM "Build WASM module" OFF)
if(NDCALC_BUILD_WASM)
    add_subdirectory(wasm)
endif()
