#ifndef PARSE_TREE_CODE_GENERATOR_MONOLITHIC_INTERNAL_HPP
#define PARSE_TREE_CODE_GENERATOR_MONOLITHIC_INTERNAL_HPP

#include <string>
#include <vector>

namespace parse_tree_codegen_internal
{
struct SingletonCallsiteEvidence
{
    std::string class_name;
    std::string variable_name;
    std::vector<std::string> config_chain;
    std::vector<std::string> operational_methods;
};

struct EvidenceScanResult
{
    std::vector<std::string> lines;
    std::vector<std::string> singleton_markers;
    std::vector<std::string> builder_markers;
    std::vector<std::string> callsite_before_markers;
    std::vector<std::string> callsite_after_markers;
    std::vector<std::string> operational_markers;
    std::vector<std::string> singleton_class_names;
    std::vector<std::string> builder_class_names;
    std::vector<std::string> relevant_class_names;
    std::vector<std::string> operational_method_names;
    std::vector<SingletonCallsiteEvidence> singleton_callsites;
    std::vector<SingletonCallsiteEvidence> target_builder_callsites;
};

struct MonolithicClassView
{
    std::string class_name;
    std::string accessor_line;
    std::string static_line;
    std::string return_line;
    std::vector<std::string> config_methods;
    std::vector<std::string> operational_methods;
    std::vector<std::string> builder_setter_methods;
    std::string build_method = "build";
    std::vector<SingletonCallsiteEvidence> source_callsites;
    std::vector<SingletonCallsiteEvidence> target_callsites;
};

EvidenceScanResult scan_pattern_evidence(const std::string& source);

std::vector<MonolithicClassView> build_class_views(
    const EvidenceScanResult& source_scan,
    const EvidenceScanResult* target_scan);
} // namespace parse_tree_codegen_internal

#endif // PARSE_TREE_CODE_GENERATOR_MONOLITHIC_INTERNAL_HPP
