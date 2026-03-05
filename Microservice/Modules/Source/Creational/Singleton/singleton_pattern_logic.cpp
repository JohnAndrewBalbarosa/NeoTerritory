#include "Singleton/singleton_pattern_logic.hpp"

#include "language_tokens.hpp"

#include <cctype>
#include <unordered_map>
#include <unordered_set>
#include <string>
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

std::string to_lower(const std::string& value)
{
    return lowercase_ascii(value);
}

bool starts_with(const std::string& text, const std::string& prefix)
{
    return text.size() >= prefix.size() && text.compare(0, prefix.size(), prefix) == 0;
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
    const std::vector<std::string> words = split_words(signature);
    for (size_t i = 0; i + 1 < words.size(); ++i)
    {
        const std::string kw = to_lower(words[i]);
        if (kw == "class" || kw == "struct")
        {
            return words[i + 1];
        }
    }
    return {};
}

std::string function_name_from_signature(const std::string& signature)
{
    const std::string trimmed = trim(signature);
    const size_t open = trimmed.find('(');
    if (open == std::string::npos)
    {
        return {};
    }

    const std::vector<std::string> words = split_words(trimmed.substr(0, open));
    if (words.empty())
    {
        return {};
    }

    return words.back();
}

bool is_signature_modifier_token(const std::string& token)
{
    const std::string lowered = to_lower(token);
    return lowered == "public" ||
           lowered == "private" ||
           lowered == "protected" ||
           lowered == "static" ||
           lowered == "virtual" ||
           lowered == "inline" ||
           lowered == "constexpr" ||
           lowered == "consteval" ||
           lowered == "constinit" ||
           lowered == "friend" ||
           lowered == "const" ||
           lowered == "volatile";
}

bool is_class_block(const ParseTreeNode& node)
{
    if (node.kind != "Block")
    {
        return false;
    }

    return !class_name_from_signature(node.value).empty();
}

bool is_function_block(const ParseTreeNode& node)
{
    if (node.kind != "Block")
    {
        return false;
    }

    const std::string signature = trim(node.value);
    if (signature.empty() || signature.find('(') == std::string::npos || signature.find(')') == std::string::npos)
    {
        return false;
    }

    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    const std::vector<std::string> words = split_words(signature);
    if (words.empty())
    {
        return false;
    }

    const std::string first = to_lower(words.front());
    return cfg.function_exclusion_keywords.find(first) == cfg.function_exclusion_keywords.end();
}

enum class SingletonStrength
{
    None,
    Strong,
    Weak,
};

struct AccessorSignatureInfo
{
    bool is_valid = false;
    bool is_static = false;
    SingletonStrength strength = SingletonStrength::None;
};

struct ReturnBinding
{
    std::string identifier;
    bool has_deref = false;
    bool has_addrof = false;
};

AccessorSignatureInfo analyze_accessor_signature(
    const std::string& signature,
    const std::string& class_name,
    const std::string& function_name)
{
    AccessorSignatureInfo out;
    if (class_name.empty() || function_name.empty())
    {
        return out;
    }

    const std::string trimmed = trim(signature);
    const size_t open = trimmed.find('(');
    if (open == std::string::npos)
    {
        return out;
    }

    const std::string left = trim(trimmed.substr(0, open));
    const size_t fn_pos = left.rfind(function_name);
    if (fn_pos == std::string::npos)
    {
        return out;
    }

    const std::string return_segment = trim(left.substr(0, fn_pos));
    if (return_segment.empty() || return_segment.find('<') != std::string::npos || return_segment.find('>') != std::string::npos)
    {
        return out;
    }

    const std::vector<std::string> words = split_words(return_segment);
    if (words.empty())
    {
        return out;
    }

    bool has_static = false;
    size_t same_class_tokens = 0;
    for (const std::string& token : words)
    {
        if (token == class_name)
        {
            ++same_class_tokens;
            continue;
        }

        if (!is_signature_modifier_token(token))
        {
            return out;
        }

        if (to_lower(token) == "static")
        {
            has_static = true;
        }
    }

    if (!has_static || same_class_tokens != 1)
    {
        return out;
    }

    out.is_valid = true;
    out.is_static = true;
    out.strength =
        (return_segment.find('&') != std::string::npos || return_segment.find('*') != std::string::npos)
            ? SingletonStrength::Strong
            : SingletonStrength::Weak;
    return out;
}

ReturnBinding extract_return_binding(const ParseTreeNode& node)
{
    ReturnBinding out;

    if (node.kind != "ReturnStatement")
    {
        return out;
    }

    std::string expr = trim(node.value);
    const std::string lowered = to_lower(expr);
    if (starts_with(lowered, "return"))
    {
        expr = trim(expr.substr(6));
    }

    if (!expr.empty() && expr.front() == '*')
    {
        out.has_deref = true;
        expr = trim(expr.substr(1));
    }
    else if (!expr.empty() && expr.front() == '&')
    {
        out.has_addrof = true;
        expr = trim(expr.substr(1));
    }

    const std::vector<std::string> words = split_words(expr);
    if (words.empty())
    {
        return out;
    }

    out.identifier = words.front();
    return out;
}

