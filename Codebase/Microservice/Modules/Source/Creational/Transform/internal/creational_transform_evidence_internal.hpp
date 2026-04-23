#ifndef CREATIONAL_TRANSFORM_EVIDENCE_INTERNAL_HPP
#define CREATIONAL_TRANSFORM_EVIDENCE_INTERNAL_HPP

#include "Transform/creational_code_generator_internal.hpp"

#include <sstream>
#include <string>
#include <vector>

namespace creational_codegen_internal
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

std::vector<std::string> collect_class_signature_lines(
    const std::vector<std::string>& lines,
    const std::vector<std::string>& class_names);
std::vector<std::string> collect_method_signature_lines(
    const std::vector<std::string>& lines,
    const std::vector<std::string>& method_names);
int brace_delta(const std::string& line);
std::string retain_single_main_function(
    const std::string& code,
    const std::string& preferred_file_hint);
EvidenceScanResult scan_pattern_evidence(const std::string& source);
MonolithicClassView& ensure_class_view(
    std::vector<MonolithicClassView>& views,
    const std::string& class_name);
std::string method_name_from_chain_call(const std::string& chain_call);
std::vector<MonolithicClassView> build_class_views(
    const EvidenceScanResult& source_scan,
    const EvidenceScanResult* target_scan);
std::vector<std::string> build_source_evidence_present_lines(
    const std::vector<MonolithicClassView>& views);
std::vector<std::string> build_target_evidence_removed_lines(
    const std::vector<MonolithicClassView>& views);
std::vector<std::string> build_target_evidence_added_lines(
    const std::vector<MonolithicClassView>& views);
std::vector<std::string> build_source_type_skeleton_lines(
    const std::vector<MonolithicClassView>& views);
std::vector<std::string> build_target_type_skeleton_lines(
    const std::vector<MonolithicClassView>& views);
std::vector<std::string> build_source_callsite_skeleton_lines(
    const std::vector<MonolithicClassView>& views);
std::vector<std::string> build_target_callsite_skeleton_lines(
    const std::vector<MonolithicClassView>& views);
bool validate_monolithic_structure(
    const std::vector<std::string>& type_skeleton,
    const std::vector<std::string>& callsite_skeleton);
void append_evidence_section(
    std::ostringstream& out,
    const std::string& title,
    const std::vector<std::string>& lines);
void append_code_section(
    std::ostringstream& out,
    const std::string& title,
    const std::vector<std::string>& lines);
} // namespace creational_codegen_internal

#endif // CREATIONAL_TRANSFORM_EVIDENCE_INTERNAL_HPP
