#include "creational_symbol_test.hpp"

#include "parse_tree_symbols.hpp"

#include <functional>
#include <sstream>
#include <string>

ParseTreeNode build_creational_symbol_test_tree(const ParseTreeNode& parse_root)
{
    rebuild_parse_tree_symbol_tables(parse_root);

    ParseTreeNode root{"CreationalSymbolTestRoot", "class symbols as siblings", {}};

    const std::vector<ParseSymbol>& classes = getClassSymbolTable();
    for (const ParseSymbol& cls : classes)
    {
        const ParseSymbol* lookup = getClassByName(cls.name);
        const size_t expected_hash = std::hash<std::string>{}(cls.name);

        ParseTreeNode child;
        child.kind = "ClassSymbol";
        child.value = cls.name +
            " | hash_ok=" + (cls.hash_value == expected_hash ? std::string("true") : std::string("false")) +
            " | lookup_ok=" + ((lookup != nullptr) ? std::string("true") : std::string("false"));

        root.children.push_back(std::move(child));
    }

    return root;
}

std::string creational_symbol_test_to_text(const ParseTreeNode& root)
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
