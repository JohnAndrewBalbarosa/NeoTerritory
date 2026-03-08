#include "Transform/creational_code_generator_internal.hpp"
#include "Transform/creational_transform_factory_reverse.hpp"

#include "parse_tree_symbols.hpp"

#include <cctype>
#include <regex>
#include <sstream>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>

namespace creational_codegen_internal
{
struct ConfigMethodModel
{
    std::string method_name;
    bool takes_parameter = false;
    std::string parameter_type;
    std::string parameter_name;
    std::string field_name;
    std::string has_flag_name;
};

struct ClassBuilderModel
{
    std::string class_name;
    std::vector<ConfigMethodModel> methods;
};

std::string derive_field_base_name(const ConfigMethodModel& method)
{
    std::string base = method.parameter_name;
    if (base.empty())
    {
        const std::string lowered = lower(method.method_name);
        const std::vector<std::string> prefixes = {"set", "with", "enable", "disable", "configure"};
        for (const std::string& prefix : prefixes)
        {
            if (starts_with(lowered, prefix))
            {
                base = method.method_name.substr(prefix.size());
                break;
            }
        }
    }

    if (base.empty())
    {
        base = method.method_name;
    }

    std::string sanitized;
    sanitized.reserve(base.size());
    for (char c : base)
    {
        if (std::isalnum(static_cast<unsigned char>(c)) || c == '_')
        {
            sanitized.push_back(static_cast<char>(std::tolower(static_cast<unsigned char>(c))));
        }
    }

    if (sanitized.empty())
    {
        sanitized = "config";
    }

    return sanitized;
}

std::vector<ConfigMethodModel> collect_config_methods_for_class(const ParseTreeNode& parse_root, const std::string& class_name)
{
    const ParseTreeNode* class_node = nullptr;
    std::vector<const ParseTreeNode*> stack{&parse_root};
    while (!stack.empty())
    {
        const ParseTreeNode* node = stack.back();
        stack.pop_back();

        if (is_class_block(*node) && class_name_from_signature(node->value) == class_name)
        {
            class_node = node;
            break;
        }

        for (const ParseTreeNode& child : node->children)
        {
            stack.push_back(&child);
        }
    }

    if (class_node == nullptr)
    {
        return {};
    }

    std::vector<ConfigMethodModel> methods;
    std::unordered_set<std::string> seen_method_names;

    for (const ParseTreeNode& fn_node : class_node->children)
    {
        if (!is_function_block(fn_node))
        {
            continue;
        }

        const std::string method_name = function_name_from_signature(fn_node.value);
        if (!is_config_method_name(method_name))
        {
            continue;
        }

        if (!seen_method_names.insert(method_name).second)
        {
            continue;
        }

        ConfigMethodModel method;
        method.method_name = method_name;

        const std::string signature = trim(fn_node.value);
        const size_t open = signature.find('(');
        const size_t close = signature.find(')', open == std::string::npos ? 0 : open + 1);
        if (open == std::string::npos || close == std::string::npos || close < open)
        {
            continue;
        }

        const std::string params = trim(signature.substr(open + 1, close - open - 1));
        if (!params.empty())
        {
            if (params.find(',') != std::string::npos)
            {
                // Keep the transformer minimal: support one-parameter config methods only.
                continue;
            }

            const std::vector<std::string> words = split_words(params);
            if (words.size() < 2)
            {
                continue;
            }

            method.parameter_name = words.back();
            const size_t name_pos = params.rfind(method.parameter_name);
            if (name_pos == std::string::npos)
            {
                continue;
            }

            method.parameter_type = trim(params.substr(0, name_pos));
            if (method.parameter_type.empty())
            {
                continue;
            }
            method.takes_parameter = true;
        }

        methods.push_back(std::move(method));
    }

    std::unordered_map<std::string, size_t> field_name_counts;
    for (ConfigMethodModel& method : methods)
    {
        const std::string base = derive_field_base_name(method);
        size_t count = field_name_counts[base]++;
        const std::string suffix = count == 0 ? "" : ("_" + std::to_string(count + 1));

        method.field_name = base + suffix + "_value";
        method.has_flag_name = "has_" + base + suffix;
    }

    return methods;
}

std::string generate_builder_class_code(const ClassBuilderModel& model)
{
    std::ostringstream out;
    out << "class " << model.class_name << "Builder {\n";
    out << "public:\n";

    for (const ConfigMethodModel& method : model.methods)
    {
        out << "    " << model.class_name << "Builder& " << method.method_name << "(";
        if (method.takes_parameter)
        {
            out << method.parameter_type << " " << method.parameter_name;
        }
        out << ") {\n";
        if (method.takes_parameter)
        {
            out << "        " << method.field_name << " = " << method.parameter_name << ";\n";
        }
        out << "        " << method.has_flag_name << " = true;\n";
        out << "        return *this;\n";
        out << "    }\n\n";
    }

    out << "    " << model.class_name << " build() const {\n";
    out << "        " << model.class_name << " product;\n";
    for (const ConfigMethodModel& method : model.methods)
    {
        out << "        if (" << method.has_flag_name << ") {\n";
        out << "            product." << method.method_name << "(";
        if (method.takes_parameter)
        {
            out << method.field_name;
        }
        out << ");\n";
        out << "        }\n";
    }
    out << "        return product;\n";
    out << "    }\n\n";

    out << "private:\n";
    for (const ConfigMethodModel& method : model.methods)
    {
        if (method.takes_parameter)
        {
            out << "    " << method.parameter_type << " " << method.field_name << "{};\n";
        }
        out << "    bool " << method.has_flag_name << " = false;\n";
    }
    out << "};\n";

    return out.str();
}

bool inject_builder_class(std::string& source, const ClassBuilderModel& model)
{
    const std::string class_kw = "class " + model.class_name;
    const std::string struct_kw = "struct " + model.class_name;

    size_t class_pos = source.find(class_kw);
    if (class_pos == std::string::npos)
    {
        class_pos = source.find(struct_kw);
    }
    if (class_pos == std::string::npos)
    {
        return false;
    }

    const size_t open_brace = source.find('{', class_pos);
    if (open_brace == std::string::npos)
    {
        return false;
    }

    const size_t close_brace = find_matching_brace(source, open_brace);
    if (close_brace == std::string::npos)
    {
        return false;
    }

    size_t insert_pos = source.find(';', close_brace);
    if (insert_pos == std::string::npos)
    {
        insert_pos = close_brace;
    }

    const std::string builder_name = model.class_name + "Builder";
    if (source.find("class " + builder_name) != std::string::npos ||
        source.find("struct " + builder_name) != std::string::npos)
    {
        return true;
    }

    const std::string builder_code = "\n\n" + generate_builder_class_code(model);
    source.insert(insert_pos + 1, builder_code);
    return true;
}

bool rewrite_simple_singleton_callsite_to_builder(std::string& source, const ClassBuilderModel& model)
{
    std::unordered_set<std::string> config_method_names;
    for (const ConfigMethodModel& method : model.methods)
    {
        config_method_names.insert(method.method_name);
    }

    std::vector<std::string> lines = split_lines(source);
    const std::regex decl_regex(
        R"(^(\s*))" + model.class_name + R"(\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*)" +
        model.class_name + R"(::\s*instance\s*\(\s*\)\s*;\s*$)");

    for (size_t i = 0; i < lines.size(); ++i)
    {
        std::smatch decl_match;
        if (!std::regex_match(lines[i], decl_match, decl_regex))
        {
            continue;
        }

        const std::string indent = decl_match[1].str();
        const std::string variable_name = decl_match[2].str();
        const std::regex method_call_regex(
            R"(^\s*)" + variable_name + R"(\.([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)\s*;\s*$)");

        size_t j = i + 1;
        std::vector<std::string> chain_calls;
        while (j < lines.size())
        {
            std::smatch call_match;
            if (!std::regex_match(lines[j], call_match, method_call_regex))
            {
                break;
            }

            const std::string method_name = call_match[1].str();
            if (config_method_names.find(method_name) == config_method_names.end())
            {
                break;
            }

            chain_calls.push_back("." + method_name + "(" + trim(call_match[2].str()) + ")");
            ++j;
        }

        if (chain_calls.empty())
        {
            continue;
        }

        std::ostringstream rewritten_line;
        rewritten_line << indent
                      << model.class_name << " " << variable_name
                      << " = " << model.class_name << "Builder()";
        for (const std::string& call : chain_calls)
        {
            rewritten_line << call;
        }
        rewritten_line << ".build();";

        lines[i] = rewritten_line.str();
        lines.erase(lines.begin() + static_cast<std::ptrdiff_t>(i + 1), lines.begin() + static_cast<std::ptrdiff_t>(j));
        source = join_lines(lines);
        return true;
    }

    return false;
}

std::string transform_to_singleton_by_class_references(
    const std::string& source,
    const std::string& source_pattern,
    const std::string& target_pattern)
{
    std::string out = source;
    const std::vector<std::string> crucial_classes =
        extract_crucial_class_names(out, source_pattern, target_pattern);

    std::unordered_map<std::string, TransformDecision> decisions_by_class;
    for (const std::string& class_name : crucial_classes)
    {
        TransformDecision& decision = ensure_decision(decisions_by_class, class_name);
        decision.transform_applied = false;
        decision.transform_reason.clear();

        const std::string before_transform = out;
        inject_singleton_accessor(out, class_name);
        rewrite_class_instantiations_to_singleton_references(out, class_name);

        if (out != before_transform)
        {
            decision.transform_applied = true;
            decision.transform_reason.clear();
            continue;
        }

        add_reason_if_missing(decision, "singleton_rewrite_no_matching_class_or_callsite");
    }

    g_last_transform_decisions.clear();
    for (const std::string& class_name : crucial_classes)
    {
        const auto it = decisions_by_class.find(class_name);
        if (it != decisions_by_class.end())
        {
            g_last_transform_decisions.push_back(it->second);
        }
    }

    return out;
}

std::string transform_factory_to_base(
    const std::string& source,
    const std::string& source_pattern,
    const std::string& target_pattern)
{
    (void)source_pattern;
    (void)target_pattern;

    const FactoryReverseTransformResult result =
        transform_factory_to_base_by_direct_instantiation(source);
    g_last_transform_decisions = result.decisions;
    return result.transformed_source;
}

std::string transform_singleton_to_builder(
    const std::string& source,
    const std::string& source_pattern,
    const std::string& target_pattern)
{
    ParseTreeBuildContext context;
    context.source_pattern = source_pattern;
    context.target_pattern = target_pattern;

    std::vector<SourceFileUnit> files;
    files.push_back(SourceFileUnit{"<memory>", source});

    const ParseTreeBundle bundle = build_cpp_parse_trees(files, context);
    const ParseTreeSymbolTables symbols = build_parse_tree_symbol_tables(bundle.main_tree);
    const CreationalTreeNode singleton_tree = build_singleton_pattern_tree(bundle.main_tree);
    const std::unordered_map<std::string, std::string> singleton_strength_by_class =
        collect_singleton_strength_by_class(singleton_tree);

    std::unordered_map<std::string, TransformDecision> decisions_by_class;
    for (const ParseSymbol& symbol : class_symbol_table(symbols))
    {
        ensure_decision(decisions_by_class, symbol.name);
    }

    std::string out = source;
    for (const ParseSymbol& symbol : class_symbol_table(symbols))
    {
        TransformDecision& decision = ensure_decision(decisions_by_class, symbol.name);
        decision.transform_applied = false;
        decision.transform_reason.clear();

        const auto singleton_hit = singleton_strength_by_class.find(symbol.name);
        if (singleton_hit == singleton_strength_by_class.end())
        {
            add_reason_if_missing(decision, "singleton_candidate_not_found");
            continue;
        }

        if (singleton_hit->second == "weak")
        {
            add_reason_if_missing(decision, "singleton_candidate_weak_return_by_value");
            continue;
        }

        ClassBuilderModel model;
        model.class_name = symbol.name;
        model.methods = collect_config_methods_for_class(bundle.main_tree, symbol.name);
        if (model.methods.empty())
        {
            add_reason_if_missing(decision, "no_config_methods_for_builder_synthesis");
            continue;
        }

        if (!inject_builder_class(out, model))
        {
            add_reason_if_missing(decision, "singleton_candidate_not_found");
            continue;
        }

        const bool rewritten = rewrite_simple_singleton_callsite_to_builder(out, model);
        if (!rewritten)
        {
            add_reason_if_missing(decision, "rewrite_failed_callsite_not_supported");
            continue;
        }

        decision.transform_applied = true;
        decision.transform_reason.clear();
    }

    g_last_transform_decisions.clear();
    for (const ParseSymbol& symbol : class_symbol_table(symbols))
    {
        auto it = decisions_by_class.find(symbol.name);
        if (it != decisions_by_class.end())
        {
            g_last_transform_decisions.push_back(it->second);
        }
    }

    return out;
}

using TransformFn = std::string (*)(
    const std::string& source,
    const std::string& source_pattern,
    const std::string& target_pattern);

struct TransformRule
{
    const char* source_pattern;
    const char* target_pattern;
    TransformFn transform;
};

bool pattern_matches(const std::string& normalized_input, const char* expected_pattern)
{
    const std::string expected = lower(expected_pattern == nullptr ? "" : expected_pattern);
    return expected == "*" || expected == normalized_input;
}

const std::vector<TransformRule>& transform_rules()
{
    static const std::vector<TransformRule> rules = {
        {"factory", "base", &transform_factory_to_base},
        {"singleton", "builder", &transform_singleton_to_builder},
        {"*", "singleton", &transform_to_singleton_by_class_references},
    };
    return rules;
}

std::string transform_using_registered_rule(
    const std::string& source,
    const std::string& source_pattern,
    const std::string& target_pattern)
{
    g_last_transform_decisions.clear();

    const std::string normalized_source = lower(source_pattern);
    const std::string normalized_target = lower(target_pattern);

    for (const TransformRule& rule : transform_rules())
    {
        if (!pattern_matches(normalized_source, rule.source_pattern))
        {
            continue;
        }
        if (!pattern_matches(normalized_target, rule.target_pattern))
        {
            continue;
        }
        return rule.transform(source, source_pattern, target_pattern);
    }

    return source;
}

} // namespace creational_codegen_internal


