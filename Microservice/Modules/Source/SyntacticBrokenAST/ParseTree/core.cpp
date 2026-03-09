#include "parse_tree.hpp"

#include "Internal/parse_tree_internal.hpp"
#include "language_tokens.hpp"
#include "lexical_structure_hooks.hpp"
#include "parse_tree_symbols.hpp"
#include "tree_html_renderer.hpp"

#include <functional>
#include <sstream>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

ParseTreeNode build_cpp_parse_tree(const std::string& source, const ParseTreeBuildContext& context)
{
    std::vector<SourceFileUnit> single_file;
    single_file.push_back(SourceFileUnit{"<memory>", source});
    return build_cpp_parse_tree(single_file, context);
}

ParseTreeNode build_cpp_parse_tree(const std::vector<SourceFileUnit>& files, const ParseTreeBuildContext& context)
{
    ParseTreeBundle bundle = build_cpp_parse_trees(files, context);
    return bundle.main_tree;
}

ParseTreeBundle build_cpp_parse_trees(const std::vector<SourceFileUnit>& files, const ParseTreeBuildContext& context)
{
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);

    ParseTreeBundle bundle;
    bundle.main_tree.kind = cfg.node_translation_unit;
    bundle.main_tree.value = "Root";
    bundle.main_tree.contextual_hash = std::hash<std::string>{}(cfg.node_translation_unit + "|Root|main");

    bundle.shadow_tree.kind = cfg.node_translation_unit;
    bundle.shadow_tree.value = "Root";
    bundle.shadow_tree.contextual_hash = bundle.main_tree.contextual_hash;

    bundle.line_hash_traces.clear();
    bundle.factory_invocation_traces.clear();
    StructuralAnalysisState structural_state;
    reset_structural_analysis_state(structural_state);

    parse_tree_internal::ClassHashRegistry class_hash_registry;
    std::unordered_map<std::string, std::string> class_def_file;
    std::unordered_map<std::string, std::string> basename_to_path;

    bundle.main_tree.children.reserve(files.size());
    bundle.shadow_tree.children.reserve(files.size());
    for (size_t i = 0; i < files.size(); ++i)
    {
        const SourceFileUnit& file = files[i];

        ParseTreeNode main_file_node;
        main_file_node.kind = "FileUnit";
        main_file_node.value = file.path;
        main_file_node.contextual_hash = parse_tree_internal::derive_child_context_hash(
            bundle.main_tree.contextual_hash,
            main_file_node.kind,
            main_file_node.value,
            bundle.main_tree.children.size());
        const size_t file_context_hash = main_file_node.contextual_hash;
        bundle.main_tree.children.push_back(std::move(main_file_node));

        ParseTreeNode shadow_file_node;
        shadow_file_node.kind = "FileUnit";
        shadow_file_node.value = file.path;
        shadow_file_node.contextual_hash = file_context_hash;
        bundle.shadow_tree.children.push_back(std::move(shadow_file_node));

        basename_to_path[parse_tree_internal::file_basename(file.path)] = file.path;
    }

    for (size_t i = 0; i < files.size(); ++i)
    {
        parse_tree_internal::parse_file_content_into_node(
            files[i],
            bundle.main_tree.children[i],
            context,
            structural_state,
            bundle.line_hash_traces,
            bundle.factory_invocation_traces,
            class_hash_registry);
        parse_tree_internal::collect_class_definitions_by_file(
            bundle.main_tree.children[i], files[i].path, class_def_file);
    }

    for (ParseTreeNode& file_node : bundle.main_tree.children)
    {
        parse_tree_internal::resolve_include_dependencies(file_node, basename_to_path);

        std::unordered_set<std::string> emitted;
        std::vector<ParseTreeNode> symbol_deps;
        parse_tree_internal::collect_symbol_dependencies_for_file(
            file_node,
            file_node.value,
            class_def_file,
            emitted,
            symbol_deps);

        for (ParseTreeNode& dep : symbol_deps)
        {
            parse_tree_internal::append_node_at_path(file_node, {}, std::move(dep));
        }

        parse_tree_internal::bucketize_file_node_for_traversal(file_node);
    }

    std::unordered_set<std::string> tracked_class_names;
    bundle.crucial_classes = get_crucial_class_registry(structural_state);
    for (const CrucialClassInfo& class_info : bundle.crucial_classes)
    {
        tracked_class_names.insert(class_info.name);
    }

    ParseTreeSymbolBuildOptions symbol_options;
    for (const CrucialClassInfo& class_info : bundle.crucial_classes)
    {
        symbol_options.refactor_candidate_class_names.insert(class_info.name);
    }
    const ParseTreeSymbolTables symbols = build_parse_tree_symbol_tables(bundle.main_tree, symbol_options);

    std::unordered_set<std::string> tracked_function_names;
    for (const ParseSymbol& function_symbol : function_symbol_table(symbols))
    {
        if (tracked_class_names.find(function_symbol.owner_scope) != tracked_class_names.end())
        {
            tracked_function_names.insert(function_symbol.name);
        }
    }

    std::unordered_map<std::string, std::unordered_set<size_t>> relevant_usage_hashes_by_file;
    for (const LineHashTrace& trace : bundle.line_hash_traces)
    {
        if (tracked_class_names.find(trace.class_name) == tracked_class_names.end())
        {
            continue;
        }

        if (!trace.intentional_scope_collision && trace.hash_collision)
        {
            continue;
        }

        std::unordered_set<size_t>& hashes = relevant_usage_hashes_by_file[trace.file_path];
        hashes.insert(trace.scoped_class_usage_hash);
        hashes.insert(trace.outgoing_hash);
        for (size_t h : trace.hash_chain)
        {
            hashes.insert(h);
        }
    }

    bundle.virtual_nodes_kept = 0;
    bundle.virtual_nodes_pruned = 0;

    for (size_t i = 0; i < bundle.main_tree.children.size() && i < bundle.shadow_tree.children.size(); ++i)
    {
        ParseTreeNode& shadow_file = bundle.shadow_tree.children[i];
        shadow_file.children.clear();

        for (const ParseTreeNode& child : bundle.main_tree.children[i].children)
        {
            ParseTreeNode filtered;
            const auto usage_hashes_hit = relevant_usage_hashes_by_file.find(bundle.main_tree.children[i].value);
            const std::unordered_set<size_t>* relevant_usage_hashes =
                usage_hashes_hit == relevant_usage_hashes_by_file.end() ? nullptr : &usage_hashes_hit->second;
            if (parse_tree_internal::append_shadow_subtree_if_relevant(
                    child,
                    tracked_class_names,
                    tracked_function_names,
                    relevant_usage_hashes,
                    &bundle.virtual_nodes_kept,
                    &bundle.virtual_nodes_pruned,
                    filtered))
            {
                shadow_file.children.push_back(std::move(filtered));
            }
        }

        parse_tree_internal::bucketize_file_node_for_traversal(shadow_file);
    }

    return bundle;
}

std::string parse_tree_to_text(const ParseTreeNode& root)
{
    std::ostringstream out;

    std::function<void(const ParseTreeNode&, int)> walk = [&](const ParseTreeNode& node, int depth) {
        out << std::string(static_cast<size_t>(depth) * 2, ' ') << node.kind;

        const std::string& display_value = node.annotated_value.empty() ? node.value : node.annotated_value;
        if (!display_value.empty())
        {
            out << ": " << display_value;
        }

        out << " | ctx_hash=" << node.contextual_hash;
        if (!node.propagated_usage_hashes.empty())
        {
            out << " | scope_usage_hashes=" << parse_tree_internal::usage_hash_list(node.propagated_usage_hashes);
        }
        out << '\n';

        for (const ParseTreeNode& child : node.children)
        {
            walk(child, depth + 1);
        }
    };

    walk(root, 0);
    return out.str();
}

std::string parse_tree_to_html(const ParseTreeNode& root)
{
    return render_tree_html(root, "C++ Parse Tree");
}
