#ifndef CREATIONAL_TRANSFORM_FACTORY_REVERSE_INTERNAL_HPP
#define CREATIONAL_TRANSFORM_FACTORY_REVERSE_INTERNAL_HPP

#include <cstddef>
#include <cstdint>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

namespace creational_codegen_internal
{
struct SourceSpan
{
    size_t begin = 0;
    size_t end = 0;
};

enum class AllocationKind
{
    Unknown,
    MakeUnique,
    MakeShared,
    RawNew,
};

struct AllocationExpression
{
    AllocationKind kind = AllocationKind::Unknown;
    std::string concrete_type;
    std::string expression;
};

struct FactoryHashLedgerEntry
{
    std::string hash_id;
    std::string creation_expression;
    std::string normalized_vital_part;
};

struct FactoryCreateMapping
{
    bool has_create_method = false;
    std::unordered_map<std::string, FactoryHashLedgerEntry> literal_to_entry;
    FactoryHashLedgerEntry default_entry;
};

struct FactoryClassModel
{
    std::string class_name;
    SourceSpan class_span;
    FactoryCreateMapping create_mapping;
};

struct FactoryRewriteStats
{
    bool create_method_missing = false;
    bool branch_map_missing = false;
    bool callsite_found = false;
    bool unresolved_instance_type = false;
    bool unresolved_result_declaration = false;
    bool non_literal_argument = false;
    bool no_matching_branch = false;
    bool unsupported_return_expression = false;
    bool allocator_declaration_mismatch = false;
    bool class_retained_due_remaining_references = false;
    size_t rewritten_callsites = 0;
    std::vector<std::string> transform_trace;
};

struct StatementSlice
{
    std::string text;
    size_t next_position = std::string::npos;
};

struct VariableDeclarationSite
{
    std::string declaration_type;
    size_t line_index = std::string::npos;
};

struct CallsiteDeclaration
{
    bool matched = false;
    std::string indent;
    std::string declaration_type;
    std::string variable_name;
    std::string factory_class_name;
    std::string factory_receiver_name;
    std::string argument_expression;
    std::string invocation_form;
    size_t callsite_line_index = std::string::npos;
    size_t declaration_line_index = std::string::npos;
    bool assignment_callsite = false;
    bool unresolved_instance_type = false;
    bool unresolved_result_declaration = false;
};

std::string escape_regex_literal(const std::string& input);
size_t find_matching_paren(const std::string& text, size_t open_paren_position);
bool is_supported_literal(const std::string& expression);
std::string normalize_literal(const std::string& expression);
std::string first_return_expression(const std::string& body_text);
std::string collapse_ascii_whitespace(const std::string& input);
std::string make_vital_part_hash_id(const std::string& normalized_vital_part);
FactoryHashLedgerEntry build_hash_ledger_entry(const std::string& creation_expression);
bool parse_parameter_name_from_signature(
    const std::string& parameter_text,
    std::string& out_parameter_name);
bool literal_from_condition(
    const std::string& condition_text,
    const std::string& parameter_name,
    std::string& out_literal);
StatementSlice statement_after_condition(const std::string& text, size_t position);
void collect_if_branch_mapping(
    const std::string& function_body,
    const std::string& parameter_name,
    FactoryCreateMapping& out_mapping);
void collect_switch_branch_mapping(
    const std::string& function_body,
    const std::string& parameter_name,
    FactoryCreateMapping& out_mapping);
void collect_top_level_default_return(
    const std::string& function_body,
    FactoryCreateMapping& out_mapping);
bool parse_create_mapping_from_class_body(
    const std::string& class_body,
    FactoryCreateMapping& out_mapping);
std::vector<FactoryClassModel> collect_factory_classes(const std::string& source);
bool parse_allocation_expression(
    const std::string& expression,
    AllocationExpression& out_allocation);
bool is_auto_declaration_type(const std::string& declaration_type);
bool rewrite_declaration_type(
    const std::string& declaration_type,
    const AllocationExpression& allocation,
    std::string& out_declaration_type);
std::unordered_map<std::string, std::string> collect_factory_instance_types(
    const std::vector<std::string>& lines,
    const std::unordered_set<std::string>& known_factory_classes);
std::unordered_map<std::string, std::vector<VariableDeclarationSite>> collect_variable_declaration_index(
    const std::vector<std::string>& lines);
bool resolve_variable_declaration_site(
    const std::unordered_map<std::string, std::vector<VariableDeclarationSite>>& declaration_index_by_variable,
    const std::string& variable_name,
    size_t before_line_index,
    VariableDeclarationSite& out_site);
CallsiteDeclaration parse_factory_callsite_line(
    const std::string& line,
    size_t line_index,
    const std::unordered_map<std::string, std::string>& instance_type_by_name,
    const std::unordered_map<std::string, std::vector<VariableDeclarationSite>>& declaration_index_by_variable);
std::string build_rewritten_callsite_line(
    const CallsiteDeclaration& callsite,
    const std::string& rewritten_declaration_type,
    const std::string& rewritten_expression);
std::string build_rewritten_assignment_line(
    const CallsiteDeclaration& callsite,
    const std::string& rewritten_expression);
bool rewrite_variable_declaration_line(
    std::string& declaration_line,
    const std::string& variable_name,
    const std::string& rewritten_declaration_type);
bool remove_unused_factory_instance_declaration(
    std::vector<std::string>& lines,
    const std::string& instance_name,
    const std::string& class_name);
bool locate_class_span_by_name(
    const std::string& source,
    const std::string& class_name,
    SourceSpan& out_span);
bool has_class_reference_outside_span(
    const std::string& source,
    const std::string& class_name,
    const SourceSpan& class_span);
void erase_span_with_trailing_newlines(std::string& source, const SourceSpan& span);
} // namespace creational_codegen_internal

#endif // CREATIONAL_TRANSFORM_FACTORY_REVERSE_INTERNAL_HPP
