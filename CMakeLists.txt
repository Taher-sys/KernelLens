cmake_minimum_required(VERSION 3.20)
project(KernelLens VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Export compile commands for language servers
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Output directories
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)
set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)

# Compiler warnings
if(MSVC)
  add_compile_options(/W4 /permissive- /utf-8)
else()
  add_compile_options(-Wall -Wextra -Wpedantic)
endif()

# Include directories
include_directories(
  ${CMAKE_CURRENT_SOURCE_DIR}/engine/include
  ${CMAKE_CURRENT_SOURCE_DIR}/tests
)

# Engine library sources
file(GLOB_RECURSE ENGINE_SOURCES 
  "${CMAKE_CURRENT_SOURCE_DIR}/engine/src/*.cpp"
)

add_library(kernellens_engine STATIC ${ENGINE_SOURCES})
target_include_directories(kernellens_engine PUBLIC
  ${CMAKE_CURRENT_SOURCE_DIR}/engine/include
)

# CLI executable
if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/engine/cli/main.cpp")
  add_executable(kernellens ${CMAKE_CURRENT_SOURCE_DIR}/engine/cli/main.cpp)
  target_link_libraries(kernellens PRIVATE kernellens_engine)
endif()

# Automated Testing
option(BUILD_TESTING "Build the testing tree." ON)
if(BUILD_TESTING)
  enable_testing()
  
  # Custom standalone test runner / GoogleTest
  file(GLOB_RECURSE TEST_SOURCES "${CMAKE_CURRENT_SOURCE_DIR}/tests/*.cpp")
  if(TEST_SOURCES)
    add_executable(kernellens_tests ${TEST_SOURCES})
    target_link_libraries(kernellens_tests PRIVATE kernellens_engine)
    add_test(NAME AllTests COMMAND kernellens_tests)
  endif()
endif()

# Benchmark executable
if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/benchmarks/benchmark_main.cpp")
  add_executable(kernellens_benchmarks ${CMAKE_CURRENT_SOURCE_DIR}/benchmarks/benchmark_main.cpp)
  target_link_libraries(kernellens_benchmarks PRIVATE kernellens_engine)
endif()
