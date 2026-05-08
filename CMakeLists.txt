
cmake_minimum_required(VERSION 3.10)

if(WIN32 AND NOT DEFINED CMAKE_CXX_COMPILER)
    set(CMAKE_C_COMPILER "C:/msys64/ucrt64/bin/gcc.exe")
    set(CMAKE_CXX_COMPILER "C:/msys64/ucrt64/bin/g++.exe")
elseif(APPLE AND NOT DEFINED CMAKE_CXX_COMPILER)
    set(CMAKE_C_COMPILER "/usr/bin/clang")
    set(CMAKE_CXX_COMPILER "/usr/bin/clang++")
elseif(UNIX AND NOT APPLE AND NOT DEFINED CMAKE_CXX_COMPILER)
    set(CMAKE_C_COMPILER "/usr/bin/gcc")
    set(CMAKE_CXX_COMPILER "/usr/bin/g++")
endif()

project(NeoTerritory)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(NEOTERRITORY_SOURCE_ROOT "Codebase/Microservice")

file(GLOB_RECURSE ALL_MODULE_SOURCES CONFIGURE_DEPENDS 
    "${NEOTERRITORY_SOURCE_ROOT}/Modules/Source/*.cpp"
    "${NEOTERRITORY_SOURCE_ROOT}/Modules/Header/*.hpp"
    "${NEOTERRITORY_SOURCE_ROOT}/Modules/Header/*.h"
)

file(GLOB_RECURSE LAYER_SOURCES CONFIGURE_DEPENDS
    "${NEOTERRITORY_SOURCE_ROOT}/Layer/*.cpp"
)

add_executable(NeoTerritory 
    "${NEOTERRITORY_SOURCE_ROOT}/main.cpp"
    ${LAYER_SOURCES}
    ${ALL_MODULE_SOURCES}
)

target_include_directories(NeoTerritory PRIVATE
    "${CMAKE_CURRENT_SOURCE_DIR}/${NEOTERRITORY_SOURCE_ROOT}/Modules/Header"
    "${CMAKE_CURRENT_SOURCE_DIR}/${NEOTERRITORY_SOURCE_ROOT}/Modules/Source"
    "${CMAKE_CURRENT_SOURCE_DIR}/${NEOTERRITORY_SOURCE_ROOT}/Modules/Header/SyntacticBrokenAST"
    "${CMAKE_CURRENT_SOURCE_DIR}/${NEOTERRITORY_SOURCE_ROOT}/Modules/Header/Creational"
    "${CMAKE_CURRENT_SOURCE_DIR}/${NEOTERRITORY_SOURCE_ROOT}/Modules/Header/Behavioural"
)
