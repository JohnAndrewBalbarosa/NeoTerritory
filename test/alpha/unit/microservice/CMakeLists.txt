# Alpha unit tests for the C++ microservice.
#
# Strategy: do NOT relink the whole microservice into a test binary (the entry
# point is `run_syntactic_broken_ast` and pulling its full graph creates noisy
# coupling). Instead, spawn the already-built `NeoTerritory` binary against a
# small fixture and assert on (a) exit code, (b) wall-clock budget, (c) presence
# of expected artifacts. This is the same contract the Node backend uses, so
# we verify exactly what the system depends on.

cmake_minimum_required(VERSION 3.20)
project(NeoTerritoryAlphaTests LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

enable_testing()

# Resolve the microservice binary and catalog. Override with -D flags from CI.
set(MICRO_ROOT      "${CMAKE_CURRENT_SOURCE_DIR}/../../../../Codebase/Microservice"
    CACHE PATH "Microservice source root")
set(NEOTERRITORY_BIN "$ENV{NEOTERRITORY_BIN}"
    CACHE FILEPATH "Path to a built NeoTerritory binary")

if(NOT NEOTERRITORY_BIN)
    # Common build output locations
    foreach(candidate
        "${MICRO_ROOT}/build/NeoTerritory"
        "${MICRO_ROOT}/build/NeoTerritory.exe"
        "${MICRO_ROOT}/build/Release/NeoTerritory.exe"
        "${MICRO_ROOT}/out/build/x64-Release/NeoTerritory.exe")
        if(EXISTS "${candidate}")
            set(NEOTERRITORY_BIN "${candidate}")
            break()
        endif()
    endforeach()
endif()

set(CATALOG_PATH "${MICRO_ROOT}/pattern_catalog/catalog.json"
    CACHE FILEPATH "Pattern catalog JSON")
set(SAMPLE_PATH "${MICRO_ROOT}/samples/integration/all_patterns.cpp"
    CACHE FILEPATH "Sample C++ input")

add_executable(test_pipeline_smoke   test_pipeline_smoke.cpp)
add_executable(test_pattern_dispatch test_pattern_dispatch.cpp)

foreach(t test_pipeline_smoke test_pattern_dispatch)
    target_compile_definitions(${t} PRIVATE
        NT_BIN_PATH="${NEOTERRITORY_BIN}"
        NT_CATALOG_PATH="${CATALOG_PATH}"
        NT_SAMPLE_PATH="${SAMPLE_PATH}"
    )
endforeach()

add_test(NAME pipeline_smoke   COMMAND test_pipeline_smoke)
add_test(NAME pattern_dispatch COMMAND test_pattern_dispatch)

# Soft per-test wall-clock budgets. CTest will report failures if the test
# overruns. The test bodies also hard-fail on their own SLA assertions.
set_tests_properties(pipeline_smoke   PROPERTIES TIMEOUT 30)
set_tests_properties(pattern_dispatch PROPERTIES TIMEOUT 30)
