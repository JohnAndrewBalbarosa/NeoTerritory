#include "Logic/behavioural_logic_scaffold.hpp"

#include "parse_tree_dependency_utils.hpp"
#include "language_tokens.hpp"

#include <string>
#include <utility>

ParseTreeNode build_behavioural_function_scaffold(const ParseTreeNode& parse_root)
{
    ParseTreeNode root{"BehaviouralEntryRoot", "function traversal scaffold", {}};
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);

    const std::vector<DependencySymbolNode> functions = collect_dependency_function_nodes(parse_root);
    for (const DependencySymbolNode& fn : functions)
    {
        const std::string lowered = lowercase_ascii(fn.name);
        if (cfg.function_exclusion_keywords.find(lowered) != cfg.function_exclusion_keywords.end())
        {
            continue;
        }

        ParseTreeNode fn_node;
        fn_node.kind = "FunctionNode";
        fn_node.value = fn.name;
        root.children.push_back(std::move(fn_node));
    }

    return root;
}
