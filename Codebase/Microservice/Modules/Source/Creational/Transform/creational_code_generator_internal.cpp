#include "Transform/creational_code_generator_internal.hpp"

#include "Language-and-Structure/language_tokens.hpp"

#include <cctype>
#include <regex>
#include <sstream>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

namespace creational_codegen_internal
{
std::vector<TransformDecision> g_last_transform_decisions;

std::string lower(const std::string& s)
{
    return lowercase_ascii(s);
}

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

bool is_class_block(const ParseTreeNode& node)
{
    if (node.kind != "Block")
    {
        return false;
    }

    const std::vector<std::string> words = split_words(trim(node.value));
    for (size_t i = 0; i + 1 < words.size(); ++i)
    {
        const std::string kw = lower(words[i]);
        if (kw == "class" || kw == "struct")
        {
            return true;
        }
    }
    return false;
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

    const std::string first = lower(words.front());
    return cfg.function_exclusion_keywords.find(first) == cfg.function_exclusion_keywords.end();
}

std::string class_name_from_signature(const std::string& signature)
{
    const std::vector<std::string> words = split_words(signature);
    for (size_t i = 0; i + 1 < words.size(); ++i)
    {
        const std::string kw = lower(words[i]);
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

TransformDecision& ensure_decision(
    std::unordered_map<std::string, TransformDecision>& decisions_by_class,
    const std::string& class_name)
{
    auto it = decisions_by_class.find(class_name);
    if (it != decisions_by_class.end())
    {
        return it->second;
    }

    TransformDecision decision;
    decision.class_name = class_name;
    auto inserted = decisions_by_class.insert({class_name, std::move(decision)});
    return inserted.first->second;
}

void add_reason_if_missing(TransformDecision& decision, const std::string& reason)
{
    for (const std::string& existing : decision.transform_reason)
    {
        if (existing == reason)
        {
            return;
        }
    }
    decision.transform_reason.push_back(reason);
}

std::vector<std::string> split_lines(const std::string& source)
{
    std::vector<std::string> lines;
    std::string current;

    for (char c : source)
    {
        if (c == '\n')
        {
            lines.push_back(current);
            current.clear();
        }
        else if (c != '\r')
        {
            current.push_back(c);
        }
    }
    lines.push_back(current);
    return lines;
}

std::string join_lines(const std::vector<std::string>& lines)
{
    std::ostringstream out;
    for (size_t i = 0; i < lines.size(); ++i)
    {
        if (i > 0)
        {
            out << '\n';
        }
        out << lines[i];
    }
    return out.str();
}

std::unordered_map<std::string, std::string> collect_singleton_strength_by_class(const CreationalTreeNode& singleton_tree)
{
    std::unordered_map<std::string, std::string> out;
    for (const CreationalTreeNode& class_node : singleton_tree.children)
    {
        if (class_node.kind != "ClassNode" || class_node.label.empty())
        {
            continue;
        }

        std::string strength;
        for (const CreationalTreeNode& fn_node : class_node.children)
        {
            if (fn_node.kind != "SingletonFunction")
            {
                continue;
            }

            for (const CreationalTreeNode& detail : fn_node.children)
            {
                if (detail.kind != "SingletonStrength")
                {
                    continue;
                }

                if (detail.label == "strong")
                {
                    strength = "strong";
                    break;
                }
                if (strength.empty() && detail.label == "weak")
                {
                    strength = "weak";
                }
            }

            if (strength == "strong")
            {
                break;
            }
        }

        if (!strength.empty())
        {
            out[class_node.label] = strength;
        }
    }

    return out;
}

bool is_config_method_name(const std::string& method_name)
{
    const std::string lowered = lower(method_name);
    return starts_with(lowered, "set") ||
           starts_with(lowered, "with") ||
           starts_with(lowered, "enable") ||
           starts_with(lowered, "disable") ||
           starts_with(lowered, "configure");
}

bool is_monolithic_config_method_name(const std::string& method_name)
{
    const std::string lowered = lower(method_name);
    return starts_with(lowered, "set_") ||
           starts_with(lowered, "with_") ||
           starts_with(lowered, "enable_") ||
           starts_with(lowered, "configure_");
}

bool is_monolithic_build_method_name(const std::string& method_name)
{
    const std::string lowered = lower(method_name);
    return lowered == "build" ||
           lowered == "create" ||
           lowered == "make" ||
           lowered == "result" ||
           lowered == "getresult";
}

bool is_build_method_name(const std::string& method_name)
{
    const std::string lowered = lower(method_name);
    return lowered == "build" ||
           lowered == "create" ||
           lowered == "make" ||
           lowered == "result" ||
           lowered == "getresult";
}

bool is_operational_method_name(const std::string& method_name)
{
    const std::string lowered = lower(method_name);
    return !is_config_method_name(method_name) &&
           !is_build_method_name(method_name) &&
           lowered != "instance";
}

bool ends_with(const std::string& text, const std::string& suffix)
{
    return text.size() >= suffix.size() &&
           text.compare(text.size() - suffix.size(), suffix.size(), suffix) == 0;
}

std::string strip_builder_suffix(const std::string& class_name)
{
    if (!ends_with(class_name, "Builder"))
    {
        return class_name;
    }
    return class_name.substr(0, class_name.size() - std::string("Builder").size());
}

void append_unique_token(std::vector<std::string>& out, const std::string& token)
{
    if (token.empty())
    {
        return;
    }
    for (const std::string& existing : out)
    {
        if (existing == token)
        {
            return;
        }
    }
    out.push_back(token);
}

void append_unique_line(std::vector<std::string>& out, const std::string& line)
{
    const std::string normalized = trim(line);
    if (normalized.empty())
    {
        return;
    }
    append_unique_token(out, normalized);
}

void append_unique_lines(std::vector<std::string>& out, const std::vector<std::string>& lines)
{
    for (const std::string& line : lines)
    {
        append_unique_line(out, line);
    }
}

std::string regex_capture_or_empty(const std::smatch& match, size_t index)
{
    if (index >= match.size())
    {
        return {};
    }
    return match[index].str();
}

} // namespace creational_codegen_internal


