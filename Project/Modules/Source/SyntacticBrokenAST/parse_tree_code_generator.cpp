#include "parse_tree_code_generator.hpp"
#include "Factory/factory_pattern_logic.hpp"
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

std::vector<std::string> extract_factory_class_names(const std::string& source)
{
    std::vector<std::string> names;
    std::unordered_set<std::string> seen;

    const ParseTreeNode parse_root = build_cpp_parse_tree(source);
    const CreationalTreeNode factory_tree = build_factory_pattern_tree(parse_root);

    for (const CreationalTreeNode& class_node : factory_tree.children)
    {
        if (class_node.kind != "ClassNode")
        {
            continue;
        }
        const std::string& name = class_node.label;
        if (seen.insert(name).second)
        {
            names.push_back(name);
        }
    }

    return names;
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

void rewrite_factory_instantiations(std::string& source, const std::string& class_name)
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

std::string transform_factory_to_singleton(const std::string& source)
{
    std::string out = source;
    const std::vector<std::string> factory_classes = extract_factory_class_names(out);
    for (const std::string& name : factory_classes)
    {
        inject_singleton_accessor(out, name);
        rewrite_factory_instantiations(out, name);
    }
    return out;
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
    std::string transformed = source;
    if (lower(source_pattern) == "factory" && lower(target_pattern) == "singleton")
    {
        transformed = transform_factory_to_singleton(source);
    }

    std::ostringstream out;
    out << "// Generated target code\n";
    out << "// source_pattern: " << source_pattern << "\n";
    out << "// target_pattern: " << target_pattern << "\n";
    out << transformed << "\n";
    return out.str();
}