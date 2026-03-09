#include "algorithm_pipeline.hpp"
#include "language_tokens.hpp"
#include "parse_tree_symbols.hpp"

#include <algorithm>
#include <chrono>
#include <sstream>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

namespace
{
using Clock = std::chrono::steady_clock;

bool file_has_bucket_kind(const ParseTreeNode& file_node, const std::string& bucket_kind)
{
    for (const ParseTreeNode& child : file_node.children)
    {
        if (child.kind == bucket_kind)
        {
            return true;
        }
    }
    return false;
}

bool validate_file_pairing(
    const ParseTreeNode& actual_root,
    const ParseTreeNode& virtual_root,
    std::vector<std::string>& failures)
{
    if (actual_root.children.size() != virtual_root.children.size())
    {
        failures.push_back("actual_virtual_file_count_mismatch");
        return false;
    }

    bool valid = true;
    for (size_t i = 0; i < actual_root.children.size(); ++i)
    {
        const ParseTreeNode& actual_file = actual_root.children[i];
        const ParseTreeNode& virtual_file = virtual_root.children[i];
        if (actual_file.kind != "FileUnit" || virtual_file.kind != "FileUnit")
        {
            failures.push_back("file_unit_kind_missing_at_index_" + std::to_string(i));
            valid = false;
            continue;
        }
        if (actual_file.value != virtual_file.value)
        {
            failures.push_back("file_unit_path_mismatch_at_index_" + std::to_string(i));
            valid = false;
        }
    }

    return valid;
}

bool validate_bucketized_files(const ParseTreeNode& root, std::vector<std::string>& failures)
{
    bool valid = true;
    for (size_t i = 0; i < root.children.size(); ++i)
    {
        const ParseTreeNode& file_node = root.children[i];
        if (file_node.kind != "FileUnit")
        {
            continue;
        }

        bool has_unbucketized_class_decl = false;
        for (const ParseTreeNode& child : file_node.children)
        {
            if (child.kind == "ClassDecl" || child.kind == "StructDecl")
            {
                has_unbucketized_class_decl = true;
                break;
            }
        }

        const bool has_class_bucket = file_has_bucket_kind(file_node, "ClassDeclarations");
        if (has_unbucketized_class_decl && !has_class_bucket)
        {
            failures.push_back("bucketized_structure_missing_for_file_" + std::to_string(i));
            valid = false;
        }
    }
    return valid;
}

size_t estimate_parse_tree_bytes(const ParseTreeNode& node)
{
    size_t total = sizeof(ParseTreeNode) + node.kind.size() + node.value.size();
    total += node.children.capacity() * sizeof(ParseTreeNode);

    for (const ParseTreeNode& child : node.children)
    {
        total += estimate_parse_tree_bytes(child);
    }

    return total;
}

size_t estimate_creational_tree_bytes(const CreationalTreeNode& node)
{
    size_t total = sizeof(CreationalTreeNode) + node.kind.size() + node.label.size();
    total += node.children.capacity() * sizeof(CreationalTreeNode);

    for (const CreationalTreeNode& child : node.children)
    {
        total += estimate_creational_tree_bytes(child);
    }

    return total;
}

size_t estimate_symbol_table_bytes(const ParseTreeSymbolTables& tables)
{
    size_t total = 0;

    const std::vector<ParseSymbol>& classes = class_symbol_table(tables);
    const std::vector<ParseSymbol>& functions = function_symbol_table(tables);

    total += classes.capacity() * sizeof(ParseSymbol);
    total += functions.capacity() * sizeof(ParseSymbol);

    for (const ParseSymbol& s : classes)
    {
        total += s.name.size() + s.signature.size();
    }
    for (const ParseSymbol& s : functions)
    {
        total += s.name.size() + s.signature.size();
    }

    return total;
}

size_t estimate_node_ref_bytes(const NodeRef& ref)
{
    size_t total = sizeof(NodeRef);
    total += ref.tree_side.size();
    total += ref.file_basename.size();
    total += ref.file_path.size();
    total += ref.node_kind.size();
    total += ref.node_value.size();
    total += ref.node_index_path.capacity() * sizeof(size_t);
    total += ref.ancestry.readable_chain.capacity() * sizeof(std::string);
    total += ref.ancestry.hash_chain.capacity() * sizeof(size_t);

    for (const std::string& entry : ref.ancestry.readable_chain)
    {
        total += entry.size();
    }

    return total;
}

size_t estimate_hash_links_bytes(const HashLinkIndex& links)
{
    size_t total = sizeof(HashLinkIndex);
    total += links.paired_file_view.capacity() * sizeof(FilePairedTreeView);
    total += links.class_links.capacity() * sizeof(ClassHashLink);
    total += links.usage_links.capacity() * sizeof(UsageHashLink);

    for (const FilePairedTreeView& view : links.paired_file_view)
    {
        total += view.file_basename.size();
        total += view.file_path.size();
        total += view.actual_root_kind.size();
        total += view.virtual_root_kind.size();
    }

    for (const ClassHashLink& link : links.class_links)
    {
        total += link.class_name.size();
        total += link.file_path.size();
        total += link.actual_link_status.size();
        total += link.virtual_link_status.size();
        total += link.link_status.size();
        total += link.actual_nodes.capacity() * sizeof(NodeRef);
        total += link.virtual_nodes.capacity() * sizeof(NodeRef);
        for (const NodeRef& ref : link.actual_nodes)
        {
            total += estimate_node_ref_bytes(ref);
        }
        for (const NodeRef& ref : link.virtual_nodes)
        {
            total += estimate_node_ref_bytes(ref);
        }
    }

    for (const UsageHashLink& link : links.usage_links)
    {
        total += link.file_path.size();
        total += link.class_name.size();
        total += link.hash_chain.capacity() * sizeof(size_t);
        total += link.class_link_status.size();
        total += link.usage_link_status.size();
        total += link.class_anchor_actual_nodes.capacity() * sizeof(NodeRef);
        total += link.class_anchor_virtual_nodes.capacity() * sizeof(NodeRef);
        total += link.usage_actual_nodes.capacity() * sizeof(NodeRef);
        total += link.usage_virtual_nodes.capacity() * sizeof(NodeRef);
        for (const NodeRef& ref : link.class_anchor_actual_nodes)
        {
            total += estimate_node_ref_bytes(ref);
        }
        for (const NodeRef& ref : link.class_anchor_virtual_nodes)
        {
            total += estimate_node_ref_bytes(ref);
        }
        for (const NodeRef& ref : link.usage_actual_nodes)
        {
            total += estimate_node_ref_bytes(ref);
        }
        for (const NodeRef& ref : link.usage_virtual_nodes)
        {
            total += estimate_node_ref_bytes(ref);
        }
    }

    return total;
}

std::string json_escape(const std::string& input)
{
    std::string out;
    out.reserve(input.size());
    for (char c : input)
    {
        switch (c)
        {
            case '\\': out += "\\\\"; break;
            case '"': out += "\\\""; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default: out.push_back(c); break;
        }
    }
    return out;
}

void append_json_string_array(std::ostringstream& out, const std::vector<std::string>& values)
{
    out << "[";
    for (size_t i = 0; i < values.size(); ++i)
    {
        if (i > 0)
        {
            out << ", ";
        }
        out << "\"" << json_escape(values[i]) << "\"";
    }
    out << "]";
}

void append_json_number_array(std::ostringstream& out, const std::vector<size_t>& values)
{
    out << "[";
    for (size_t i = 0; i < values.size(); ++i)
    {
        if (i > 0)
        {
            out << ", ";
        }
        out << values[i];
    }
    out << "]";
}

void append_json_node_refs(std::ostringstream& out, const std::vector<NodeRef>& refs)
{
    out << "[";
    for (size_t i = 0; i < refs.size(); ++i)
    {
        const NodeRef& ref = refs[i];
        out << "{";
        out << "\"tree_side\":\"" << json_escape(ref.tree_side) << "\",";
        out << "\"file_basename\":\"" << json_escape(ref.file_basename) << "\",";
        out << "\"file_path\":\"" << json_escape(ref.file_path) << "\",";
        out << "\"node_kind\":\"" << json_escape(ref.node_kind) << "\",";
        out << "\"node_value\":\"" << json_escape(ref.node_value) << "\",";
        out << "\"contextual_hash\":" << ref.contextual_hash << ",";
        out << "\"node_index_path\":";
        append_json_number_array(out, ref.node_index_path);
        out << ",";
        out << "\"readable_ancestry\":";
        append_json_string_array(out, ref.ancestry.readable_chain);
        out << ",";
        out << "\"hash_ancestry\":";
        append_json_number_array(out, ref.ancestry.hash_chain);
        out << "}";
        if (i + 1 < refs.size())
        {
            out << ",";
        }
    }
    out << "]";
}
} // namespace

