#include "Logic/behavioural_logic_scaffold.hpp"

#include "Language-and-Structure/language_tokens.hpp"
#include "parse_tree_dependency_utils.hpp"

#include <cctype>
#include <string>
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

std::string lower(const std::string& input)
{
    return lowercase_ascii(input);
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
    const std::vector<std::string> words = split_words(signature);
    for (size_t i = 0; i + 1 < words.size(); ++i)
    {
        const std::string token = lower(words[i]);
        if (token == "class" || token == "struct")
        {
            return words[i + 1];
        }
    }

    return {};
}

std::string function_name_from_signature(const std::string& signature)
{
    const std::string t = trim(signature);
    const size_t open = t.find('(');
    if (open == std::string::npos)
    {
        return {};
    }

    const std::vector<std::string> words = split_words(t.substr(0, open));
    if (words.empty())
    {
        return {};
    }

    return words.back();
}

bool is_class_block(const ParseTreeNode& node)
{
    if (node.kind != "Block")
    {
        return false;
    }

    const std::string lowered = lower(trim(node.value));
    return starts_with(lowered, "class ") || starts_with(lowered, "struct ");
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

    return cfg.function_exclusion_keywords.find(lower(words.front())) == cfg.function_exclusion_keywords.end();
}

bool has_keyword(const std::string& text, const std::vector<std::string>& keywords)
{
    const std::string lowered_text = lower(text);
    for (const std::string& keyword : keywords)
    {
        if (lowered_text.find(keyword) != std::string::npos)
        {
            return true;
        }
    }
    return false;
}

std::string join_names(const std::vector<std::string>& names)
{
    std::string out;
    for (size_t i = 0; i < names.size(); ++i)
    {
        if (i > 0)
        {
            out += ",";
        }
        out += names[i];
    }
    return out;
}

bool subtree_mentions_keyword(const ParseTreeNode& root, const std::vector<std::string>& keywords)
{
    std::vector<const ParseTreeNode*> stack{&root};
    while (!stack.empty())
    {
        const ParseTreeNode* node = stack.back();
        stack.pop_back();

        if (has_keyword(node->value, keywords) || has_keyword(node->annotated_value, keywords))
        {
            return true;
        }

        for (const ParseTreeNode& child : node->children)
        {
            stack.push_back(&child);
        }
    }

    return false;
}

struct BehaviouralClassSignals
{
    std::string class_name;
    std::vector<std::string> strategy_like_methods;
    std::vector<std::string> attach_like_methods;
    std::vector<std::string> detach_like_methods;
    std::vector<std::string> notify_like_methods;
    std::vector<std::string> observer_update_like_methods;
    bool has_virtual_method = false;
    bool has_strategy_setter = false;
    bool mentions_strategy_terms = false;
};

BehaviouralClassSignals collect_class_signals(const ParseTreeNode& class_node)
{
    static const std::vector<std::string> k_strategy_terms = {
        "strategy", "algorithm"
    };
    static const std::vector<std::string> k_strategy_exec_terms = {
        "execute", "apply", "run", "algorithm"
    };
    static const std::vector<std::string> k_strategy_setter_terms = {
        "setstrategy", "setalgorithm", "set_policy"
    };
    static const std::vector<std::string> k_attach_terms = {
        "attach", "subscribe", "register", "addobserver", "addlistener"
    };
    static const std::vector<std::string> k_detach_terms = {
        "detach", "unsubscribe", "unregister", "removeobserver", "removelistener"
    };
    static const std::vector<std::string> k_notify_terms = {
        "notify", "publish", "broadcast", "updateobservers"
    };
    static const std::vector<std::string> k_observer_update_terms = {
        "update", "onnotify", "onupdate", "receive"
    };

    BehaviouralClassSignals out;
    out.class_name = class_name_from_signature(class_node.value);
    out.mentions_strategy_terms = subtree_mentions_keyword(class_node, k_strategy_terms);

    for (const ParseTreeNode& child : class_node.children)
    {
        if (!is_function_block(child))
        {
            continue;
        }

        const std::string signature_lower = lower(child.value);
        if (signature_lower.find("virtual") != std::string::npos)
        {
            out.has_virtual_method = true;
        }

        const std::string fn_name = function_name_from_signature(child.value);
        const std::string fn_lower = lower(fn_name);
        if (has_keyword(fn_lower, k_strategy_exec_terms))
        {
            out.strategy_like_methods.push_back(fn_name);
        }
        if (has_keyword(fn_lower, k_strategy_setter_terms))
        {
            out.has_strategy_setter = true;
        }
        if (has_keyword(fn_lower, k_attach_terms))
        {
            out.attach_like_methods.push_back(fn_name);
        }
        if (has_keyword(fn_lower, k_detach_terms))
        {
            out.detach_like_methods.push_back(fn_name);
        }
        if (has_keyword(fn_lower, k_notify_terms))
        {
            out.notify_like_methods.push_back(fn_name);
        }
        if (has_keyword(fn_lower, k_observer_update_terms))
        {
            out.observer_update_like_methods.push_back(fn_name);
        }
    }

    return out;
}
} // namespace

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

