#include "Logic/creational_pattern_mediator.hpp"

#include "Language-and-Structure/language_tokens.hpp"

#include <cctype>
#include <string>
#include <unordered_set>
#include <utility>
#include <vector>

namespace
{
std::string trim(const std::string& input)
{
    size_t begin = 0;
    while (begin < input.size() && std::isspace(static_cast<unsigned char>(input[begin])))
    {
        ++begin;
    }

    size_t end = input.size();
    while (end > begin && std::isspace(static_cast<unsigned char>(input[end - 1])))
    {
        --end;
    }

    return input.substr(begin, end - begin);
}

std::vector<std::string> split_words(const std::string& text)
{
    std::vector<std::string> words;
    std::string current;
    for (char c : text)
    {
        if (std::isalnum(static_cast<unsigned char>(c)) || c == '_')
        {
            current.push_back(c);
        }
        else if (!current.empty())
        {
            words.push_back(current);
            current.clear();
        }
    }
    if (!current.empty())
    {
        words.push_back(current);
    }
    return words;
}

bool starts_with(const std::string& text, const std::string& prefix)
{
    return text.size() >= prefix.size() && text.compare(0, prefix.size(), prefix) == 0;
}

std::string class_name_from_signature(const std::string& signature)
{
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    const std::vector<std::string> words = split_words(signature);
    for (size_t i = 0; i + 1 < words.size(); ++i)
    {
        if (cfg.class_keywords.find(lowercase_ascii(words[i])) != cfg.class_keywords.end())
        {
            return words[i + 1];
        }
    }
    return {};
}

bool is_class_block(const ParseTreeNode& node)
{
    if (node.kind == "ClassDecl" || node.kind == "StructDecl")
    {
        return true;
    }
    if (node.kind != "Block")
    {
        return false;
    }

    const std::string lowered = lowercase_ascii(trim(node.value));
    return starts_with(lowered, "class ") || starts_with(lowered, "struct ");
}
} // namespace

std::vector<CreationalRegisteredClass> register_creational_classes(
    const ParseTreeNode& parse_root,
    const ParseTreeSymbolTables& tables)
{
    std::vector<CreationalRegisteredClass> registered;
    std::unordered_set<size_t> seen_contextual_hashes;

    std::vector<const ParseTreeNode*> stack{&parse_root};
    while (!stack.empty())
    {
        const ParseTreeNode* node = stack.back();
        stack.pop_back();

        if (is_class_block(*node))
        {
            const std::string class_name = class_name_from_signature(node->value);
            if (!class_name.empty() && seen_contextual_hashes.insert(node->contextual_hash).second)
            {
                const ParseSymbol* symbol = find_class_by_hash(tables, node->contextual_hash);
                if (symbol == nullptr || symbol->name != class_name)
                {
                    symbol = find_class_by_name(tables, class_name);
                }

                registered.push_back(CreationalRegisteredClass{class_name, node, symbol});
            }
        }

        for (const ParseTreeNode& child : node->children)
        {
            stack.push_back(&child);
        }
    }

    return registered;
}

CreationalTreeNode build_creational_pattern_tree_with_mediator(
    const ParseTreeNode& parse_root,
    const ICreationalPatternAlgorithm& algorithm)
{
    const ParseTreeSymbolTables tables = build_parse_tree_symbol_tables(parse_root);
    const std::vector<CreationalRegisteredClass> registered_classes =
        register_creational_classes(parse_root, tables);

    CreationalTreeNode root{
        algorithm.pattern_root_kind(),
        algorithm.pattern_root_label(),
        {}};

    for (const CreationalRegisteredClass& registered_class : registered_classes)
    {
        if (registered_class.node == nullptr)
        {
            continue;
        }

        CreationalTreeNode class_node;
        if (algorithm.inspect_registered_class(registered_class, tables, class_node) &&
            !class_node.children.empty())
        {
            root.children.push_back(std::move(class_node));
        }
    }

    return root;
}

CreationalTreeNode build_creational_family_tree_with_mediator(
    const ParseTreeNode& parse_root,
    const std::vector<const ICreationalPatternAlgorithm*>& algorithms)
{
    CreationalTreeNode root{"CreationalPatternsRoot", "factory + singleton + builder", {}};

    for (const ICreationalPatternAlgorithm* algorithm : algorithms)
    {
        if (algorithm == nullptr)
        {
            continue;
        }

        CreationalTreeNode pattern_tree = build_creational_pattern_tree_with_mediator(parse_root, *algorithm);
        if (!pattern_tree.children.empty())
        {
            root.children.push_back(std::move(pattern_tree));
        }
    }

    if (root.children.empty())
    {
        root.label = "NoFactoryOrSingletonOrBuilderPatternFound";
    }

    return root;
}
