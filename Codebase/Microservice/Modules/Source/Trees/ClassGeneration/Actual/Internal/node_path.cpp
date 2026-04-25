#include "Trees/Actual/Internal/contracts.hpp"

bool is_class_declaration_node(const ParseTreeNode& node)
{
    return node.kind == "class" || node.kind == "struct";
}

bool is_global_function_declaration_node(const ParseTreeNode& node)
{
    return node.kind == "function" && node.parent_hash == 0;
}

std::size_t usage_hash_suffix(std::size_t parent_hash, const std::string& usage_token)
{
    return hash_combine_token(parent_hash, usage_token);
}

std::vector<std::size_t> usage_hash_list(const ParseTreeNode& usage_node)
{
    std::vector<std::size_t> chain;
    chain.push_back(usage_node.parent_hash);
    chain.push_back(usage_node.hash);
    return chain;
}
