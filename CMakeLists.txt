cmake_minimum_required(VERSION 3.10)
project(NeoTerritory)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Include directories
include_directories(
    ${CMAKE_SOURCE_DIR}/Project/Modules/Header
)

# Source files from Back system
set(BACK_SYSTEM_SOURCES
    Project/Layer/Back\ system/syntacticBrokenAST.cpp
)

# Source files from Modules
file(GLOB_RECURSE MODULE_SOURCES
    Project/Modules/Source/**/*.cpp
)

# Header files from Modules
file(GLOB_RECURSE MODULE_HEADERS
    PROJECT_Modules/Header/**/*.hpp
)

# Combine all sources
set(ALL_SOURCES
    ${BACK_SYSTEM_SOURCES}
    ${MODULE_SOURCES}
)

# Create executable or library
add_executable(NeoTerritory ${ALL_SOURCES} ${MODULE_HEADERS})
