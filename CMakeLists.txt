cmake_minimum_required(VERSION 3.10)

# Set compilers before project() command
if(WIN32 AND NOT DEFINED CMAKE_CXX_COMPILER)
    set(CMAKE_C_COMPILER "C:/msys64/ucrt64/bin/gcc.exe")
    set(CMAKE_CXX_COMPILER "C:/msys64/ucrt64/bin/g++.exe")
endif()

project(NeoTerritory)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

file(GLOB_RECURSE ALL_MODULE_SOURCES CONFIGURE_DEPENDS 
    "Project/Modules/Source/*.cpp"
    "Project/Modules/Header/*.hpp"
    "Project/Modules/Header/*.h"
)

set(BACK_SYSTEM_SOURCES "Project/Layer/Back system/syntacticBrokenAST.cpp")

add_executable(NeoTerritory 
    ${BACK_SYSTEM_SOURCES} 
    ${ALL_MODULE_SOURCES}
)

file(GLOB_RECURSE HEADER_DIRS
     LIST_DIRECTORIES true
     "${CMAKE_CURRENT_SOURCE_DIR}/Project/Modules/Header/*"
)

target_include_directories(NeoTerritory PRIVATE ${HEADER_DIRS})
