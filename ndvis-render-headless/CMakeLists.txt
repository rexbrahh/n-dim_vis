cmake_minimum_required(VERSION 3.22)
project(ndvis-render-headless LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

add_library(ndvis-render-headless STATIC
  src/renderer.cpp
)

target_include_directories(ndvis-render-headless
  PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)
