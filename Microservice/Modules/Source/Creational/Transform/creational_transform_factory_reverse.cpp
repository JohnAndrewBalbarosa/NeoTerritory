#include "Transform/creational_transform_factory_reverse.hpp"
#include "Transform/creational_code_generator_internal.hpp"
#include "internal/creational_transform_factory_reverse_internal.hpp"

#include <algorithm>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

namespace creational_codegen_internal
{
FactoryReverseTransformResult transform_factory_to_base_by_direct_instantiation(
    const std::string& source)
{
    FactoryReverseTransformResult out;
    out.transformed_source = source;

    std::vector<FactoryClassModel> factory_classes = collect_factory_classes(source);
    if (factory_classes.empty())
    {
        return out;
    }

    std::unordered_map<std::string, FactoryClassModel> class_by_name;
    std::unordered_map<std::string, FactoryRewriteStats> stats_by_name;
    std::unordered_set<std::string> known_factory_classes;
    for (const FactoryClassModel& model : factory_classes)
    {
        class_by_name[model.class_name] = model;
        known_factory_classes.insert(model.class_name);

        FactoryRewriteStats& stats = stats_by_name[model.class_name];
        stats.create_method_missing = !model.create_mapping.has_create_method;
        stats.branch_map_missing =
            model.create_mapping.literal_to_entry.empty() &&
            model.create_mapping.default_entry.creation_expression.empty();

        std::vector<std::string> literals;
        literals.reserve(model.create_mapping.literal_to_entry.size());
        for (const auto& entry : model.create_mapping.literal_to_entry)
        {
            literals.push_back(entry.first);
        }
        std::sort(literals.begin(), literals.end());

        for (const std::string& literal : literals)
        {
            const FactoryHashLedgerEntry& ledger = model.create_mapping.literal_to_entry.at(literal);
            stats.transform_trace.push_back(
                "ledger_literal=" + literal +
                ";hash_id=" + ledger.hash_id +
                ";creation=" + ledger.creation_expression +
                ";vital=" + ledger.normalized_vital_part);
        }

        if (!model.create_mapping.default_entry.creation_expression.empty())
        {
            const FactoryHashLedgerEntry& ledger = model.create_mapping.default_entry;
            stats.transform_trace.push_back(
                "ledger_default=true"
                ";hash_id=" + ledger.hash_id +
                ";creation=" + ledger.creation_expression +
                ";vital=" + ledger.normalized_vital_part);
        }
    }

    std::vector<std::string> lines = split_lines(out.transformed_source);
    const std::unordered_map<std::string, std::string> instance_type_by_name =
        collect_factory_instance_types(lines, known_factory_classes);
    const std::unordered_map<std::string, std::vector<VariableDeclarationSite>> declaration_index_by_variable =
        collect_variable_declaration_index(lines);
    std::unordered_map<std::string, std::string> rewritten_instance_receivers;

    for (size_t line_index = 0; line_index < lines.size(); ++line_index)
    {
        std::string& line = lines[line_index];
        const CallsiteDeclaration callsite =
            parse_factory_callsite_line(
                line,
                line_index,
                instance_type_by_name,
                declaration_index_by_variable);
        if (!callsite.matched)
        {
            continue;
        }

        if (callsite.unresolved_instance_type)
        {
            if (known_factory_classes.size() == 1)
            {
                const std::string class_name = *known_factory_classes.begin();
                FactoryRewriteStats& stats = stats_by_name[class_name];
                stats.callsite_found = true;
                stats.unresolved_instance_type = true;
                stats.transform_trace.push_back(
                    "callsite_line=" + std::to_string(line_index + 1) +
                    ";invocation=" + callsite.invocation_form +
                    ";receiver=" + callsite.factory_receiver_name +
                    ";status=unresolved_instance_type");
            }
            continue;
        }

        const auto class_hit = class_by_name.find(callsite.factory_class_name);
        if (class_hit == class_by_name.end())
        {
            continue;
        }

        FactoryRewriteStats& stats = stats_by_name[callsite.factory_class_name];
        stats.callsite_found = true;
        const std::string raw_argument_token = trim(callsite.argument_expression);
        const std::string phase1_arg_hash_id =
            raw_argument_token.empty() ? "" : make_fnv1a64_hash_id(raw_argument_token);

        if (callsite.unresolved_result_declaration)
        {
            stats.unresolved_result_declaration = true;
            stats.transform_trace.push_back(
                "callsite_line=" + std::to_string(line_index + 1) +
                ";invocation=" + callsite.invocation_form +
                ";variable=" + callsite.variable_name +
                ";status=unresolved_result_declaration");
            continue;
        }

        if (!is_supported_literal(callsite.argument_expression))
        {
            stats.non_literal_argument = true;
            stats.transform_trace.push_back(
                "callsite_line=" + std::to_string(line_index + 1) +
                ";invocation=" + callsite.invocation_form +
                ";argument=" + raw_argument_token +
                ";phase1_arg_hash=" + phase1_arg_hash_id +
                ";status=non_literal_argument");
            continue;
        }

        const std::string normalized_literal = normalize_literal(callsite.argument_expression);
        const FactoryCreateMapping& mapping = class_hit->second.create_mapping;

        FactoryHashLedgerEntry selected_entry;
        bool matched_entry = false;
        const auto literal_hit = mapping.literal_to_entry.find(normalized_literal);
        if (literal_hit != mapping.literal_to_entry.end())
        {
            selected_entry = literal_hit->second;
            matched_entry = true;
        }
        else if (!mapping.default_entry.creation_expression.empty())
        {
            selected_entry = mapping.default_entry;
            matched_entry = true;
        }

        if (!matched_entry)
        {
            stats.no_matching_branch = true;
            stats.transform_trace.push_back(
                "callsite_line=" + std::to_string(line_index + 1) +
                ";invocation=" + callsite.invocation_form +
                ";argument=" + normalized_literal +
                ";phase1_arg_hash=" + phase1_arg_hash_id +
                ";status=no_matching_branch");
            continue;
        }

        AllocationExpression allocation;
        if (!parse_allocation_expression(selected_entry.creation_expression, allocation))
        {
            stats.unsupported_return_expression = true;
            stats.transform_trace.push_back(
                "callsite_line=" + std::to_string(line_index + 1) +
                ";invocation=" + callsite.invocation_form +
                ";hash_id=" + selected_entry.hash_id +
                ";status=unsupported_return_expression");
            continue;
        }

        std::string rewritten_declaration_type;
        if (!rewrite_declaration_type(callsite.declaration_type, allocation, rewritten_declaration_type))
        {
            stats.allocator_declaration_mismatch = true;
            stats.transform_trace.push_back(
                "callsite_line=" + std::to_string(line_index + 1) +
                ";invocation=" + callsite.invocation_form +
                ";hash_id=" + selected_entry.hash_id +
                ";status=allocator_declaration_mismatch");
            continue;
        }

        if (callsite.assignment_callsite)
        {
            line = build_rewritten_assignment_line(callsite, selected_entry.creation_expression);
            if (callsite.declaration_line_index < lines.size())
            {
                rewrite_variable_declaration_line(
                    lines[callsite.declaration_line_index],
                    callsite.variable_name,
                    rewritten_declaration_type);
            }
        }
        else
        {
            line = build_rewritten_callsite_line(
                callsite,
                rewritten_declaration_type,
                selected_entry.creation_expression);
        }

        ++stats.rewritten_callsites;
        stats.transform_trace.push_back(
            "callsite_line=" + std::to_string(line_index + 1) +
            ";invocation=" + callsite.invocation_form +
            ";argument=" + normalized_literal +
            ";hash_id=" + selected_entry.hash_id +
            ";phase1_arg_hash=" + phase1_arg_hash_id +
            ";creation=" + selected_entry.creation_expression);

        if (!callsite.factory_receiver_name.empty())
        {
            rewritten_instance_receivers[callsite.factory_receiver_name] = callsite.factory_class_name;
        }
    }

    for (const auto& receiver : rewritten_instance_receivers)
    {
        const bool removed = remove_unused_factory_instance_declaration(
            lines,
            receiver.first,
            receiver.second);
        if (!removed)
        {
            continue;
        }

        FactoryRewriteStats& stats = stats_by_name[receiver.second];
        stats.transform_trace.push_back(
            "cleanup_removed_factory_instance=" + receiver.first +
            ";class=" + receiver.second);
    }

    out.transformed_source = join_lines(lines);

    for (const FactoryClassModel& model : factory_classes)
    {
        FactoryRewriteStats& stats = stats_by_name[model.class_name];
        if (stats.rewritten_callsites == 0)
        {
            continue;
        }

        SourceSpan span;
        if (!locate_class_span_by_name(out.transformed_source, model.class_name, span))
        {
            continue;
        }

        if (has_class_reference_outside_span(out.transformed_source, model.class_name, span))
        {
            stats.class_retained_due_remaining_references = true;
            continue;
        }

        erase_span_with_trailing_newlines(out.transformed_source, span);
    }

    for (const FactoryClassModel& model : factory_classes)
    {
        const FactoryRewriteStats& stats = stats_by_name[model.class_name];

        TransformDecision decision;
        decision.class_name = model.class_name;
        decision.transform_applied = stats.rewritten_callsites > 0;
        decision.transform_trace = stats.transform_trace;

        if (stats.create_method_missing)
        {
            add_reason_if_missing(decision, "factory_create_method_not_found");
        }
        if (stats.branch_map_missing)
        {
            add_reason_if_missing(decision, "factory_branch_map_not_found");
        }
        if (!stats.callsite_found)
        {
            add_reason_if_missing(decision, "no_factory_callsite_found");
        }
        if (stats.unresolved_instance_type)
        {
            add_reason_if_missing(decision, "factory_instance_type_unresolved");
        }
        if (stats.unresolved_result_declaration)
        {
            add_reason_if_missing(decision, "factory_result_declaration_unresolved");
        }
        if (stats.non_literal_argument)
        {
            add_reason_if_missing(decision, "non_literal_factory_argument_unsupported");
        }
        if (stats.no_matching_branch)
        {
            add_reason_if_missing(decision, "no_matching_factory_branch_for_literal");
        }
        if (stats.unsupported_return_expression)
        {
            add_reason_if_missing(decision, "unsupported_factory_return_expression");
        }
        if (stats.allocator_declaration_mismatch)
        {
            add_reason_if_missing(decision, "allocator_declaration_mismatch");
        }
        if (stats.class_retained_due_remaining_references)
        {
            add_reason_if_missing(decision, "factory_class_retained_due_remaining_references");
        }

        out.decisions.push_back(std::move(decision));
    }

    return out;
}
} // namespace creational_codegen_internal
