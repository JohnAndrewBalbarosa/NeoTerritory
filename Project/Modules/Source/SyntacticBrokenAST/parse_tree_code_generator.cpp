#include "parse_tree_code_generator.hpp"
#include "language_tokens.hpp"
#include "parse_tree.hpp"

#include <regex>
#include <sstream>
#include <string>
#include <unordered_set>
#include <vector>

namespace
{
std::string lower(const std::string& s)
{
    return lowercase_ascii(s);
}

size_t find_matching_brace(const std::string& text, size_t open_pos)
{
    if (open_pos >= text.size() || text[open_pos] != '{')
    {
        return std::string::npos;
    }

    int depth = 0;
    for (size_t i = open_pos; i < text.size(); ++i)
    {
        if (text[i] == '{')
        {
            ++depth;
        }
        else if (text[i] == '}')
        {
            --depth;
            if (depth == 0)
            {
                return i;
            }
        }
    }

    return std::string::npos;
}

void inject_singleton_accessor(std::string& source, const std::string& class_name)
{
    const std::string class_kw = "class " + class_name;
    const std::string struct_kw = "struct " + class_name;

    size_t class_pos = source.find(class_kw);
    if (class_pos == std::string::npos)
    {
        class_pos = source.find(struct_kw);
    }
    if (class_pos == std::string::npos)
    {
        return;
    }

    const size_t open_brace = source.find('{', class_pos);
    if (open_brace == std::string::npos)
    {
        return;
    }
    const size_t close_brace = find_matching_brace(source, open_brace);
    if (close_brace == std::string::npos)
    {
        return;
    }

    std::string class_body = source.substr(open_brace + 1, close_brace - open_brace - 1);
    if (class_body.find("static " + class_name + "& instance(") != std::string::npos)
    {
        return;
    }

    const std::string singleton_method =
        "\n    static " + class_name + "& instance() {\n"
        "        static " + class_name + " singleton_instance;\n"
        "        return singleton_instance;\n"
        "    }\n";

    size_t public_pos = class_body.find("public:");
    if (public_pos != std::string::npos)
    {
        class_body.insert(public_pos + std::string("public:").size(), singleton_method);
    }
    else
    {
        class_body = "\npublic:" + singleton_method + class_body;
    }

    source.replace(open_brace + 1, close_brace - open_brace - 1, class_body);
}

void rewrite_class_instantiations_to_singleton_references(std::string& source, const std::string& class_name)
{
    const std::regex pointer_decl(
        "\\b" + class_name + R"(\s*\*\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*new\s+)" + class_name + R"(\s*\([^;{}]*\)\s*;)");
    source = std::regex_replace(source, pointer_decl, "auto& $1 = " + class_name + "::instance();");

    const std::regex simple_decl("\\b" + class_name + R"(\s+([A-Za-z_][A-Za-z0-9_]*)\s*;)");
    source = std::regex_replace(source, simple_decl, "auto& $1 = " + class_name + "::instance();");

    const std::regex ctor_decl("\\b" + class_name + R"(\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^;{}]*\)\s*;)");
    source = std::regex_replace(source, ctor_decl, "auto& $1 = " + class_name + "::instance();");

    // Undo accidental rewrite inside injected singleton accessor.
    const std::regex bad_singleton_line(
        R"(static\s+auto&\s+singleton_instance\s*=\s*)" + class_name + R"(\s*::\s*instance\s*\(\s*\)\s*;)");
    source = std::regex_replace(source, bad_singleton_line, "static " + class_name + " singleton_instance;");
}

std::vector<std::string> extract_crucial_class_names(
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

    std::vector<std::string> names;
    std::unordered_set<std::string> seen;
    for (const CrucialClassInfo& info : bundle.crucial_classes)
    {
        if (info.name.empty())
        {
            continue;
        }
        if (seen.insert(info.name).second)
        {
            names.push_back(info.name);
        }
    }

    return names;
}

std::string transform_to_singleton_by_class_references(
    const std::string& source,
    const std::string& source_pattern,
    const std::string& target_pattern)
{
    std::string out = source;
    const std::vector<std::string> crucial_classes =
        extract_crucial_class_names(out, source_pattern, target_pattern);

    for (const std::string& class_name : crucial_classes)
    {
        inject_singleton_accessor(out, class_name);
        rewrite_class_instantiations_to_singleton_references(out, class_name);
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
        {"*", "singleton", &transform_to_singleton_by_class_references},
    };
    return rules;
}

std::string transform_using_registered_rule(
    const std::string& source,
    const std::string& source_pattern,
    const std::string& target_pattern)
{
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
} // namespace

std::string generate_base_code_from_source(const std::string& source)
{
    std::ostringstream out;
    out << "// Generated base code\n";
    out << source << "\n";
    return out.str();
}

std::string generate_target_code_from_source(
    const std::string& source,
    const std::string& source_pattern,
    const std::string& target_pattern)
{
    const std::string transformed = transform_using_registered_rule(source, source_pattern, target_pattern);

    std::ostringstream out;
    out << "// Generated target code\n";
    out << "// source_pattern: " << source_pattern << "\n";
    out << "// target_pattern: " << target_pattern << "\n";
    out << transformed << "\n";
    return out.str();
}
