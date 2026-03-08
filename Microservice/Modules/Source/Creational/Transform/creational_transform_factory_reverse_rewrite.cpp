#include "internal/creational_transform_factory_reverse_internal.hpp"
#include "Transform/creational_code_generator_internal.hpp"

#include <regex>
#include <string>

namespace creational_codegen_internal
{
namespace
{
bool match_instance_declaration_for_class(
    const std::string& line,
    const std::string& class_name,
    std::string& out_instance_name)
{
    const std::string escaped_class = escape_regex_literal(class_name);
    const std::regex declaration_regex(
        "^\\s*(?:static\\s+)?(?:const\\s+)?" +
        escaped_class +
        R"(\s*(?:\*|&)?\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:[=({][^;]*)?;\s*$)");

    std::smatch match;
    if (!std::regex_match(line, match, declaration_regex))
    {
        return false;
    }

    out_instance_name = regex_capture_or_empty(match, 1);
    return !out_instance_name.empty();
}

bool match_simple_variable_declaration(
    const std::string& line,
    std::string& out_declaration_type,
    std::string& out_variable_name)
{
    const std::regex declaration_regex(
        R"(^\s*([^;=\s][^;=]*)\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:=\s*[^;]*)?;\s*$)");

    std::smatch match;
    if (!std::regex_match(line, match, declaration_regex))
    {
        return false;
    }

    out_declaration_type = trim(regex_capture_or_empty(match, 1));
    out_variable_name = regex_capture_or_empty(match, 2);
    if (out_declaration_type.empty() || out_variable_name.empty())
    {
        return false;
    }

    const std::string lowered_type = lower(out_declaration_type);
    if (starts_with(lowered_type, "return") ||
        starts_with(lowered_type, "if") ||
        starts_with(lowered_type, "for") ||
        starts_with(lowered_type, "while") ||
        starts_with(lowered_type, "switch") ||
        starts_with(lowered_type, "case") ||
        starts_with(lowered_type, "default") ||
        starts_with(lowered_type, "delete") ||
        starts_with(lowered_type, "throw"))
    {
        return false;
    }

    return true;
}
} // namespace

bool parse_allocation_expression(
    const std::string& expression,
    AllocationExpression& out_allocation)
{
    const std::string normalized = trim(expression);
    out_allocation.expression = normalized;

    std::smatch match;
    const std::regex make_unique_regex(
        R"(\bstd\s*::\s*make_unique\s*<\s*([A-Za-z_][A-Za-z0-9_:]*)\s*>\s*\()");
    if (std::regex_search(normalized, match, make_unique_regex))
    {
        out_allocation.kind = AllocationKind::MakeUnique;
        out_allocation.concrete_type = regex_capture_or_empty(match, 1);
        return !out_allocation.concrete_type.empty();
    }

    const std::regex make_shared_regex(
        R"(\bstd\s*::\s*make_shared\s*<\s*([A-Za-z_][A-Za-z0-9_:]*)\s*>\s*\()");
    if (std::regex_search(normalized, match, make_shared_regex))
    {
        out_allocation.kind = AllocationKind::MakeShared;
        out_allocation.concrete_type = regex_capture_or_empty(match, 1);
        return !out_allocation.concrete_type.empty();
    }

    const std::regex raw_new_regex(
        R"(\bnew\s+([A-Za-z_][A-Za-z0-9_:]*)\b)");
    if (std::regex_search(normalized, match, raw_new_regex))
    {
        out_allocation.kind = AllocationKind::RawNew;
        out_allocation.concrete_type = regex_capture_or_empty(match, 1);
        return !out_allocation.concrete_type.empty();
    }

    out_allocation.kind = AllocationKind::Unknown;
    out_allocation.concrete_type.clear();
    return false;
}

bool is_auto_declaration_type(const std::string& declaration_type)
{
    const std::regex auto_regex(R"(^\s*(?:const\s+)?auto(?:\s*[&*])?\s*$)");
    return std::regex_match(declaration_type, auto_regex);
}

bool rewrite_declaration_type(
    const std::string& declaration_type,
    const AllocationExpression& allocation,
    std::string& out_declaration_type)
{
    out_declaration_type = trim(declaration_type);
    if (is_auto_declaration_type(out_declaration_type))
    {
        return true;
    }

    std::smatch match;
    if (allocation.kind == AllocationKind::MakeUnique)
    {
        const std::regex unique_ptr_regex(
            R"(^(.*\bstd\s*::\s*unique_ptr\s*<\s*)([^>]+)(\s*>.*)$)");
        if (!std::regex_match(out_declaration_type, match, unique_ptr_regex))
        {
            return false;
        }

        out_declaration_type =
            regex_capture_or_empty(match, 1) + allocation.concrete_type + regex_capture_or_empty(match, 3);
        return true;
    }

    if (allocation.kind == AllocationKind::MakeShared)
    {
        const std::regex shared_ptr_regex(
            R"(^(.*\bstd\s*::\s*shared_ptr\s*<\s*)([^>]+)(\s*>.*)$)");
        if (!std::regex_match(out_declaration_type, match, shared_ptr_regex))
        {
            return false;
        }

        out_declaration_type =
            regex_capture_or_empty(match, 1) + allocation.concrete_type + regex_capture_or_empty(match, 3);
        return true;
    }

    if (allocation.kind == AllocationKind::RawNew)
    {
        const std::regex raw_pointer_regex(
            R"(^\s*((?:const\s+)?)([A-Za-z_][A-Za-z0-9_:]*)\s*\*\s*$)");
        if (!std::regex_match(out_declaration_type, match, raw_pointer_regex))
        {
            return false;
        }

        out_declaration_type =
            regex_capture_or_empty(match, 1) + allocation.concrete_type + "*";
        return true;
    }

    return false;
}

std::unordered_map<std::string, std::string> collect_factory_instance_types(
    const std::vector<std::string>& lines,
    const std::unordered_set<std::string>& known_factory_classes)
{
    std::unordered_map<std::string, std::string> out;
    if (known_factory_classes.empty())
    {
        return out;
    }

    for (const std::string& line : lines)
    {
        for (const std::string& class_name : known_factory_classes)
        {
            std::string instance_name;
            if (!match_instance_declaration_for_class(line, class_name, instance_name))
            {
                continue;
            }
            out[instance_name] = class_name;
        }
    }

    return out;
}

std::unordered_map<std::string, std::vector<VariableDeclarationSite>> collect_variable_declaration_index(
    const std::vector<std::string>& lines)
{
    std::unordered_map<std::string, std::vector<VariableDeclarationSite>> out;
    for (size_t line_index = 0; line_index < lines.size(); ++line_index)
    {
        std::string declaration_type;
        std::string variable_name;
        if (!match_simple_variable_declaration(lines[line_index], declaration_type, variable_name))
        {
            continue;
        }

        out[variable_name].push_back(VariableDeclarationSite{declaration_type, line_index});
    }
    return out;
}

bool resolve_variable_declaration_site(
    const std::unordered_map<std::string, std::vector<VariableDeclarationSite>>& declaration_index_by_variable,
    const std::string& variable_name,
    size_t before_line_index,
    VariableDeclarationSite& out_site)
{
    const auto hit = declaration_index_by_variable.find(variable_name);
    if (hit == declaration_index_by_variable.end())
    {
        return false;
    }

    const std::vector<VariableDeclarationSite>& sites = hit->second;
    for (size_t i = sites.size(); i > 0; --i)
    {
        const VariableDeclarationSite& site = sites[i - 1];
        if (site.line_index < before_line_index)
        {
            out_site = site;
            return true;
        }
    }

    return false;
}

CallsiteDeclaration parse_factory_callsite_line(
    const std::string& line,
    size_t line_index,
    const std::unordered_map<std::string, std::string>& instance_type_by_name,
    const std::unordered_map<std::string, std::vector<VariableDeclarationSite>>& declaration_index_by_variable)
{
    CallsiteDeclaration out;
    out.callsite_line_index = line_index;

    const std::regex static_declaration_regex(
        R"(^(\s*)([^;=\s][^;=]*)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\s*::\s*create\s*\(([^;]*)\)\s*;\s*$)");
    const std::regex instance_dot_regex(
        R"(^(\s*)([^;=\s][^;=]*)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*create\s*\(([^;]*)\)\s*;\s*$)");
    const std::regex instance_arrow_regex(
        R"(^(\s*)([^;=\s][^;=]*)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\s*->\s*create\s*\(([^;]*)\)\s*;\s*$)");
    const std::regex static_assignment_regex(
        R"(^(\s*)([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\s*::\s*create\s*\(([^;]*)\)\s*;\s*$)");
    const std::regex instance_dot_assignment_regex(
        R"(^(\s*)([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*create\s*\(([^;]*)\)\s*;\s*$)");
    const std::regex instance_arrow_assignment_regex(
        R"(^(\s*)([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\s*->\s*create\s*\(([^;]*)\)\s*;\s*$)");

    std::smatch match;
    if (std::regex_match(line, match, static_declaration_regex))
    {
        out.matched = true;
        out.indent = regex_capture_or_empty(match, 1);
        out.declaration_type = trim(regex_capture_or_empty(match, 2));
        out.variable_name = regex_capture_or_empty(match, 3);
        out.factory_class_name = regex_capture_or_empty(match, 4);
        out.argument_expression = trim(regex_capture_or_empty(match, 5));
        out.invocation_form = "static_class";
        out.declaration_line_index = line_index;
        return out;
    }

    if (std::regex_match(line, match, instance_dot_regex))
    {
        out.matched = true;
        out.indent = regex_capture_or_empty(match, 1);
        out.declaration_type = trim(regex_capture_or_empty(match, 2));
        out.variable_name = regex_capture_or_empty(match, 3);
        out.factory_receiver_name = regex_capture_or_empty(match, 4);
        out.argument_expression = trim(regex_capture_or_empty(match, 5));
        out.invocation_form = "instance_dot";
        out.declaration_line_index = line_index;

        const auto hit = instance_type_by_name.find(out.factory_receiver_name);
        if (hit == instance_type_by_name.end())
        {
            out.unresolved_instance_type = true;
            return out;
        }

        out.factory_class_name = hit->second;
        return out;
    }

    if (std::regex_match(line, match, instance_arrow_regex))
    {
        out.matched = true;
        out.indent = regex_capture_or_empty(match, 1);
        out.declaration_type = trim(regex_capture_or_empty(match, 2));
        out.variable_name = regex_capture_or_empty(match, 3);
        out.factory_receiver_name = regex_capture_or_empty(match, 4);
        out.argument_expression = trim(regex_capture_or_empty(match, 5));
        out.invocation_form = "instance_arrow";
        out.declaration_line_index = line_index;

        const auto hit = instance_type_by_name.find(out.factory_receiver_name);
        if (hit == instance_type_by_name.end())
        {
            out.unresolved_instance_type = true;
            return out;
        }

        out.factory_class_name = hit->second;
        return out;
    }

    if (std::regex_match(line, match, static_assignment_regex))
    {
        out.matched = true;
        out.assignment_callsite = true;
        out.indent = regex_capture_or_empty(match, 1);
        out.variable_name = regex_capture_or_empty(match, 2);
        out.factory_class_name = regex_capture_or_empty(match, 3);
        out.argument_expression = trim(regex_capture_or_empty(match, 4));
        out.invocation_form = "static_class";

        VariableDeclarationSite declaration_site;
        if (!resolve_variable_declaration_site(
                declaration_index_by_variable,
                out.variable_name,
                line_index,
                declaration_site))
        {
            out.unresolved_result_declaration = true;
            return out;
        }

        out.declaration_type = declaration_site.declaration_type;
        out.declaration_line_index = declaration_site.line_index;
        return out;
    }

    if (std::regex_match(line, match, instance_dot_assignment_regex))
    {
        out.matched = true;
        out.assignment_callsite = true;
        out.indent = regex_capture_or_empty(match, 1);
        out.variable_name = regex_capture_or_empty(match, 2);
        out.factory_receiver_name = regex_capture_or_empty(match, 3);
        out.argument_expression = trim(regex_capture_or_empty(match, 4));
        out.invocation_form = "instance_dot";

        const auto receiver_hit = instance_type_by_name.find(out.factory_receiver_name);
        if (receiver_hit == instance_type_by_name.end())
        {
            out.unresolved_instance_type = true;
            return out;
        }
        out.factory_class_name = receiver_hit->second;

        VariableDeclarationSite declaration_site;
        if (!resolve_variable_declaration_site(
                declaration_index_by_variable,
                out.variable_name,
                line_index,
                declaration_site))
        {
            out.unresolved_result_declaration = true;
            return out;
        }

        out.declaration_type = declaration_site.declaration_type;
        out.declaration_line_index = declaration_site.line_index;
        return out;
    }

    if (std::regex_match(line, match, instance_arrow_assignment_regex))
    {
        out.matched = true;
        out.assignment_callsite = true;
        out.indent = regex_capture_or_empty(match, 1);
        out.variable_name = regex_capture_or_empty(match, 2);
        out.factory_receiver_name = regex_capture_or_empty(match, 3);
        out.argument_expression = trim(regex_capture_or_empty(match, 4));
        out.invocation_form = "instance_arrow";

        const auto receiver_hit = instance_type_by_name.find(out.factory_receiver_name);
        if (receiver_hit == instance_type_by_name.end())
        {
            out.unresolved_instance_type = true;
            return out;
        }
        out.factory_class_name = receiver_hit->second;

        VariableDeclarationSite declaration_site;
        if (!resolve_variable_declaration_site(
                declaration_index_by_variable,
                out.variable_name,
                line_index,
                declaration_site))
        {
            out.unresolved_result_declaration = true;
            return out;
        }

        out.declaration_type = declaration_site.declaration_type;
        out.declaration_line_index = declaration_site.line_index;
        return out;
    }

    return out;
}

std::string build_rewritten_callsite_line(
    const CallsiteDeclaration& callsite,
    const std::string& rewritten_declaration_type,
    const std::string& rewritten_expression)
{
    return callsite.indent + rewritten_declaration_type + " " + callsite.variable_name +
           " = " + rewritten_expression + ";";
}

std::string build_rewritten_assignment_line(
    const CallsiteDeclaration& callsite,
    const std::string& rewritten_expression)
{
    return callsite.indent + callsite.variable_name + " = " + rewritten_expression + ";";
}

bool rewrite_variable_declaration_line(
    std::string& declaration_line,
    const std::string& variable_name,
    const std::string& rewritten_declaration_type)
{
    if (variable_name.empty() || rewritten_declaration_type.empty())
    {
        return false;
    }

    const std::regex rewrite_regex(
        "^([\\s]*)([^;=\\s][^;=]*)\\s+(" +
        escape_regex_literal(variable_name) +
        R"()(\s*(?:=\s*[^;]*)?;\s*$))");
    std::smatch match;
    if (std::regex_match(declaration_line, match, rewrite_regex))
    {
        declaration_line =
            regex_capture_or_empty(match, 1) +
            rewritten_declaration_type + " " +
            variable_name +
            regex_capture_or_empty(match, 4);
        return true;
    }

    return false;
}

bool remove_unused_factory_instance_declaration(
    std::vector<std::string>& lines,
    const std::string& instance_name,
    const std::string& class_name)
{
    if (instance_name.empty() || class_name.empty())
    {
        return false;
    }

    const std::regex instance_ref_regex(
        "\\b" + escape_regex_literal(instance_name) + "\\b");

    size_t declaration_index = lines.size();
    size_t reference_count = 0;

    for (size_t i = 0; i < lines.size(); ++i)
    {
        const std::string& line = lines[i];
        if (std::regex_search(line, instance_ref_regex))
        {
            ++reference_count;
        }

        std::string declared_name;
        if (declaration_index == lines.size() &&
            match_instance_declaration_for_class(line, class_name, declared_name) &&
            declared_name == instance_name)
        {
            declaration_index = i;
        }
    }

    if (declaration_index >= lines.size() || reference_count != 1)
    {
        return false;
    }

    lines.erase(lines.begin() + static_cast<std::ptrdiff_t>(declaration_index));
    return true;
}

} // namespace creational_codegen_internal
