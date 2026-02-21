#include "behavioural_symbol_test.hpp"

#include "parse_tree_symbols.hpp"

#include <functional>
#include <sstream>
#include <string>

ParseTreeNode build_behavioural_symbol_test_tree(const ParseTreeNode& parse_root)
{
    rebuild_parse_tree_symbol_tables(parse_root);

    ParseTreeNode root{"BehaviouralSymbolTestRoot", "function symbols as siblings", {}};

    const std::vector<ParseSymbol>& functions = getFunctionSymbolTable();
    for (const ParseSymbol& fn : functions)
    {
        const ParseSymbol* lookup = getFunctionByName(fn.name);
        const size_t expected_hash = std::hash<std::string>{}(fn.name);

        ParseTreeNode child;
        child.kind = "FunctionSymbol";
        child.value = fn.name +
            " | name_hash_ok=" + (fn.name_hash == expected_hash ? std::string("true") : std::string("false")) +
            " | contextual_hash=" + std::to_string(fn.contextual_hash) +
            " | lookup_ok=" + ((lookup != nullptr) ? std::string("true") : std::string("false"));

        root.children.push_back(std::move(child));
    }

    return root;
}

std::string behavioural_symbol_test_to_text(const ParseTreeNode& root)
{
    std::ostringstream out;

    std::function<void(const ParseTreeNode&, int)> walk = [&](const ParseTreeNode& node, int depth) {
        out << std::string(static_cast<size_t>(depth) * 2, ' ') << node.kind;
        if (!node.value.empty())
        {
            out << ": " << node.value;
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