PipelineArtifacts run_normalize_and_rewrite_pipeline(
    const std::vector<SourceFileUnit>& source_files,
    const std::string& source_pattern,
    const std::string& target_pattern,
    size_t input_file_count,
    const std::vector<std::string>& input_files)
{
    PipelineArtifacts artifacts;
    artifacts.report.source_pattern = source_pattern;
    artifacts.report.target_pattern = target_pattern;
    artifacts.report.input_file_count = input_file_count;
    artifacts.report.total_elapsed_ms = 0.0;
    artifacts.report.peak_estimated_bytes = 0;
    artifacts.report.expected_file_pair_count = source_files.size();
    artifacts.report.paired_file_count = 0;
    artifacts.report.invariant_failure_count = 0;
    artifacts.report.dirty_trace_count = 0;
    artifacts.report.intentional_collision_total = 0;
    artifacts.report.intentional_collision_validated = 0;
    artifacts.report.virtual_nodes_kept = 0;
    artifacts.report.virtual_nodes_pruned = 0;
    artifacts.report.invariant_failures.clear();
    artifacts.report.graph_consistent = false;

    const Clock::time_point pipeline_begin = Clock::now();

    auto run_stage = [&](const std::string& name, auto&& fn) {
        const Clock::time_point begin = Clock::now();
        const size_t bytes = fn();
        const Clock::time_point end = Clock::now();

        StageMetric m;
        m.name = name;
        m.elapsed_ms = std::chrono::duration<double, std::milli>(end - begin).count();
        m.estimated_bytes = bytes;
        artifacts.report.stages.push_back(std::move(m));
        artifacts.report.peak_estimated_bytes = std::max(artifacts.report.peak_estimated_bytes, bytes);
    };

    // 1) Input parse -> base graph
    run_stage("ParseBaseGraph", [&]() {
        ParseTreeBuildContext context;
        context.source_pattern = source_pattern;
        context.target_pattern = target_pattern;
        context.input_files = input_files;
        const ParseTreeBundle trees = build_cpp_parse_trees(source_files, context);
        artifacts.base_tree = trees.main_tree;
        artifacts.virtual_tree = trees.shadow_tree;
        artifacts.line_hash_traces = trees.line_hash_traces;
        artifacts.factory_invocation_traces = trees.factory_invocation_traces;
        artifacts.crucial_classes = trees.crucial_classes;
        artifacts.report.virtual_nodes_kept = trees.virtual_nodes_kept;
        artifacts.report.virtual_nodes_pruned = trees.virtual_nodes_pruned;
        return estimate_parse_tree_bytes(artifacts.base_tree) +
               estimate_parse_tree_bytes(artifacts.virtual_tree);
    });

    // 2) Detect patterns
    run_stage("DetectPatternInstances", [&]() {
        artifacts.creational_tree = build_creational_broken_tree(artifacts.base_tree);
        artifacts.behavioural_tree = build_behavioural_broken_tree(artifacts.base_tree);
        return estimate_creational_tree_bytes(artifacts.creational_tree) +
               estimate_parse_tree_bytes(artifacts.behavioural_tree);
    });

    // 3) Create virtual subgraph
    run_stage("CreateVirtualSubgraph", [&]() {
        // Shadow AST is built during lexical parsing to preserve scope-local usage context.
        return estimate_parse_tree_bytes(artifacts.virtual_tree);
    });

    // 4) Hash affected nodes (symbol tables)
    run_stage("HashAffectedNodes", [&]() {
        ParseTreeSymbolBuildOptions symbol_options;
        for (const CrucialClassInfo& class_info : artifacts.crucial_classes)
        {
            symbol_options.refactor_candidate_class_names.insert(class_info.name);
        }

        artifacts.symbol_tables = build_parse_tree_symbol_tables(artifacts.base_tree, symbol_options);
        artifacts.hash_links = build_parse_tree_hash_links(
            artifacts.base_tree,
            artifacts.virtual_tree,
            artifacts.symbol_tables,
            artifacts.line_hash_traces);

        artifacts.report.dirty_trace_count = artifacts.line_hash_traces.size();
        artifacts.report.paired_file_count = artifacts.hash_links.paired_file_view.size();
        size_t intentional_total = 0;
        size_t intentional_validated = 0;
        for (const LineHashTrace& trace : artifacts.line_hash_traces)
        {
            ++intentional_total;
            if (trace.intentional_scope_collision)
            {
                ++intentional_validated;
            }
        }
        artifacts.report.intentional_collision_total = intentional_total;
        artifacts.report.intentional_collision_validated = intentional_validated;

        return estimate_symbol_table_bytes(artifacts.symbol_tables) +
               estimate_hash_links_bytes(artifacts.hash_links);
    });

    // 5) Generate monolithic representation
    run_stage("GenerateMonolithicRepresentation", [&]() {
        artifacts.monolithic_representation =
            generate_base_code_from_source(join_source_file_units(source_files));
        return artifacts.monolithic_representation.size();
    });

    // 6) Apply target policies (scaffold/no-op)
    run_stage("ApplyTargetPolicies", [&]() {
        return estimate_parse_tree_bytes(artifacts.base_tree);
    });

    // 7) Validate consistency
    run_stage("ValidateGraphConsistency", [&]() {
        std::vector<std::string> failures;
        const bool pairing_valid = validate_file_pairing(
            artifacts.base_tree,
            artifacts.virtual_tree,
            failures);
        const bool base_bucketized = validate_bucketized_files(artifacts.base_tree, failures);
        const bool virtual_bucketized = validate_bucketized_files(artifacts.virtual_tree, failures);

        if (artifacts.report.paired_file_count != artifacts.report.expected_file_pair_count)
        {
            failures.push_back("paired_file_count_does_not_match_input_file_count");
        }
        if (artifacts.report.intentional_collision_total > 0 &&
            artifacts.report.intentional_collision_validated == 0)
        {
            failures.push_back("intentional_scope_collision_validation_failed");
        }

        artifacts.report.invariant_failures = std::move(failures);
        artifacts.report.invariant_failure_count = artifacts.report.invariant_failures.size();

        artifacts.report.graph_consistent =
            !artifacts.base_tree.kind.empty() &&
            !artifacts.virtual_tree.kind.empty() &&
            (!artifacts.monolithic_representation.empty()) &&
            pairing_valid &&
            base_bucketized &&
            virtual_bucketized &&
            artifacts.report.invariant_failure_count == 0;
        return estimate_parse_tree_bytes(artifacts.base_tree);
    });

    const Clock::time_point pipeline_end = Clock::now();
    artifacts.report.total_elapsed_ms =
        std::chrono::duration<double, std::milli>(pipeline_end - pipeline_begin).count();

    return artifacts;
}