ParseTreeNode build_behavioural_structure_checker(const ParseTreeNode& parse_root)
{
    ParseTreeNode root{"BehaviouralStructureCheckRoot", "strategy/observer heuristic checks", {}};

    std::vector<const ParseTreeNode*> stack{&parse_root};
    while (!stack.empty())
    {
        const ParseTreeNode* node = stack.back();
        stack.pop_back();

        if (is_class_block(*node))
        {
            const BehaviouralClassSignals signals = collect_class_signals(*node);
            if (signals.class_name.empty())
            {
                continue;
            }

            const bool strategy_interface_candidate =
                signals.has_virtual_method && !signals.strategy_like_methods.empty();
            const bool strategy_context_candidate =
                signals.has_strategy_setter && signals.mentions_strategy_terms;
            const bool observer_subject_candidate =
                !signals.attach_like_methods.empty() &&
                !signals.detach_like_methods.empty() &&
                !signals.notify_like_methods.empty();
            const bool observer_listener_candidate =
                !signals.observer_update_like_methods.empty() &&
                (signals.has_virtual_method || has_keyword(signals.class_name, {"observer", "listener"}));

            if (strategy_interface_candidate ||
                strategy_context_candidate ||
                observer_subject_candidate ||
                observer_listener_candidate)
            {
                ParseTreeNode class_node;
                class_node.kind = "ClassNode";
                class_node.value = signals.class_name;

                if (strategy_interface_candidate)
                {
                    ParseTreeNode role;
                    role.kind = "StrategyInterfaceCandidate";
                    role.value = "methods=" + join_names(signals.strategy_like_methods);
                    class_node.children.push_back(std::move(role));
                }
                if (strategy_context_candidate)
                {
                    ParseTreeNode role;
                    role.kind = "StrategyContextCandidate";
                    role.value = "setter=true | strategy_terms_in_class=true";
                    class_node.children.push_back(std::move(role));
                }
                if (observer_subject_candidate)
                {
                    ParseTreeNode role;
                    role.kind = "ObserverSubjectCandidate";
                    role.value =
                        "attach=" + join_names(signals.attach_like_methods) +
                        " | detach=" + join_names(signals.detach_like_methods) +
                        " | notify=" + join_names(signals.notify_like_methods);
                    class_node.children.push_back(std::move(role));
                }
                if (observer_listener_candidate)
                {
                    ParseTreeNode role;
                    role.kind = "ObserverListenerCandidate";
                    role.value = "update_methods=" + join_names(signals.observer_update_like_methods);
                    class_node.children.push_back(std::move(role));
                }

                root.children.push_back(std::move(class_node));
            }
        }

        for (const ParseTreeNode& child : node->children)
        {
            stack.push_back(&child);
        }
    }

    return root;
}
