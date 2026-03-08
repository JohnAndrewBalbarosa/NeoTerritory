#include "Internal/parse_tree_hash_links_internal.hpp"

#include "language_tokens.hpp"

#include <algorithm>
#include <cctype>
#include <functional>
#include <string>
#include <unordered_set>
#include <utility>
#include <vector>

namespace parse_tree_hash_links_internal
{
std::string trim(const std::string& input)
{
    size_t start = 0;
    while (start < input.size() && std::isspace(static_cast<unsigned char>(input[start])))
    {
        ++start;
    }

    size_t end = input.size();
    while (end > start && std::isspace(static_cast<unsigned char>(input[end - 1])))
    {
        --end;
    }

    return input.substr(start, end - start);
}

std::string file_basename(const std::string& path)
{
    const size_t slash = path.find_last_of("/\\");
    if (slash == std::string::npos)
    {
        return path;
    }
    return path.substr(slash + 1);
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

std::string class_name_from_signature(const std::string& signature)
{
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    const std::vector<std::string> words = split_words(signature);
    for (size_t i = 0; i + 1 < words.size(); ++i)
    {
        const std::string kw = lowercase_ascii(words[i]);
        if (cfg.class_keywords.find(kw) != cfg.class_keywords.end())
        {
            return words[i + 1];
        }
    }

    return {};
}

bool is_class_declaration_node(const ParseTreeNode& node)
{
    if (node.kind == "ClassDecl" || node.kind == "StructDecl")
    {
        return true;
    }

    if (node.kind != "Block")
    {
        return false;
    }

    return !class_name_from_signature(node.value).empty();
}

std::string chain_entry(const std::string& kind, const std::string& value)
{
    return kind + ":" + trim(value);
}

std::string parent_tail_key(const NodeRef& ref, size_t depth)
{
    if (depth == 0 || ref.ancestry.readable_chain.size() <= 1)
    {
        return {};
    }

    const size_t parent_count = ref.ancestry.readable_chain.size() - 1;
    const size_t use_depth = std::min(depth, parent_count);
    const size_t start = parent_count - use_depth;

    std::string key;
    for (size_t i = start; i < parent_count; ++i)
    {
        if (!key.empty())
        {
            key += " <- ";
        }
        key += ref.ancestry.readable_chain[i];
    }
    return key;
}

int compare_index_paths(const std::vector<size_t>& lhs, const std::vector<size_t>& rhs)
{
    const size_t limit = std::min(lhs.size(), rhs.size());
    for (size_t i = 0; i < limit; ++i)
    {
        if (lhs[i] < rhs[i])
        {
            return -1;
        }
        if (lhs[i] > rhs[i])
        {
            return 1;
        }
    }

    if (lhs.size() < rhs.size())
    {
        return -1;
    }
    if (lhs.size() > rhs.size())
    {
        return 1;
    }
    return 0;
}

void dedupe_keep_order(std::vector<size_t>& values)
{
    std::unordered_set<size_t> seen;
    std::vector<size_t> out;
    out.reserve(values.size());
    for (size_t value : values)
    {
        if (seen.insert(value).second)
        {
            out.push_back(value);
        }
    }
    values = std::move(out);
}

std::string combine_status(const std::string& left, const std::string& right)
{
    if (left == "unresolved" || right == "unresolved")
    {
        return "unresolved";
    }
    if (left == "multi_match" || right == "multi_match")
    {
        return "multi_match";
    }
    return "unique";
}
} // namespace parse_tree_hash_links_internal
