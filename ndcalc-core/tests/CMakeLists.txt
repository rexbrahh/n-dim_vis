cmake_minimum_required(VERSION 3.20)

# Simple test runner without external dependencies
add_executable(ndcalc_tests
    test_parser.cpp
    test_vm.cpp
    test_autodiff.cpp
    test_api.cpp
)

target_link_libraries(ndcalc_tests PRIVATE ndcalc)

# Add test
add_test(NAME ndcalc_tests COMMAND ndcalc_tests)