std::string pipeline_report_to_json(
    const PipelineReport& report,
    const ParseTreeSymbolTables& symbol_tables,
    const std::vector<LineHashTrace>& line_hash_traces,
    const std::vector<FactoryInvocationTrace>& factory_invocation_traces,
    const HashLinkIndex& hash_links,
    const std::vector<TransformDecision>& transform_decisions)
{
    const std::vector<ParseSymbolUsage>& class_usages = class_usage_table(symbol_tables);
    std::unordered_set<std::string> candidate_class_names;
    for (const ParseSymbolUsage& usage : class_usages)
    {
        if (usage.refactor_candidate)
        {
            candidate_class_names.insert(usage.name);
        }
    }

    std::unordered_map<std::string, TransformDecision> decisions_by_class;
    for (const TransformDecision& decision : transform_decisions)
    {
        if (decision.class_name.empty())
        {
            continue;
        }
        decisions_by_class[decision.class_name] = decision;
    }
    const std::string normalized_source_pattern = lowercase_ascii(report.source_pattern);
    const std::string normalized_target_pattern = lowercase_ascii(report.target_pattern);

    std::ostringstream out;
    out << "{\n";
    out << "  \"source_pattern\": \"" << json_escape(report.source_pattern) << "\",\n";
    out << "  \"target_pattern\": \"" << json_escape(report.target_pattern) << "\",\n";
    const bool factory_reverse_route_selected =
        normalized_source_pattern == "factory" &&
        normalized_target_pattern == "base";
    out << "  \"factory_reverse_route_selected\": "
        << (factory_reverse_route_selected ? "true" : "false") << ",\n";
    if (normalized_source_pattern == "factory" && !factory_reverse_route_selected)
    {
        out << "  \"factory_reverse_route_hint\": \"set target_pattern=base to enable factory reverse direct-instantiation output\",\n";
    }
    out << "  \"input_file_count\": " << report.input_file_count << ",\n";
    out << "  \"total_elapsed_ms\": " << report.total_elapsed_ms << ",\n";
    out << "  \"peak_estimated_bytes\": " << report.peak_estimated_bytes << ",\n";
    out << "  \"expected_file_pair_count\": " << report.expected_file_pair_count << ",\n";
    out << "  \"paired_file_count\": " << report.paired_file_count << ",\n";
    out << "  \"invariant_failure_count\": " << report.invariant_failure_count << ",\n";
    out << "  \"dirty_trace_count\": " << report.dirty_trace_count << ",\n";
    out << "  \"intentional_collision_total\": " << report.intentional_collision_total << ",\n";
    out << "  \"intentional_collision_validated\": " << report.intentional_collision_validated << ",\n";
    out << "  \"virtual_nodes_kept\": " << report.virtual_nodes_kept << ",\n";
    out << "  \"virtual_nodes_pruned\": " << report.virtual_nodes_pruned << ",\n";
    out << "  \"graph_consistent\": " << (report.graph_consistent ? "true" : "false") << ",\n";
    out << "  \"invariant_failures\": ";
    append_json_string_array(out, report.invariant_failures);
    out << ",\n";
    out << "  \"paired_file_view\": [\n";
    for (size_t i = 0; i < hash_links.paired_file_view.size(); ++i)
    {
        const FilePairedTreeView& view = hash_links.paired_file_view[i];
        out << "    {\n";
        out << "      \"file_basename\": \"" << json_escape(view.file_basename) << "\",\n";
        out << "      \"file_path\": \"" << json_escape(view.file_path) << "\",\n";
        out << "      \"actual_root_kind\": \"" << json_escape(view.actual_root_kind) << "\",\n";
        out << "      \"virtual_root_kind\": \"" << json_escape(view.virtual_root_kind) << "\"\n";
        out << "    }";
        if (i + 1 < hash_links.paired_file_view.size())
        {
            out << ",";
        }
        out << "\n";
    }
    out << "  ],\n";
    out << "  \"class_registry\": [\n";

    const std::vector<ParseSymbol>& class_symbols = class_symbol_table(symbol_tables);
    for (size_t i = 0; i < class_symbols.size(); ++i)
    {
        const ParseSymbol& s = class_symbols[i];
        const ClassHashLink* class_link = i < hash_links.class_links.size() ? &hash_links.class_links[i] : nullptr;

        bool transform_applied = false;
        std::vector<std::string> transform_reason;
        std::vector<std::string> transform_trace;

        const auto decision_it = decisions_by_class.find(s.name);
        if (decision_it != decisions_by_class.end())
        {
            transform_applied = decision_it->second.transform_applied;
            transform_reason = decision_it->second.transform_reason;
            transform_trace = decision_it->second.transform_trace;
        }

        if (!transform_applied && transform_reason.empty())
        {
            if (normalized_source_pattern == "singleton" &&
                normalized_target_pattern == "builder")
            {
                transform_reason.push_back("singleton_candidate_not_found");
            }
            else if (normalized_source_pattern == "factory" &&
                     normalized_target_pattern != "base" &&
                     candidate_class_names.find(s.name) != candidate_class_names.end())
            {
                transform_reason.push_back("factory_reverse_transform_requires_target_base");
            }
            else
            {
                transform_reason.push_back("transform_policy_not_applicable_for_source_target");
            }
        }

        out << "    {\n";
        out << "      \"name\": \"" << json_escape(s.name) << "\",\n";
        out << "      \"file_path\": \"" << json_escape(s.file_path) << "\",\n";
        out << "      \"name_hash\": " << s.name_hash << ",\n";
        out << "      \"contextual_hash\": " << s.contextual_hash << ",\n";
        out << "      \"hash\": " << s.hash_value << ",\n";
        out << "      \"refactor_candidate\": "
            << (candidate_class_names.find(s.name) != candidate_class_names.end() ? "true" : "false") << ",\n";
        out << "      \"transform_applied\": " << (transform_applied ? "true" : "false") << ",\n";
        out << "      \"transform_reason\": [";
        for (size_t reason_i = 0; reason_i < transform_reason.size(); ++reason_i)
        {
            if (reason_i > 0)
            {
                out << ", ";
            }
            out << "\"" << json_escape(transform_reason[reason_i]) << "\"";
        }
        out << "],\n";
        out << "      \"transform_trace\": [";
        for (size_t trace_i = 0; trace_i < transform_trace.size(); ++trace_i)
        {
            if (trace_i > 0)
            {
                out << ", ";
            }
            out << "\"" << json_escape(transform_trace[trace_i]) << "\"";
        }
        out << "],\n";
        out << "      \"actual_link_status\": \""
            << json_escape(class_link == nullptr ? "unresolved" : class_link->actual_link_status) << "\",\n";
        out << "      \"virtual_link_status\": \""
            << json_escape(class_link == nullptr ? "unresolved" : class_link->virtual_link_status) << "\",\n";
        out << "      \"link_status\": \""
            << json_escape(class_link == nullptr ? "unresolved" : class_link->link_status) << "\",\n";
        out << "      \"actual_tree_links\": ";
        if (class_link != nullptr)
        {
            append_json_node_refs(out, class_link->actual_nodes);
        }
        else
        {
            out << "[]";
        }
        out << ",\n";
        out << "      \"virtual_tree_links\": ";
        if (class_link != nullptr)
        {
            append_json_node_refs(out, class_link->virtual_nodes);
        }
        else
        {
            out << "[]";
        }
        out << ",\n";
        out << "      \"definition_node_index\": " << s.definition_node_index << "\n";
        out << "    }";
        if (i + 1 < class_symbols.size())
        {
            out << ",";
        }
        out << "\n";
    }

    out << "  ],\n";
    out << "  \"class_usages\": [\n";

    for (size_t i = 0; i < class_usages.size(); ++i)
    {
        const ParseSymbolUsage& u = class_usages[i];
        out << "    {\n";
        out << "      \"name\": \"" << json_escape(u.name) << "\",\n";
        out << "      \"type_string\": \"" << json_escape(u.type_string) << "\",\n";
        out << "      \"node_kind\": \"" << json_escape(u.node_kind) << "\",\n";
        out << "      \"node_value\": \"" << json_escape(u.node_value) << "\",\n";
        out << "      \"node_index\": " << u.node_index << ",\n";
        out << "      \"node_contextual_hash\": " << u.node_contextual_hash << ",\n";
        out << "      \"class_name_hash\": " << u.class_name_hash << ",\n";
        out << "      \"hash_collision\": " << (u.hash_collision ? "true" : "false") << ",\n";
        out << "      \"refactor_candidate\": " << (u.refactor_candidate ? "true" : "false") << ",\n";
        out << "      \"hash\": " << u.hash_value << "\n";
        out << "    }";
        if (i + 1 < class_usages.size())
        {
            out << ",";
        }
        out << "\n";
    }

    out << "  ],\n";
    out << "  \"line_hash_traces\": [\n";

    for (size_t i = 0; i < line_hash_traces.size(); ++i)
    {
        const LineHashTrace& t = line_hash_traces[i];
        const UsageHashLink* usage_link = i < hash_links.usage_links.size() ? &hash_links.usage_links[i] : nullptr;
        out << "    {\n";
        out << "      \"file_path\": \"" << json_escape(t.file_path) << "\",\n";
        out << "      \"line_number\": " << t.line_number << ",\n";
        out << "      \"class_name\": \"" << json_escape(t.class_name) << "\",\n";
        out << "      \"class_name_hash\": " << t.class_name_hash << ",\n";
        out << "      \"matched_class_contextual_hash\": " << t.matched_class_contextual_hash << ",\n";
        out << "      \"scope_hash\": " << t.scope_hash << ",\n";
        out << "      \"scoped_class_usage_hash\": " << t.scoped_class_usage_hash << ",\n";
        out << "      \"hit_token_index\": " << t.hit_token_index << ",\n";
        out << "      \"outgoing_hash\": " << t.outgoing_hash << ",\n";
        out << "      \"dirty_token_count\": " << t.dirty_token_count << ",\n";
        out << "      \"hash_chain\": ";
        append_json_number_array(out, t.hash_chain);
        out << ",\n";
        out << "      \"refactor_candidate_class\": "
            << (candidate_class_names.find(t.class_name) != candidate_class_names.end() ? "true" : "false") << ",\n";
        out << "      \"hash_collision\": " << (t.hash_collision ? "true" : "false") << ",\n";
        out << "      \"intentional_scope_collision\": "
            << (t.intentional_scope_collision ? "true" : "false") << ",\n";
        out << "      \"class_link_status\": \""
            << json_escape(usage_link == nullptr ? "unresolved" : usage_link->class_link_status) << "\",\n";
        out << "      \"class_anchor_actual_tree_links\": ";
        if (usage_link != nullptr)
        {
            append_json_node_refs(out, usage_link->class_anchor_actual_nodes);
        }
        else
        {
            out << "[]";
        }
        out << ",\n";
        out << "      \"class_anchor_virtual_tree_links\": ";
        if (usage_link != nullptr)
        {
            append_json_node_refs(out, usage_link->class_anchor_virtual_nodes);
        }
        else
        {
            out << "[]";
        }
        out << ",\n";
        out << "      \"usage_link_status\": \""
            << json_escape(usage_link == nullptr ? "unresolved" : usage_link->usage_link_status) << "\",\n";
        out << "      \"usage_actual_tree_links\": ";
        if (usage_link != nullptr)
        {
            append_json_node_refs(out, usage_link->usage_actual_nodes);
        }
        else
        {
            out << "[]";
        }
        out << ",\n";
        out << "      \"usage_virtual_tree_links\": ";
        if (usage_link != nullptr)
        {
            append_json_node_refs(out, usage_link->usage_virtual_nodes);
        }
        else
        {
            out << "[]";
        }
        out << "\n";
        out << "    }";
        if (i + 1 < line_hash_traces.size())
        {
            out << ",";
        }
        out << "\n";
    }

    out << "  ],\n";
    out << "  \"factory_invocation_traces\": [\n";

    for (size_t i = 0; i < factory_invocation_traces.size(); ++i)
    {
        const FactoryInvocationTrace& trace = factory_invocation_traces[i];
        out << "    {\n";
        out << "      \"file_path\": \"" << json_escape(trace.file_path) << "\",\n";
        out << "      \"line_number\": " << trace.line_number << ",\n";
        out << "      \"scope_context_hash\": " << trace.scope_context_hash << ",\n";
        out << "      \"invocation_form\": \"" << json_escape(trace.invocation_form) << "\",\n";
        out << "      \"receiver_token\": \"" << json_escape(trace.receiver_token) << "\",\n";
        out << "      \"resolved_factory_class\": \"" << json_escape(trace.resolved_factory_class) << "\",\n";
        out << "      \"argument_token\": \"" << json_escape(trace.argument_token) << "\",\n";
        out << "      \"argument_hash_id\": \"" << json_escape(trace.argument_hash_id) << "\"\n";
        out << "    }";
        if (i + 1 < factory_invocation_traces.size())
        {
            out << ",";
        }
        out << "\n";
    }

    out << "  ],\n";
    out << "  \"stages\": [\n";

    for (size_t i = 0; i < report.stages.size(); ++i)
    {
        const StageMetric& s = report.stages[i];
        out << "    {\n";
        out << "      \"name\": \"" << json_escape(s.name) << "\",\n";
        out << "      \"elapsed_ms\": " << s.elapsed_ms << ",\n";
        out << "      \"estimated_bytes\": " << s.estimated_bytes << "\n";
        out << "    }";
        if (i + 1 < report.stages.size())
        {
            out << ",";
        }
        out << "\n";
    }

    out << "  ]\n";
    out << "}\n"; 
    return out.str();
}
