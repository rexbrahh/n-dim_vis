cmake_minimum_required(VERSION 3.20)

# Build comprehensive test suite
add_executable(test_comprehensive
    test_comprehensive.cpp
)

target_link_libraries(test_comprehensive PRIVATE ndcalc)

# Add test
add_test(NAME comprehensive_tests COMMAND test_comprehensive)

# Optional: Build individual test executables
add_executable(test_parser_only test_parser.cpp)
target_link_libraries(test_parser_only PRIVATE ndcalc)
add_test(NAME parser_tests COMMAND test_parser_only)

add_executable(test_vm_only test_vm.cpp)
target_link_libraries(test_vm_only PRIVATE ndcalc)
add_test(NAME vm_tests COMMAND test_vm_only)

add_executable(test_autodiff_only test_autodiff.cpp)
target_link_libraries(test_autodiff_only PRIVATE ndcalc)
add_test(NAME autodiff_tests COMMAND test_autodiff_only)

add_executable(test_api_only test_api.cpp)
target_link_libraries(test_api_only PRIVATE ndcalc)
add_test(NAME api_tests COMMAND test_api_only)
