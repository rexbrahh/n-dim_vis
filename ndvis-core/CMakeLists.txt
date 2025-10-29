cmake_minimum_required(VERSION 3.22)
project(ndvis-core LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

set(NDCALC_BUILD_TESTS OFF CACHE BOOL "" FORCE)
add_subdirectory(${CMAKE_CURRENT_SOURCE_DIR}/../ndcalc-core ${CMAKE_BINARY_DIR}/ndcalc-core)

add_library(ndvis-core STATIC
  src/api.cpp
  src/geometry.cpp
  src/rotations.cpp
  src/projection.cpp
  src/qr.cpp
  src/pca.cpp
  src/jacobi.cpp
  src/hyperplane.cpp
  src/overlays.cpp
)

target_include_directories(ndvis-core
  PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_link_libraries(ndvis-core
  PUBLIC
    ndcalc
)

include(CTest)

if(BUILD_TESTING)
  add_executable(ndvis-core-tests
    tests/core_tests.cpp
  )
  target_link_libraries(ndvis-core-tests PRIVATE ndvis-core)
  target_compile_features(ndvis-core-tests PRIVATE cxx_std_20)
  add_test(NAME ndvis-core-tests COMMAND ndvis-core-tests)
endif()
