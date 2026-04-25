#include "Trees/Actual/parse_tree.hpp"

ParseTreeNode build_cpp_parse_tree(const SourceFileUnit& source, const ParseTreeBuildContext&)
{
    ParseTreeNode root;
    root.kind      = "translation_unit";
    root.file_name = source.file_name;
    root.text      = source.contents;
    return root;
}

ParseTreeBundle build_cpp_parse_trees(
    const std::vector<SourceFileUnit>& sources,
    const ParseTreeBuildContext&       context)
{
    ParseTreeBundle bundle;
    bundle.per_file_roots.reserve(sources.size());
    for (const SourceFileUnit& source : sources)
    {
        bundle.per_file_roots.push_back(build_cpp_parse_tree(source, context));
    }
    return bundle;
}

std::string parse_tree_to_text(const ParseTreeNode&)
{
    return {};
}

std::string parse_tree_to_html(const ParseTreeNode&)
{
    return {};
}
