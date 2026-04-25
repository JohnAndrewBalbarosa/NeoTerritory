#pragma once

#include <cstddef>
#include <string>
#include <vector>

struct ParseTreeNode;

struct PatternTemplateNode
{
    std::string                      kind;
    std::string                      binding;
    std::vector<PatternTemplateNode> children;
};

struct PatternScaffold
{
    std::string         name;
    PatternTemplateNode root;
};

struct PatternStructureChecker
{
    std::string         name;
    PatternTemplateNode root;
};

PatternScaffold build_behavioural_function_scaffold();

PatternStructureChecker build_behavioural_structure_checker();
