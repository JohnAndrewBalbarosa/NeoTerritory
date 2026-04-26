cmake_minimum_required(VERSION 3.20)

if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
elseif(CMAKE_BUILD_TYPE STREQUAL "Debug")
    set(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} -O0 -g")
endif()

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

project(NeoTerritory LANGUAGES CXX)

set(MICROSERVICE_ROOT ${CMAKE_CURRENT_SOURCE_DIR})
set(MODULES_HEADER_ROOT ${MICROSERVICE_ROOT}/Modules/Header)
set(MODULES_SOURCE_ROOT ${MICROSERVICE_ROOT}/Modules/Source)
set(RUNTIME_ROOT ${MICROSERVICE_ROOT}/Runtime)

file(GLOB_RECURSE NEOTERRITORY_MODULE_SOURCES CONFIGURE_DEPENDS
    "${MODULES_SOURCE_ROOT}/*.cpp"
)

file(GLOB_RECURSE NEOTERRITORY_RUNTIME_SOURCES CONFIGURE_DEPENDS
    "${RUNTIME_ROOT}/*.cpp"
)

file(GLOB_RECURSE NEOTERRITORY_HEADERS CONFIGURE_DEPENDS
    "${MODULES_HEADER_ROOT}/*.hpp"
    "${MODULES_HEADER_ROOT}/*.h"
)

add_executable(NeoTerritory
    ${MICROSERVICE_ROOT}/main.cpp
    ${NEOTERRITORY_MODULE_SOURCES}
    ${NEOTERRITORY_RUNTIME_SOURCES}
    ${NEOTERRITORY_HEADERS}
)

target_include_directories(NeoTerritory PRIVATE
    ${MICROSERVICE_ROOT}
    ${MODULES_HEADER_ROOT}
    ${MODULES_SOURCE_ROOT}
)

if(MSVC)
    target_compile_options(NeoTerritory PRIVATE /W4 /permissive-)
else()
    target_compile_options(NeoTerritory PRIVATE -Wall -Wextra -Wpedantic)
    # Static-link runtime so the binary works without ucrt64 DLLs on PATH
    # (required when the backend spawns the binary from Node child_process).
    target_link_options(NeoTerritory PRIVATE -static-libgcc -static-libstdc++)
endif()
