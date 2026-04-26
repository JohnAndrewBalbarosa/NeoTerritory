#pragma once

#include "Analysis/Lexical/token_stream.hpp"
#include "OutputGeneration/Contracts/algorithm_pipeline.hpp"

#include <vector>

std::vector<UnitTestTarget> extract_unit_test_targets(const ClassTokenStream& class_stream);
