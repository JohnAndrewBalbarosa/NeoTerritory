#ifndef CREATIONAL_CODE_GENERATOR_INTERNAL_HPP
#define CREATIONAL_CODE_GENERATOR_INTERNAL_HPP

#include "parse_tree.hpp"
#include "parse_tree_code_generator.hpp"
#include "Singleton/singleton_pattern_logic.hpp"

#include <cstddef>
#include <regex>
#include <string>
#include <unordered_map>
#include <vector>

namespace creational_codegen_internal
{
extern std::vector<TransformDecision> g_last_transform_decisions;

std::string lower(const std::string& s);
std::string trim(const std::string& input);
std::vector<std::string> split_words(const std::string& text);
bool starts_with(const std::string& text, const std::string& prefix);
size_t find_matching_brace(const std::string& text, size_t open_pos);

bool is_class_block(const ParseTreeNode& node);
bool is_function_block(const ParseTreeNode& node);
std::string class_name_from_signature(const std::string& signature);
std::string function_name_from_signature(const std::string& signature);

void inject_singleton_accessor(std::string& source, const std::string& class_name);
void rewrite_class_instantiations_to_singleton_references(std::string& source, const std::string& class_name);

std::vector<std::string> extract_crucial_class_names(
    const std::string& source,
    const std::string& source_pattern,
    const std::string& target_pattern);

TransformDecision& ensure_decision(
    std::unordered_map<std::string, TransformDecision>& decisions_by_class,
    const std::string& class_name);

void add_reason_if_missing(TransformDecision& decision, const std::string& reason);

std::vector<std::string> split_lines(const std::string& source);
std::string join_lines(const std::vector<std::string>& lines);

std::unordered_map<std::string, std::string> collect_singleton_strength_by_class(
    const CreationalTreeNode& singleton_tree);

bool is_config_method_name(const std::string& method_name);
bool is_monolithic_config_method_name(const std::string& method_name);
bool is_monolithic_build_method_name(const std::string& method_name);
bool is_build_method_name(const std::string& method_name);
bool is_operational_method_name(const std::string& method_name);

bool ends_with(const std::string& text, const std::string& suffix);
std::string strip_builder_suffix(const std::string& class_name);

void append_unique_token(std::vector<std::string>& out, const std::string& token);
void append_unique_line(std::vector<std::string>& out, const std::string& line);
void append_unique_lines(std::vector<std::string>& out, const std::vector<std::string>& lines);
std::string regex_capture_or_empty(const std::smatch& match, size_t index);

std::string build_monolithic_evidence_view(
    const std::string& source_code,
    const std::string& target_code,
    bool target_view,
    const std::string& source_pattern = "",
    const std::string& target_pattern = "");

std::string transform_to_singleton_by_class_references(
    const std::string& source,
    const std::string& source_pattern,
    const std::string& target_pattern);
std::string transform_singleton_to_builder(
    const std::string& source,
    const std::string& source_pattern,
    const std::string& target_pattern);
std::string transform_using_registered_rule(
    const std::string& source,
    const std::string& source_pattern,
    const std::string& target_pattern);
} // namespace creational_codegen_internal

#endif // CREATIONAL_CODE_GENERATOR_INTERNAL_HPP