std::unordered_map<std::string, std::string> find_static_same_class_identifiers(
    const ParseTreeNode& fn_node,
    const std::string& class_name)
{
    std::unordered_map<std::string, std::string> out;

    std::vector<const ParseTreeNode*> stack{&fn_node};
    while (!stack.empty())
    {
        const ParseTreeNode* node = stack.back();
        stack.pop_back();

        if (node->kind == "Statement" || node->kind == "AssignmentOrVarDecl")
        {
            const std::vector<std::string> words = split_words(node->value);
            for (size_t i = 0; i + 2 < words.size(); ++i)
            {
                if (to_lower(words[i]) == "static" && words[i + 1] == class_name)
                {
                    const std::string identifier = words[i + 2];
                    out[identifier] = "static " + class_name + " " + identifier;
                }
            }
        }

        for (const ParseTreeNode& child : node->children)
        {
            stack.push_back(&child);
        }
    }

    return out;
}

bool function_returns_static_identifier(
    const ParseTreeNode& fn_node,
    const std::unordered_set<std::string>& static_identifiers,
    std::string& out_identifier,
    std::string& out_return_label)
{
    if (static_identifiers.empty())
    {
        return false;
    }

    std::vector<const ParseTreeNode*> stack{&fn_node};
    while (!stack.empty())
    {
        const ParseTreeNode* node = stack.back();
        stack.pop_back();

        const ReturnBinding binding = extract_return_binding(*node);
        if (!binding.identifier.empty() && static_identifiers.find(binding.identifier) != static_identifiers.end())
        {
            out_identifier = binding.identifier;
            if (binding.has_deref)
            {
                out_return_label = "*" + binding.identifier;
            }
            else if (binding.has_addrof)
            {
                out_return_label = "&" + binding.identifier;
            }
            else
            {
                out_return_label = binding.identifier;
            }
            return true;
        }

        for (const ParseTreeNode& child : node->children)
        {
            stack.push_back(&child);
        }
    }

    return false;
}

std::string singleton_strength_text(SingletonStrength strength)
{
    if (strength == SingletonStrength::Strong)
    {
        return "strong";
    }
    if (strength == SingletonStrength::Weak)
    {
        return "weak";
    }
    return "unknown";
}
} // namespace

CreationalTreeNode build_singleton_pattern_tree(const ParseTreeNode& parse_root)
{
    CreationalTreeNode root{"SingletonPatternRoot", "static same-class instance + return identifier", {}};

    std::vector<const ParseTreeNode*> stack{&parse_root};
    while (!stack.empty())
    {
        const ParseTreeNode* node = stack.back();
        stack.pop_back();

        if (is_class_block(*node))
        {
            const std::string cls_name = class_name_from_signature(node->value);
            if (cls_name.empty())
            {
                continue;
            }

            CreationalTreeNode cls_node{"ClassNode", cls_name, {}};

            for (const ParseTreeNode& fn : node->children)
            {
                if (!is_function_block(fn))
                {
                    continue;
                }

                const std::string accessor_name = function_name_from_signature(fn.value);
                const AccessorSignatureInfo accessor_info = analyze_accessor_signature(fn.value, cls_name, accessor_name);
                if (!accessor_info.is_valid || !accessor_info.is_static)
                {
                    continue;
                }

                const std::unordered_map<std::string, std::string> static_decls =
                    find_static_same_class_identifiers(fn, cls_name);
                if (static_decls.empty())
                {
                    continue;
                }

                std::unordered_set<std::string> static_identifiers;
                for (const auto& it : static_decls)
                {
                    static_identifiers.insert(it.first);
                }

                std::string matched_static_identifier;
                std::string return_label;
                if (!function_returns_static_identifier(fn, static_identifiers, matched_static_identifier, return_label))
                {
                    continue;
                }

                CreationalTreeNode fn_node{"SingletonFunction", accessor_name, {}};
                fn_node.children.push_back(CreationalTreeNode{
                    "StaticInstanceDecl",
                    static_decls.at(matched_static_identifier),
                    {}});
                fn_node.children.push_back(CreationalTreeNode{
                    "ReturnIdentifier",
                    return_label,
                    {}});
                fn_node.children.push_back(CreationalTreeNode{
                    "SingletonStrength",
                    singleton_strength_text(accessor_info.strength),
                    {}});

                cls_node.children.push_back(std::move(fn_node));
            }

            if (!cls_node.children.empty())
            {
                root.children.push_back(std::move(cls_node));
            }
        }

        for (const ParseTreeNode& child : node->children)
        {
            stack.push_back(&child);
        }
    }

    return root;
}
