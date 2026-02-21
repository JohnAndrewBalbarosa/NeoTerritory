// Generated base code

// === FILE: .\Project\main.cpp ===
#include <iostream>

// Forward declaration of the syntactic broken AST runner
int run_syntactic_broken_ast(int argc, char *argv[]);

int main(int argc, char *argv[])
{
    return run_syntactic_broken_ast(argc, argv);
}


// === FILE: .\Project\Layer\Back system\syntacticBrokenAST.cpp ===
#include "source_reader.hpp"
#include "algorithm_pipeline.hpp"
#include "cli_arguments.hpp"
#include "codebase_output_writer.hpp"
#include "lexical_structure_hooks.hpp"
#include "parse_tree.hpp"
#include "parse_tree_code_generator.hpp"
#include "parse_tree_symbols.hpp"
#include "creational_broken_tree.hpp"
#include "behavioural_broken_tree.hpp"

#include <fstream>
#include <iostream>
#include <string>

namespace
{
bool write_text_file(const std::string& path, const std::string& content)
{
    std::ofstream out(path);
    if (!out)
    {
        return false;
    }
    out << content;
    return true;
}
} // namespace

int run_syntactic_broken_ast(int argc, char* argv[])
{
    CliArguments cli;
    std::string cli_error;
    if (!parse_cli_arguments(argc, argv, cli, cli_error))
    {
        std::cerr << cli_error << '\n';
        return 1;
    }

    const std::vector<SourceFileUnit> source_files = read_source_file_units(cli.input_files);
    if (source_files.empty())
    {
        std::cerr << "No source provided.\n";
        return 1;
    }

    const PipelineArtifacts artifacts =
        run_normalize_and_rewrite_pipeline(
            source_files,
            cli.source_pattern,
            cli.target_pattern,
            cli.input_files.size(),
            cli.input_files);
    const ParseTreeNode& tree = artifacts.base_tree;
    const ParseTreeNode& shadow_tree = artifacts.virtual_tree;

    std::cout << "\n=== C++ Parse Tree ===\n";
    std::cout << parse_tree_to_text(tree);

    std::cout << "\n=== Shadow AST (Virtual Tree) ===\n";
    std::cout << parse_tree_to_text(shadow_tree);

    const std::string parse_tree_output_path = "parse_tree.html";
    if (!write_text_file(parse_tree_output_path, parse_tree_to_html(tree)))
    {
        std::cerr << "Failed to write " << parse_tree_output_path << '\n';
        return 1;
    }

    const CreationalTreeNode& creational_tree = artifacts.creational_tree;

    std::cout << "\n=== Creational Broken Tree ===\n";
    std::cout << creational_tree_to_text(creational_tree);

    const std::string creational_output_path = "creational_parse_tree.html";
    if (!write_text_file(creational_output_path, creational_tree_to_html(creational_tree)))
    {
        std::cerr << "Failed to write " << creational_output_path << '\n';
        return 1;
    }

    const ParseTreeNode& behavioural_tree = artifacts.behavioural_tree;

    std::cout << "\n=== Behavioural Broken Tree ===\n";
    std::cout << parse_tree_to_text(behavioural_tree);

    const std::string behavioural_output_path = "behavioural_broken_ast.html";
    if (!write_text_file(behavioural_output_path, behavioural_broken_tree_to_html(behavioural_tree)))
    {
        std::cerr << "Failed to write " << behavioural_output_path << '\n';
        return 1;
    }

    std::cout << "\nHTML parse tree generated: " << parse_tree_output_path << '\n';
    std::cout << "Creational HTML generated: " << creational_output_path << '\n';
    std::cout << "Behavioural HTML generated: " << behavioural_output_path << '\n';

    const std::string merged_source = join_source_file_units(source_files);
    const std::string base_code = generate_base_code_from_source(merged_source);
    const std::string target_code =
        generate_target_code_from_source(merged_source, cli.source_pattern, cli.target_pattern);

    std::cout << "\n=== Generated Base Code ===\n";
    std::cout << base_code << '\n';

    CodebaseOutputPaths code_paths;
    if (!write_codebase_outputs(base_code, target_code, cli.target_pattern, code_paths))
    {
        std::cerr << "Failed to write generated base/target code outputs.\n";
        return 1;
    }

    std::cout << "Generated base code cpp: " << code_paths.base_cpp_path << '\n';
    std::cout << "Generated target code cpp: " << code_paths.target_cpp_path << '\n';
    std::cout << "Generated base code html: " << code_paths.base_html_path << '\n';
    std::cout << "Generated target code html: " << code_paths.target_html_path << '\n';

    std::cout << "\n=== Performance Report ===\n";
    std::cout << "Source pattern: " << artifacts.report.source_pattern << '\n';
    std::cout << "Target pattern: " << artifacts.report.target_pattern << '\n';
    std::cout << "Input files: " << artifacts.report.input_file_count << '\n';
    std::cout << "Total elapsed (ms): " << artifacts.report.total_elapsed_ms << '\n';
    std::cout << "Peak estimated memory (bytes): " << artifacts.report.peak_estimated_bytes << '\n';
    std::cout << "Graph consistent: " << (artifacts.report.graph_consistent ? "true" : "false") << '\n';
    for (const StageMetric& s : artifacts.report.stages)
    {
        std::cout << " - " << s.name
                  << " | elapsed_ms=" << s.elapsed_ms
                  << " | estimated_bytes=" << s.estimated_bytes << '\n';
    }

    std::cout << "\n=== Class Usage Hashes ===\n";
    std::cout << "Crucial classes selected by strategy:\n";
    for (const CrucialClassInfo& info : get_crucial_class_registry())
    {
        std::cout << " - class=" << info.name
                  << " | class_name_hash=" << info.class_name_hash
                  << " | strategy=" << info.strategy_name << '\n';
    }

    for (const ParseSymbol& cls : getClassSymbolTable())
    {
        std::cout << " - class_def=" << cls.name
                  << " | class_name_hash=" << cls.name_hash
                  << " | contextual_hash=" << cls.contextual_hash
                  << " | scoped_hash=" << cls.hash_value
                  << " | definition_node_index=" << cls.definition_node_index << '\n';
    }
    for (const ParseSymbolUsage& usage : getClassUsageTable())
    {
        std::cout << " - class=" << usage.name
                  << " | type=" << usage.type_string
                  << " | node_index=" << usage.node_index
                  << " | node_contextual_hash=" << usage.node_contextual_hash
                  << " | class_name_hash=" << usage.class_name_hash
                  << " | scoped_usage_hash=" << usage.hash_value
                  << " | hash_collision=" << (usage.hash_collision ? "true" : "false")
                  << " | refactor_candidate=" << (usage.refactor_candidate ? "true" : "false")
                  << " | node_kind=" << usage.node_kind << '\n';
    }

    std::cout << "\n=== Line Hash Traces ===\n";
    for (const LineHashTrace& trace : get_line_hash_traces())
    {
        std::cout << " - line=" << trace.line_number
                  << " | class=" << trace.class_name
                  << " | class_hash=" << trace.class_name_hash
                  << " | hit_token_index=" << trace.hit_token_index
                  << " | outgoing_hash=" << trace.outgoing_hash
                  << " | dirty_tokens=" << trace.dirty_token_count
                  << " | collision=" << (trace.hash_collision ? "true" : "false")
                  << '\n';
    }

    const std::string report_output_path = "analysis_report.json";
    if (!write_text_file(report_output_path, pipeline_report_to_json(artifacts.report)))
    {
        std::cerr << "Failed to write " << report_output_path << '\n';
        return 1;
    }
    std::cout << "Performance JSON report generated: " << report_output_path << '\n';

    return 0;
}


// === FILE: .\Project\Modules\Source\Behavioural\behavioural_broken_tree.cpp ===
#include "behavioural_broken_tree.hpp"

#include "Logic/behavioural_logic_scaffold.hpp"
#include "tree_html_renderer.hpp"

ParseTreeNode build_behavioural_broken_tree(const ParseTreeNode& parse_root)
{
    return build_behavioural_function_scaffold(parse_root);
}

std::string behavioural_broken_tree_to_html(const ParseTreeNode& root)
{
    return render_tree_html(root, "Behavioural Broken AST", "No function symbols found.");
}


// === FILE: .\Project\Modules\Source\Behavioural\behavioural_symbol_test.cpp ===
#include "behavioural_symbol_test.hpp"

#include "parse_tree_symbols.hpp"

#include <functional>
#include <sstream>
#include <string>

ParseTreeNode build_behavioural_symbol_test_tree(const ParseTreeNode& parse_root)
{
    rebuild_parse_tree_symbol_tables(parse_root);

    ParseTreeNode root{"BehaviouralSymbolTestRoot", "function symbols as siblings", {}};

    const std::vector<ParseSymbol>& functions = getFunctionSymbolTable();
    for (const ParseSymbol& fn : functions)
    {
        const ParseSymbol* lookup = getFunctionByName(fn.name);
        const size_t expected_hash = std::hash<std::string>{}(fn.name);

        ParseTreeNode child;
        child.kind = "FunctionSymbol";
        child.value = fn.name +
            " | name_hash_ok=" + (fn.name_hash == expected_hash ? std::string("true") : std::string("false")) +
            " | contextual_hash=" + std::to_string(fn.contextual_hash) +
            " | lookup_ok=" + ((lookup != nullptr) ? std::string("true") : std::string("false"));

        root.children.push_back(std::move(child));
    }

    return root;
}

std::string behavioural_symbol_test_to_text(const ParseTreeNode& root)
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


// === FILE: .\Project\Modules\Source\Behavioural\Logic\behavioural_logic_scaffold.cpp ===
#include "Logic/behavioural_logic_scaffold.hpp"

#include "parse_tree_dependency_utils.hpp"
#include "language_tokens.hpp"

#include <string>
#include <utility>

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


// === FILE: .\Project\Modules\Source\Creational\creational_broken_tree.cpp ===
#include "creational_broken_tree.hpp"
#include "Factory/factory_pattern_logic.hpp"
#include "Singleton/singleton_pattern_logic.hpp"
#include "tree_html_renderer.hpp"

#include <functional>
#include <sstream>
#include <string>

CreationalTreeNode build_creational_broken_tree(const ParseTreeNode& root)
{
    CreationalTreeNode out{"CreationalPatternsRoot", "factory + singleton", {}};

    CreationalTreeNode factory_tree = build_factory_pattern_tree(root);
    if (!factory_tree.children.empty())
    {
        out.children.push_back(std::move(factory_tree));
    }

    CreationalTreeNode singleton_tree = build_singleton_pattern_tree(root);
    if (!singleton_tree.children.empty())
    {
        out.children.push_back(std::move(singleton_tree));
    }

    if (out.children.empty())
    {
        out.label = "NoFactoryOrSingletonPatternFound";
    }

    return out;
}

ParseTreeNode creational_tree_to_parse_tree_node(const CreationalTreeNode& root)
{
    ParseTreeNode out;
    out.kind = root.kind;
    out.value = root.label;

    for (const CreationalTreeNode& child : root.children)
    {
        out.children.push_back(creational_tree_to_parse_tree_node(child));
    }

    return out;
}

std::string creational_tree_to_html(const CreationalTreeNode& root)
{
    const ParseTreeNode parse_root = creational_tree_to_parse_tree_node(root);
    return render_tree_html(
        parse_root,
        "Creational Broken Tree",
        "No creational (factory/singleton) pattern found in this source.");
}

std::string creational_tree_to_text(const CreationalTreeNode& root)
{
    std::ostringstream out;

    std::function<void(const CreationalTreeNode&, int)> walk = [&](const CreationalTreeNode& node, int depth) {
        out << std::string(static_cast<size_t>(depth) * 2, ' ') << node.kind;
        if (!node.label.empty())
        {
            out << ": " << node.label;
        }
        out << '\n';

        for (const CreationalTreeNode& child : node.children)
        {
            walk(child, depth + 1);
        }
    };

    walk(root, 0);
    return out.str();
}


// === FILE: .\Project\Modules\Source\Creational\creational_symbol_test.cpp ===
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
            " | name_hash_ok=" + (cls.name_hash == expected_hash ? std::string("true") : std::string("false")) +
            " | contextual_hash=" + std::to_string(cls.contextual_hash) +
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


// === FILE: .\Project\Modules\Source\Creational\Builder\builder_pattern_logic.cpp ===
#include "Builder/builder_pattern_logic.hpp"

#include "language_tokens.hpp"

#include <cctype>
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

std::string lower(const std::string& s)
{
    return lowercase_ascii(s);
}

bool starts_with(const std::string& s, const std::string& p)
{
    return s.size() >= p.size() && s.compare(0, p.size(), p) == 0;
}

bool is_class_block(const ParseTreeNode& node)
{
    if (node.kind != "Block")
    {
        return false;
    }
    const std::string v = lower(trim(node.value));
    return starts_with(v, "class ") || starts_with(v, "struct ");
}

bool is_function_block(const ParseTreeNode& node)
{
    if (node.kind != "Block")
    {
        return false;
    }

    const std::string sig = trim(node.value);
    if (sig.empty() || sig.find('(') == std::string::npos || sig.find(')') == std::string::npos)
    {
        return false;
    }

    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    const std::vector<std::string> words = split_words(sig);
    if (words.empty())
    {
        return false;
    }
    return cfg.function_exclusion_keywords.find(lower(words.front())) == cfg.function_exclusion_keywords.end();
}

std::string class_name(const std::string& sig)
{
    const std::vector<std::string> words = split_words(sig);
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

std::string function_name(const std::string& sig)
{
    const std::string t = trim(sig);
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

bool has_builder_assignments(const ParseTreeNode& fn)
{
    for (const ParseTreeNode& n : fn.children)
    {
        if (n.kind == "AssignmentOrVarDecl" || n.kind == "MemberAssignment")
        {
            return true;
        }
    }
    return false;
}
} // namespace

CreationalTreeNode build_builder_pattern_tree(const ParseTreeNode& parse_root)
{
    CreationalTreeNode root{"BuilderPatternRoot", "class with multiple assignment-oriented methods", {}};

    std::vector<const ParseTreeNode*> stack{&parse_root};
    while (!stack.empty())
    {
        const ParseTreeNode* node = stack.back();
        stack.pop_back();

        if (is_class_block(*node))
        {
            CreationalTreeNode cls{"ClassNode", class_name(node->value), {}};

            int qualifying_fn_count = 0;
            for (const ParseTreeNode& fn : node->children)
            {
                if (!is_function_block(fn))
                {
                    continue;
                }
                if (!has_builder_assignments(fn))
                {
                    continue;
                }

                ++qualifying_fn_count;
                cls.children.push_back(CreationalTreeNode{"BuilderMethod", function_name(fn.value), {}});
            }

            if (qualifying_fn_count >= 2)
            {
                root.children.push_back(std::move(cls));
            }
        }

        for (const ParseTreeNode& child : node->children)
        {
            stack.push_back(&child);
        }
    }

    return root;
}


// === FILE: .\Project\Modules\Source\Creational\Factory\factory_pattern_logic.cpp ===
#include "Factory/factory_pattern_logic.hpp"

#include "language_tokens.hpp"
#include "parse_tree_symbols.hpp"

#include <cctype>
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
        if (cfg.class_keywords.find(to_lower(words[i])) != cfg.class_keywords.end())
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

bool is_class_block(const ParseTreeNode& node)
{
    if (node.kind != "Block")
    {
        return false;
    }

    const std::string lowered = to_lower(trim(node.value));
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

    const std::string first = to_lower(words.front());
    return cfg.function_exclusion_keywords.find(first) == cfg.function_exclusion_keywords.end();
}

bool is_conditional_block(const ParseTreeNode& node)
{
    if (node.kind != "Block")
    {
        return false;
    }

    const std::string lowered = to_lower(trim(node.value));
    return starts_with(lowered, "if") || starts_with(lowered, "else if") || starts_with(lowered, "switch");
}

std::string extract_return_expr(const std::string& value)
{
    std::string expr = trim(value);
    const std::string lowered = to_lower(expr);
    if (starts_with(lowered, "return"))
    {
        expr = trim(expr.substr(6));
    }
    return expr;
}

std::string extract_type_in_angle_brackets(const std::string& expr)
{
    const size_t l = expr.find('<');
    const size_t r = expr.find('>', l == std::string::npos ? 0 : l + 1);
    if (l == std::string::npos || r == std::string::npos || r <= l + 1)
    {
        return {};
    }
    return trim(expr.substr(l + 1, r - l - 1));
}

std::string remove_spaces(const std::string& input)
{
    std::string out;
    out.reserve(input.size());
    for (char c : input)
    {
        if (!std::isspace(static_cast<unsigned char>(c)))
        {
            out.push_back(c);
        }
    }
    return out;
}

bool is_factory_allocator_return(const std::string& return_expr, std::string& out_matched_class)
{
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    const std::string lowered = to_lower(trim(return_expr));
    const std::string lowered_no_space = remove_spaces(lowered);

    if (starts_with(lowered, "new "))
    {
        const std::vector<std::string> words = split_words(return_expr.substr(4));
        if (!words.empty() && getClassByName(words.front()) != nullptr)
        {
            out_matched_class = words.front();
            return true;
        }
        return false;
    }

    for (const std::string& allocator : cfg.allocator_template_functions)
    {
        if (lowered_no_space.find(allocator + "<") != std::string::npos)
        {
            const std::string class_candidate = extract_type_in_angle_brackets(return_expr);
            if (!class_candidate.empty() && getClassByName(class_candidate) != nullptr)
            {
                out_matched_class = class_candidate;
                return true;
            }
        }
    }

    return false;
}
} // namespace

CreationalTreeNode build_factory_pattern_tree(const ParseTreeNode& parse_root)
{
    rebuild_parse_tree_symbol_tables(parse_root);

    CreationalTreeNode root{"FactoryPatternRoot", "class/function/conditional/allocator-return", {}};

    std::vector<const ParseTreeNode*> class_blocks;
    std::vector<const ParseTreeNode*> stack{&parse_root};
    while (!stack.empty())
    {
        const ParseTreeNode* node = stack.back();
        stack.pop_back();
        if (is_class_block(*node))
        {
            class_blocks.push_back(node);
        }
        for (const ParseTreeNode& child : node->children)
        {
            stack.push_back(&child);
        }
    }

    for (const ParseTreeNode* cls : class_blocks)
    {
        CreationalTreeNode class_node{"ClassNode", class_name_from_signature(cls->value), {}};

        for (const ParseTreeNode& fn : cls->children)
        {
            if (!is_function_block(fn))
            {
                continue;
            }

            CreationalTreeNode fn_node{"FunctionNode", function_name_from_signature(fn.value), {}};

            for (const ParseTreeNode& cond : fn.children)
            {
                if (!is_conditional_block(cond))
                {
                    continue;
                }

                CreationalTreeNode cond_node{"ConditionalNode", trim(cond.value), {}};

                for (const ParseTreeNode& inner : cond.children)
                {
                    if (inner.kind != "ReturnStatement")
                    {
                        continue;
                    }

                    const std::string expr = extract_return_expr(inner.value);
                    std::string matched_class;
                    if (is_factory_allocator_return(expr, matched_class))
                    {
                        cond_node.children.push_back(
                            CreationalTreeNode{"AllocatorReturn", expr + " | class=" + matched_class, {}});
                    }
                }

                if (!cond_node.children.empty())
                {
                    fn_node.children.push_back(std::move(cond_node));
                }
            }

            if (!fn_node.children.empty())
            {
                class_node.children.push_back(std::move(fn_node));
            }
        }

        if (!class_node.children.empty())
        {
            root.children.push_back(std::move(class_node));
        }
    }

    return root;
}


// === FILE: .\Project\Modules\Source\Creational\Logic\creational_logic_scaffold.cpp ===
#include "Logic/creational_logic_scaffold.hpp"

#include "parse_tree_dependency_utils.hpp"

#include <string>
#include <utility>

CreationalTreeNode build_creational_class_scaffold(const ParseTreeNode& parse_root)
{
    CreationalTreeNode root{"CreationalEntryRoot", "class traversal scaffold", {}};

    const std::vector<DependencySymbolNode> classes = collect_dependency_class_nodes(parse_root);
    for (const DependencySymbolNode& cls : classes)
    {
        CreationalTreeNode class_node;
        class_node.kind = "ClassNode";
        class_node.label = cls.name + " | hash=" + std::to_string(cls.hash_value);
        root.children.push_back(std::move(class_node));
    }

    return root;
}


// === FILE: .\Project\Modules\Source\Creational\Singleton\singleton_pattern_logic.cpp ===
#include "Singleton/singleton_pattern_logic.hpp"

#include "language_tokens.hpp"

#include <cctype>
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

bool is_class_block(const ParseTreeNode& node)
{
    if (node.kind != "Block")
    {
        return false;
    }

    const std::string lowered = to_lower(trim(node.value));
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

    const std::string first = to_lower(words.front());
    return cfg.function_exclusion_keywords.find(first) == cfg.function_exclusion_keywords.end();
}

std::string extract_return_identifier(const ParseTreeNode& node)
{
    if (node.kind != "ReturnStatement")
    {
        return {};
    }

    std::string expr = trim(node.value);
    const std::string lowered = to_lower(expr);
    if (starts_with(lowered, "return"))
    {
        expr = trim(expr.substr(6));
    }

    const std::vector<std::string> words = split_words(expr);
    if (words.empty())
    {
        return {};
    }

    return words.front();
}

bool find_static_same_class_identifier(const ParseTreeNode& fn_node, const std::string& class_name, std::string& out_identifier)
{
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
                    out_identifier = words[i + 2];
                    return true;
                }
            }
        }

        for (const ParseTreeNode& child : node->children)
        {
            stack.push_back(&child);
        }
    }

    return false;
}

bool function_returns_identifier(const ParseTreeNode& fn_node, const std::string& identifier)
{
    std::vector<const ParseTreeNode*> stack{&fn_node};
    while (!stack.empty())
    {
        const ParseTreeNode* node = stack.back();
        stack.pop_back();

        const std::string ret_id = extract_return_identifier(*node);
        if (!ret_id.empty() && ret_id == identifier)
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

                std::string static_identifier;
                if (!find_static_same_class_identifier(fn, cls_name, static_identifier))
                {
                    continue;
                }

                if (!function_returns_identifier(fn, static_identifier))
                {
                    continue;
                }

                CreationalTreeNode fn_node{"SingletonFunction", function_name_from_signature(fn.value), {}};
                fn_node.children.push_back(CreationalTreeNode{
                    "StaticInstanceDecl",
                    "static " + cls_name + " " + static_identifier,
                    {}});
                fn_node.children.push_back(CreationalTreeNode{
                    "ReturnIdentifier",
                    static_identifier,
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


// === FILE: .\Project\Modules\Source\SyntacticBrokenAST\algorithm_pipeline.cpp ===
#include "algorithm_pipeline.hpp"

#include "parse_tree_symbols.hpp"

#include <algorithm>
#include <chrono>
#include <sstream>
#include <string>

namespace
{
using Clock = std::chrono::steady_clock;

size_t estimate_parse_tree_bytes(const ParseTreeNode& node)
{
    size_t total = sizeof(ParseTreeNode) + node.kind.size() + node.value.size();
    total += node.children.capacity() * sizeof(ParseTreeNode);

    for (const ParseTreeNode& child : node.children)
    {
        total += estimate_parse_tree_bytes(child);
    }

    return total;
}

size_t estimate_creational_tree_bytes(const CreationalTreeNode& node)
{
    size_t total = sizeof(CreationalTreeNode) + node.kind.size() + node.label.size();
    total += node.children.capacity() * sizeof(CreationalTreeNode);

    for (const CreationalTreeNode& child : node.children)
    {
        total += estimate_creational_tree_bytes(child);
    }

    return total;
}

size_t estimate_symbol_table_bytes()
{
    size_t total = 0;

    const std::vector<ParseSymbol>& classes = getClassSymbolTable();
    const std::vector<ParseSymbol>& functions = getFunctionSymbolTable();

    total += classes.capacity() * sizeof(ParseSymbol);
    total += functions.capacity() * sizeof(ParseSymbol);

    for (const ParseSymbol& s : classes)
    {
        total += s.name.size() + s.signature.size();
    }
    for (const ParseSymbol& s : functions)
    {
        total += s.name.size() + s.signature.size();
    }

    return total;
}

std::string json_escape(const std::string& input)
{
    std::string out;
    out.reserve(input.size());
    for (char c : input)
    {
        switch (c)
        {
            case '\\': out += "\\\\"; break;
            case '"': out += "\\\""; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default: out.push_back(c); break;
        }
    }
    return out;
}
} // namespace

PipelineArtifacts run_normalize_and_rewrite_pipeline(
    const std::vector<SourceFileUnit>& source_files,
    const std::string& source_pattern,
    const std::string& target_pattern,
    size_t input_file_count,
    const std::vector<std::string>& input_files)
{
    PipelineArtifacts artifacts;
    artifacts.report.source_pattern = source_pattern;
    artifacts.report.target_pattern = target_pattern;
    artifacts.report.input_file_count = input_file_count;
    artifacts.report.total_elapsed_ms = 0.0;
    artifacts.report.peak_estimated_bytes = 0;
    artifacts.report.graph_consistent = false;

    const Clock::time_point pipeline_begin = Clock::now();

    auto run_stage = [&](const std::string& name, auto&& fn) {
        const Clock::time_point begin = Clock::now();
        const size_t bytes = fn();
        const Clock::time_point end = Clock::now();

        StageMetric m;
        m.name = name;
        m.elapsed_ms = std::chrono::duration<double, std::milli>(end - begin).count();
        m.estimated_bytes = bytes;
        artifacts.report.stages.push_back(std::move(m));
        artifacts.report.peak_estimated_bytes = std::max(artifacts.report.peak_estimated_bytes, bytes);
    };

    // 1) Input parse -> base graph
    run_stage("ParseBaseGraph", [&]() {
        ParseTreeBuildContext context;
        context.source_pattern = source_pattern;
        context.target_pattern = target_pattern;
        context.input_files = input_files;
        set_parse_tree_build_context(context);
        const ParseTreeBundle trees = build_cpp_parse_trees(source_files);
        artifacts.base_tree = trees.main_tree;
        artifacts.virtual_tree = trees.shadow_tree;
        return estimate_parse_tree_bytes(artifacts.base_tree) +
               estimate_parse_tree_bytes(artifacts.virtual_tree) +
               estimate_symbol_table_bytes();
    });

    // 2) Detect patterns
    run_stage("DetectPatternInstances", [&]() {
        artifacts.creational_tree = build_creational_broken_tree(artifacts.base_tree);
        artifacts.behavioural_tree = build_behavioural_broken_tree(artifacts.base_tree);
        return estimate_creational_tree_bytes(artifacts.creational_tree) +
               estimate_parse_tree_bytes(artifacts.behavioural_tree);
    });

    // 3) Create virtual subgraph
    run_stage("CreateVirtualSubgraph", [&]() {
        // Shadow AST is built during lexical parsing to preserve scope-local usage context.
        return estimate_parse_tree_bytes(artifacts.virtual_tree);
    });

    // 4) Hash affected nodes (symbol tables)
    run_stage("HashAffectedNodes", [&]() {
        rebuild_parse_tree_symbol_tables(artifacts.base_tree);
        return estimate_symbol_table_bytes();
    });

    // 5) Generate monolithic representation
    run_stage("GenerateMonolithicRepresentation", [&]() {
        artifacts.monolithic_representation = parse_tree_to_text(artifacts.virtual_tree);
        return artifacts.monolithic_representation.size();
    });

    // 6) Apply target policies (scaffold/no-op)
    run_stage("ApplyTargetPolicies", [&]() {
        return estimate_parse_tree_bytes(artifacts.base_tree);
    });

    // 7) Validate consistency
    run_stage("ValidateGraphConsistency", [&]() {
        artifacts.report.graph_consistent =
            !artifacts.base_tree.kind.empty() &&
            !artifacts.virtual_tree.kind.empty() &&
            (!artifacts.monolithic_representation.empty());
        return estimate_parse_tree_bytes(artifacts.base_tree);
    });

    const Clock::time_point pipeline_end = Clock::now();
    artifacts.report.total_elapsed_ms =
        std::chrono::duration<double, std::milli>(pipeline_end - pipeline_begin).count();

    return artifacts;
}

std::string pipeline_report_to_json(const PipelineReport& report)
{
    std::ostringstream out;
    out << "{\n";
    out << "  \"source_pattern\": \"" << json_escape(report.source_pattern) << "\",\n";
    out << "  \"target_pattern\": \"" << json_escape(report.target_pattern) << "\",\n";
    out << "  \"input_file_count\": " << report.input_file_count << ",\n";
    out << "  \"total_elapsed_ms\": " << report.total_elapsed_ms << ",\n";
    out << "  \"peak_estimated_bytes\": " << report.peak_estimated_bytes << ",\n";
    out << "  \"graph_consistent\": " << (report.graph_consistent ? "true" : "false") << ",\n";
    out << "  \"class_registry\": [\n";

    const std::vector<ParseSymbol>& class_symbols = getClassSymbolTable();
    for (size_t i = 0; i < class_symbols.size(); ++i)
    {
        const ParseSymbol& s = class_symbols[i];
        out << "    {\n";
        out << "      \"name\": \"" << json_escape(s.name) << "\",\n";
        out << "      \"name_hash\": " << s.name_hash << ",\n";
        out << "      \"contextual_hash\": " << s.contextual_hash << ",\n";
        out << "      \"hash\": " << s.hash_value << ",\n";
        out << "      \"definition_node_index\": " << s.definition_node_index << "\n";
        out << "    }";
        if (i + 1 < class_symbols.size())
        {
            out << ",";
        }
        out << "\n";
    }

    out << "  ],\n";
    out << "  \"class_usages\": [\n";

    const std::vector<ParseSymbolUsage>& class_usages = getClassUsageTable();
    for (size_t i = 0; i < class_usages.size(); ++i)
    {
        const ParseSymbolUsage& u = class_usages[i];
        out << "    {\n";
        out << "      \"name\": \"" << json_escape(u.name) << "\",\n";
        out << "      \"type_string\": \"" << json_escape(u.type_string) << "\",\n";
        out << "      \"node_kind\": \"" << json_escape(u.node_kind) << "\",\n";
        out << "      \"node_value\": \"" << json_escape(u.node_value) << "\",\n";
        out << "      \"node_index\": " << u.node_index << ",\n";
        out << "      \"node_contextual_hash\": " << u.node_contextual_hash << ",\n";
        out << "      \"class_name_hash\": " << u.class_name_hash << ",\n";
        out << "      \"hash_collision\": " << (u.hash_collision ? "true" : "false") << ",\n";
        out << "      \"refactor_candidate\": " << (u.refactor_candidate ? "true" : "false") << ",\n";
        out << "      \"hash\": " << u.hash_value << "\n";
        out << "    }";
        if (i + 1 < class_usages.size())
        {
            out << ",";
        }
        out << "\n";
    }

    out << "  ],\n";
    out << "  \"line_hash_traces\": [\n";

    const std::vector<LineHashTrace>& traces = get_line_hash_traces();
    for (size_t i = 0; i < traces.size(); ++i)
    {
        const LineHashTrace& t = traces[i];
        out << "    {\n";
        out << "      \"line_number\": " << t.line_number << ",\n";
        out << "      \"class_name\": \"" << json_escape(t.class_name) << "\",\n";
        out << "      \"class_name_hash\": " << t.class_name_hash << ",\n";
        out << "      \"hit_token_index\": " << t.hit_token_index << ",\n";
        out << "      \"outgoing_hash\": " << t.outgoing_hash << ",\n";
        out << "      \"dirty_token_count\": " << t.dirty_token_count << ",\n";
        out << "      \"hash_collision\": " << (t.hash_collision ? "true" : "false") << "\n";
        out << "    }";
        if (i + 1 < traces.size())
        {
            out << ",";
        }
        out << "\n";
    }

    out << "  ],\n";
    out << "  \"stages\": [\n";

    for (size_t i = 0; i < report.stages.size(); ++i)
    {
        const StageMetric& s = report.stages[i];
        out << "    {\n";
        out << "      \"name\": \"" << json_escape(s.name) << "\",\n";
        out << "      \"elapsed_ms\": " << s.elapsed_ms << ",\n";
        out << "      \"estimated_bytes\": " << s.estimated_bytes << "\n";
        out << "    }";
        if (i + 1 < report.stages.size())
        {
            out << ",";
        }
        out << "\n";
    }

    out << "  ]\n";
    out << "}\n";
    return out.str();
}


// === FILE: .\Project\Modules\Source\SyntacticBrokenAST\cli_arguments.cpp ===
#include "cli_arguments.hpp"

#include <string>

bool parse_cli_arguments(int argc, char* argv[], CliArguments& out, std::string& error)
{
    // Required:
    // argv[1] = source design pattern
    // argv[2] = target design pattern
    // argv[3..] = one or many input files
    if (argc < 4)
    {
        error = "Usage: NeoTerritory <source_pattern> <target_pattern> <file1> [file2 ...]";
        return false;
    }

    out.source_pattern = argv[1] == nullptr ? "" : std::string(argv[1]);
    out.target_pattern = argv[2] == nullptr ? "" : std::string(argv[2]);
    out.input_files.clear();

    for (int i = 3; i < argc; ++i)
    {
        if (argv[i] == nullptr)
        {
            continue;
        }
        const std::string path = argv[i];
        if (!path.empty())
        {
            out.input_files.push_back(path);
        }
    }

    if (out.source_pattern.empty() || out.target_pattern.empty())
    {
        error = "Source and target design pattern parameters are required.";
        return false;
    }
    if (out.input_files.empty())
    {
        error = "At least one input file is required.";
        return false;
    }

    return true;
}


// === FILE: .\Project\Modules\Source\SyntacticBrokenAST\codebase_output_writer.cpp ===
#include "codebase_output_writer.hpp"

#include <fstream>
#include <cctype>
#include <string>

namespace
{
std::string escape_html(const std::string& input)
{
    std::string out;
    out.reserve(input.size());

    for (char c : input)
    {
        switch (c)
        {
            case '&': out += "&amp;"; break;
            case '<': out += "&lt;"; break;
            case '>': out += "&gt;"; break;
            case '"': out += "&quot;"; break;
            case '\'': out += "&#39;"; break;
            default: out.push_back(c); break;
        }
    }

    return out;
}

std::string code_to_html(const std::string& title, const std::string& code)
{
    std::string html;
    html += "<!doctype html>\n<html lang=\"en\">\n<head>\n";
    html += "  <meta charset=\"utf-8\">\n";
    html += "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n";
    html += "  <title>" + escape_html(title) + "</title>\n";
    html += "  <style>body{font-family:Consolas,monospace;margin:24px;background:#f8fbff;color:#1f2937;}pre{white-space:pre-wrap;border:1px solid #d1d5db;padding:12px;background:#fff;}</style>\n";
    html += "</head>\n<body>\n";
    html += "  <h1>" + escape_html(title) + "</h1>\n";
    html += "  <pre>" + escape_html(code) + "</pre>\n";
    html += "</body>\n</html>\n";
    return html;
}

std::string sanitize_component(const std::string& text)
{
    std::string out;
    out.reserve(text.size());

    for (char c : text)
    {
        const unsigned char uc = static_cast<unsigned char>(c);
        if (std::isalnum(uc) || c == '_' || c == '-')
        {
            out.push_back(c);
        }
        else if (c == ' ' || c == '/')
        {
            out.push_back('_');
        }
    }

    if (out.empty())
    {
        out = "unknown_target";
    }

    return out;
}
} // namespace

bool write_codebase_outputs(
    const std::string& base_code,
    const std::string& target_code,
    const std::string& target_pattern,
    CodebaseOutputPaths& out_paths)
{
    const std::string safe_target_pattern = sanitize_component(target_pattern);

    out_paths.base_cpp_path = "generated_base_code.cpp";
    out_paths.target_cpp_path = "generated_target_code_" + safe_target_pattern + ".cpp";
    out_paths.base_html_path = "generated_base_code.html";
    out_paths.target_html_path = "generated_target_code_" + safe_target_pattern + ".html";

    std::ofstream base_cpp(out_paths.base_cpp_path);
    std::ofstream target_cpp(out_paths.target_cpp_path);
    std::ofstream base_html(out_paths.base_html_path);
    std::ofstream target_html(out_paths.target_html_path);

    if (!base_cpp || !target_cpp || !base_html || !target_html)
    {
        return false;
    }

    base_cpp << base_code;
    target_cpp << target_code;
    base_html << code_to_html("Generated Base Code", base_code);
    target_html << code_to_html("Generated Target Code", target_code);
    return true;
}


// === FILE: .\Project\Modules\Source\SyntacticBrokenAST\language_tokens.cpp ===
#include "language_tokens.hpp"

#include <algorithm>
#include <cctype>
#include <stdexcept>

namespace
{
LanguageTokenConfig build_cpp_tokens()
{
    LanguageTokenConfig cfg;

    cfg.node_translation_unit = "TranslationUnit";
    cfg.node_block = "Block";
    cfg.node_statement = "Statement";
    cfg.node_return_statement = "ReturnStatement";
    cfg.node_class_decl = "ClassDecl";
    cfg.node_struct_decl = "StructDecl";
    cfg.node_namespace_decl = "NamespaceDecl";
    cfg.node_conditional_statement = "ConditionalStatement";
    cfg.node_loop_statement = "LoopStatement";
    cfg.node_assignment_or_decl = "AssignmentOrVarDecl";
    cfg.node_member_assignment = "MemberAssignment";

    cfg.token_open_brace = "{";
    cfg.token_close_brace = "}";
    cfg.token_statement_end = ";";
    cfg.token_assignment = "=";
    cfg.token_scope_operator = "::";
    cfg.token_member_arrow = "->";

    cfg.class_keywords = {"class", "struct"};
    cfg.conditional_keywords = {"if", "switch", "else"};
    cfg.loop_keywords = {"for", "while", "do"};
    cfg.function_exclusion_keywords = {
        "if", "else", "switch", "for", "while", "do", "class", "struct"
    };
    cfg.primitive_type_keywords = {
        "auto", "bool", "char", "double", "float", "int", "long", "short",
        "signed", "size_t", "std", "string", "unsigned", "void"
    };
    cfg.allocator_keywords = {"new"};
    cfg.allocator_template_functions = {"make_unique", "make_shared", "allocate_shared"};

    return cfg;
}
} // namespace

const LanguageTokenConfig& language_tokens(LanguageId language_id)
{
    static const LanguageTokenConfig cpp_tokens = build_cpp_tokens();

    switch (language_id)
    {
        case LanguageId::Cpp:
            return cpp_tokens;
    }

    throw std::runtime_error("Unsupported language id");
}

std::string lowercase_ascii(const std::string& input)
{
    std::string lowered = input;
    std::transform(lowered.begin(), lowered.end(), lowered.begin(), [](unsigned char c) {
        return static_cast<char>(std::tolower(c));
    });
    return lowered;
}


// === FILE: .\Project\Modules\Source\SyntacticBrokenAST\lexical_structure_hooks.cpp ===
#include "lexical_structure_hooks.hpp"

#include "language_tokens.hpp"

#include <functional>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

namespace
{
class IStructuralAnalyzer
{
public:
    virtual ~IStructuralAnalyzer() = default;
    virtual const char* strategy_name() const = 0;
    virtual bool is_crucial_class(
        const std::string& class_name,
        const std::vector<std::string>& declaration_tokens) const = 0;
};

class KeywordAnalyzer final : public IStructuralAnalyzer
{
public:
    KeywordAnalyzer(std::string name, std::vector<std::string> keywords)
        : strategy_name_(std::move(name)), keywords_(std::move(keywords))
    {
    }

    const char* strategy_name() const override
    {
        return strategy_name_.c_str();
    }

    bool is_crucial_class(
        const std::string& class_name,
        const std::vector<std::string>& declaration_tokens) const override
    {
        const std::string lowered_name = lowercase_ascii(class_name);
        for (const std::string& keyword : keywords_)
        {
            if (lowered_name.find(keyword) != std::string::npos)
            {
                return true;
            }
        }

        for (const std::string& token : declaration_tokens)
        {
            const std::string lowered_token = lowercase_ascii(token);
            for (const std::string& keyword : keywords_)
            {
                if (lowered_token.find(keyword) != std::string::npos)
                {
                    return true;
                }
            }
        }

        return false;
    }

private:
    std::string strategy_name_;
    std::vector<std::string> keywords_;
};

const IStructuralAnalyzer& select_analyzer(const std::string& source_pattern)
{
    static const KeywordAnalyzer factory_analyzer(
        "FactoryStructuralStrategy",
        {"factory", "creator", "create"});
    static const KeywordAnalyzer singleton_analyzer(
        "SingletonStructuralStrategy",
        {"singleton", "instance", "config"});
    static const KeywordAnalyzer builder_analyzer(
        "BuilderStructuralStrategy",
        {"builder", "build", "director"});
    static const KeywordAnalyzer strategy_analyzer(
        "StrategyStructuralStrategy",
        {"strategy", "context"});
    static const KeywordAnalyzer observer_analyzer(
        "ObserverStructuralStrategy",
        {"observer", "subject", "listener"});
    static const KeywordAnalyzer null_analyzer(
        "NullStructuralStrategy",
        {});

    const std::string pattern = lowercase_ascii(source_pattern);
    if (pattern == "factory")
    {
        return factory_analyzer;
    }
    if (pattern == "singleton")
    {
        return singleton_analyzer;
    }
    if (pattern == "builder")
    {
        return builder_analyzer;
    }
    if (pattern == "strategy")
    {
        return strategy_analyzer;
    }
    if (pattern == "observer")
    {
        return observer_analyzer;
    }

    return null_analyzer;
}

std::unordered_map<std::string, size_t> g_crucial_class_hash_by_name;
std::vector<CrucialClassInfo> g_crucial_class_registry;
} // namespace

void on_class_scanned_structural_hook(
    const std::string& class_name,
    const std::vector<std::string>& declaration_tokens,
    const ParseTreeBuildContext& context)
{
    const IStructuralAnalyzer& analyzer = select_analyzer(context.source_pattern);
    if (!analyzer.is_crucial_class(class_name, declaration_tokens))
    {
        return;
    }

    if (g_crucial_class_hash_by_name.find(class_name) != g_crucial_class_hash_by_name.end())
    {
        return;
    }

    const size_t class_name_hash = std::hash<std::string>{}(class_name);
    g_crucial_class_hash_by_name[class_name] = class_name_hash;

    CrucialClassInfo info;
    info.name = class_name;
    info.class_name_hash = class_name_hash;
    info.strategy_name = analyzer.strategy_name();
    g_crucial_class_registry.push_back(std::move(info));
}

void reset_structural_analysis_state()
{
    g_crucial_class_hash_by_name.clear();
    g_crucial_class_registry.clear();
}

bool is_crucial_class_name(const std::string& class_name, size_t* out_class_name_hash)
{
    const auto it = g_crucial_class_hash_by_name.find(class_name);
    if (it == g_crucial_class_hash_by_name.end())
    {
        return false;
    }

    if (out_class_name_hash != nullptr)
    {
        *out_class_name_hash = it->second;
    }
    return true;
}

const std::vector<CrucialClassInfo>& get_crucial_class_registry()
{
    return g_crucial_class_registry;
}


// === FILE: .\Project\Modules\Source\SyntacticBrokenAST\parse_tree.cpp ===
#include "parse_tree.hpp"

#include "language_tokens.hpp"
#include "lexical_structure_hooks.hpp"
#include "parse_tree_symbols.hpp"
#include "tree_html_renderer.hpp"

#include <cctype>
#include <functional>
#include <sstream>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>

namespace
{
ParseTreeBuildContext g_build_context;
std::vector<LineHashTrace> g_line_hash_traces;

size_t hash_combine_token(size_t seed, const std::string& token)
{
    return std::hash<std::string>{}(std::to_string(seed) + "|" + token);
}

size_t derive_child_context_hash(
    size_t parent_hash,
    const std::string& kind,
    const std::string& value,
    size_t sibling_index)
{
    return std::hash<std::string>{}(
        std::to_string(parent_hash) +
        "|" + kind +
        "|" + value +
        "|" + std::to_string(sibling_index));
}

void add_unique_hash(std::vector<size_t>& hashes, size_t hash_value)
{
    for (size_t existing : hashes)
    {
        if (existing == hash_value)
        {
            return;
        }
    }
    hashes.push_back(hash_value);
}

std::string usage_hash_suffix(const std::vector<size_t>& active_usage_hashes)
{
    if (active_usage_hashes.empty())
    {
        return {};
    }

    std::ostringstream out;
    out << "@[";
    for (size_t i = 0; i < active_usage_hashes.size(); ++i)
    {
        if (i > 0)
        {
            out << ",";
        }
        out << active_usage_hashes[i];
    }
    out << "]";
    return out.str();
}

std::string usage_hash_list(const std::vector<size_t>& usage_hashes)
{
    if (usage_hashes.empty())
    {
        return {};
    }

    std::ostringstream out;
    for (size_t i = 0; i < usage_hashes.size(); ++i)
    {
        if (i > 0)
        {
            out << ",";
        }
        out << usage_hashes[i];
    }
    return out.str();
}

std::vector<std::string> tokenize_text(const std::string& source)
{
    std::vector<std::string> tokens;
    std::string current;

    auto flush_current = [&]() {
        if (!current.empty())
        {
            tokens.push_back(current);
            current.clear();
        }
    };

    for (size_t i = 0; i < source.size(); ++i)
    {
        const char c = source[i];

        if (std::isspace(static_cast<unsigned char>(c)))
        {
            flush_current();
            continue;
        }

        if (std::isalnum(static_cast<unsigned char>(c)) || c == '_')
        {
            current.push_back(c);
            continue;
        }

        flush_current();

        if ((c == ':' || c == '=' || c == '!' || c == '<' || c == '>') &&
            i + 1 < source.size() && source[i + 1] == '=')
        {
            tokens.emplace_back(source.substr(i, 2));
            ++i;
            continue;
        }

        if (c == ':' && i + 1 < source.size() && source[i + 1] == ':')
        {
            tokens.emplace_back("::");
            ++i;
            continue;
        }
        if (c == '-' && i + 1 < source.size() && source[i + 1] == '>')
        {
            tokens.emplace_back("->");
            ++i;
            continue;
        }

        tokens.emplace_back(1, c);
    }

    flush_current();
    return tokens;
}

std::string join_tokens(const std::vector<std::string>& tokens, size_t start, size_t end)
{
    if (start >= end)
    {
        return {};
    }

    std::ostringstream out;
    for (size_t i = start; i < end; ++i)
    {
        if (i > start)
        {
            out << ' ';
        }
        out << tokens[i];
    }
    return out.str();
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

bool is_type_keyword(const std::string& token)
{
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    return cfg.primitive_type_keywords.find(token) != cfg.primitive_type_keywords.end();
}

std::string detect_statement_kind(const std::vector<std::string>& statement_tokens)
{
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    if (statement_tokens.empty())
    {
        return cfg.node_statement;
    }

    const std::string& first_token = statement_tokens.front();
    if (cfg.conditional_keywords.find(first_token) != cfg.conditional_keywords.end())
    {
        return cfg.node_conditional_statement;
    }
    if (cfg.loop_keywords.find(first_token) != cfg.loop_keywords.end())
    {
        return cfg.node_loop_statement;
    }
    if (first_token == "return") return cfg.node_return_statement;
    if (first_token == "class") return cfg.node_class_decl;
    if (first_token == "struct") return cfg.node_struct_decl;
    if (first_token == "namespace") return cfg.node_namespace_decl;
    bool has_assignment = false;
    bool has_member_arrow = false;
    for (const std::string& token : statement_tokens)
    {
        if (token == cfg.token_assignment)
        {
            has_assignment = true;
        }
        if (token == cfg.token_member_arrow)
        {
            has_member_arrow = true;
        }
    }

    if (has_assignment && has_member_arrow)
    {
        return cfg.node_member_assignment;
    }

    if (has_assignment || is_type_keyword(first_token))
    {
        return cfg.node_assignment_or_decl;
    }

    return cfg.node_statement;
}

ParseTreeNode* node_at_path(ParseTreeNode& root, const std::vector<size_t>& path)
{
    ParseTreeNode* target = &root;
    for (size_t idx : path)
    {
        if (idx >= target->children.size())
        {
            return nullptr;
        }
        target = &target->children[idx];
    }
    return target;
}

size_t append_node_at_path(ParseTreeNode& root, const std::vector<size_t>& path, ParseTreeNode node)
{
    ParseTreeNode* target = node_at_path(root, path);
    if (target == nullptr)
    {
        return 0;
    }

    const size_t sibling_index = target->children.size();
    node.contextual_hash = derive_child_context_hash(target->contextual_hash, node.kind, node.value, sibling_index);
    target->children.push_back(std::move(node));
    return sibling_index;
}

void register_classes_in_line(
    const std::vector<std::string>& line_tokens,
    std::unordered_map<size_t, std::vector<std::string>>& class_hash_registry)
{
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    for (size_t i = 0; i + 1 < line_tokens.size(); ++i)
    {
        const std::string kw = lowercase_ascii(line_tokens[i]);
        if (cfg.class_keywords.find(kw) == cfg.class_keywords.end())
        {
            continue;
        }

        const std::string class_name = line_tokens[i + 1];
        const size_t class_hash = std::hash<std::string>{}(class_name);

        class_hash_registry[class_hash].push_back(class_name);
        on_class_scanned_structural_hook(class_name, line_tokens, g_build_context);
    }
}

bool token_hits_registered_class(
    const std::string& token,
    const std::unordered_map<size_t, std::vector<std::string>>& class_hash_registry,
    size_t& out_class_hash,
    bool& out_collision)
{
    out_class_hash = std::hash<std::string>{}(token);
    const auto hit = class_hash_registry.find(out_class_hash);
    if (hit == class_hash_registry.end())
    {
        return false;
    }

    bool exact_name_match = false;
    for (const std::string& name : hit->second)
    {
        if (name == token)
        {
            exact_name_match = true;
            break;
        }
    }

    out_collision = !exact_name_match || hit->second.size() > 1;
    return exact_name_match;
}

void collect_line_hash_trace(
    size_t line_number,
    const std::vector<std::string>& line_tokens,
    size_t hit_token_index,
    size_t class_hash,
    bool hash_collision,
    size_t scope_hash)
{
    if (line_tokens.empty() || hit_token_index >= line_tokens.size())
    {
        return;
    }

    size_t current_hash = hash_combine_token(scope_hash, std::to_string(class_hash));
    std::vector<size_t> chain;

    for (size_t i = hit_token_index; i > 0; --i)
    {
        current_hash = hash_combine_token(current_hash, line_tokens[i - 1]);
        chain.push_back(current_hash);
    }
    for (size_t i = hit_token_index + 1; i < line_tokens.size(); ++i)
    {
        current_hash = hash_combine_token(current_hash, line_tokens[i]);
        chain.push_back(current_hash);
    }

    LineHashTrace trace;
    trace.line_number = line_number;
    trace.class_name = line_tokens[hit_token_index];
    trace.class_name_hash = class_hash;
    trace.hit_token_index = hit_token_index;
    trace.outgoing_hash = current_hash;
    trace.hash_collision = hash_collision;
    trace.dirty_token_count = line_tokens.size();
    trace.hash_chain = std::move(chain);
    g_line_hash_traces.push_back(std::move(trace));
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

std::string include_target_from_line(const std::string& line)
{
    const std::vector<std::string> t = tokenize_text(line);
    if (t.size() < 3 || t[0] != "#" || lowercase_ascii(t[1]) != "include")
    {
        return {};
    }

    if (t[2] == "<")
    {
        std::string out;
        for (size_t i = 3; i < t.size() && t[i] != ">"; ++i)
        {
            out += t[i];
        }
        return out;
    }

    if (t[2] == "\"")
    {
        std::string out;
        for (size_t i = 3; i < t.size() && t[i] != "\""; ++i)
        {
            out += t[i];
        }
        return out;
    }

    return t[2];
}

void clear_statement_buffers(
    std::vector<std::string>& statement_tokens,
    std::vector<std::string>& tracked_statement_tokens,
    std::vector<size_t>& statement_usage_hashes)
{
    statement_tokens.clear();
    tracked_statement_tokens.clear();
    statement_usage_hashes.clear();
}

void parse_file_content_into_node(
    const SourceFileUnit& file,
    ParseTreeNode& file_node,
    std::unordered_map<size_t, std::vector<std::string>>& class_hash_registry)
{
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    const std::vector<std::string> lines = split_lines(file.content);

    std::vector<size_t> context_path;
    std::vector<std::vector<size_t>> scope_usage_hashes(1);
    std::vector<std::string> statement_tokens;
    std::vector<std::string> tracked_statement_tokens;
    std::vector<size_t> statement_usage_hashes;

    auto flush_statement = [&]() {
        if (statement_tokens.empty())
        {
            return;
        }

        ParseTreeNode node;
        node.kind = detect_statement_kind(statement_tokens);
        node.value = join_tokens(statement_tokens, 0, statement_tokens.size());
        node.propagated_usage_hashes = statement_usage_hashes;

        const std::string annotated = join_tokens(tracked_statement_tokens, 0, tracked_statement_tokens.size());
        if (annotated != node.value)
        {
            node.annotated_value = annotated;
        }

        append_node_at_path(file_node, context_path, std::move(node));
        clear_statement_buffers(statement_tokens, tracked_statement_tokens, statement_usage_hashes);
    };

    auto mark_statement_with_scope_hashes = [&]() {
        for (size_t usage_hash : scope_usage_hashes.back())
        {
            add_unique_hash(statement_usage_hashes, usage_hash);
        }
    };

    for (size_t line_idx = 0; line_idx < lines.size(); ++line_idx)
    {
        const std::vector<std::string> line_tokens = tokenize_text(lines[line_idx]);

        const std::string include_target = include_target_from_line(lines[line_idx]);
        if (!include_target.empty())
        {
            ParseTreeNode include_node;
            include_node.kind = "IncludeDependency";
            include_node.value = include_target;
            append_node_at_path(file_node, {}, std::move(include_node));
        }

        register_classes_in_line(line_tokens, class_hash_registry);

        const ParseTreeNode* current_scope_node = node_at_path(file_node, context_path);
        const size_t current_scope_hash =
            current_scope_node != nullptr ? current_scope_node->contextual_hash : file_node.contextual_hash;

        for (size_t token_idx = 0; token_idx < line_tokens.size(); ++token_idx)
        {
            size_t class_hash = 0;
            bool hash_collision = false;
            if (token_hits_registered_class(line_tokens[token_idx], class_hash_registry, class_hash, hash_collision))
            {
                collect_line_hash_trace(
                    line_idx + 1,
                    line_tokens,
                    token_idx,
                    class_hash,
                    hash_collision,
                    current_scope_hash);
            }
        }

        for (const std::string& token : line_tokens)
        {
            if (token == cfg.token_open_brace)
            {
                ParseTreeNode block;
                block.kind = cfg.node_block;
                block.value = join_tokens(statement_tokens, 0, statement_tokens.size());
                block.propagated_usage_hashes = statement_usage_hashes;

                const std::string annotated = join_tokens(tracked_statement_tokens, 0, tracked_statement_tokens.size());
                if (annotated != block.value)
                {
                    block.annotated_value = annotated;
                }

                const size_t new_index = append_node_at_path(file_node, context_path, std::move(block));
                context_path.push_back(new_index);
                scope_usage_hashes.push_back(scope_usage_hashes.back());
                clear_statement_buffers(statement_tokens, tracked_statement_tokens, statement_usage_hashes);
                continue;
            }

            if (token == cfg.token_close_brace)
            {
                flush_statement();
                if (!context_path.empty())
                {
                    context_path.pop_back();
                }
                if (scope_usage_hashes.size() > 1)
                {
                    scope_usage_hashes.pop_back();
                }
                continue;
            }

            if (token == cfg.token_statement_end)
            {
                flush_statement();
                continue;
            }

            std::string tracked_token = token;
            const std::string suffix = usage_hash_suffix(scope_usage_hashes.back());
            if (!suffix.empty())
            {
                tracked_token += suffix;
            }

            statement_tokens.push_back(token);
            tracked_statement_tokens.push_back(std::move(tracked_token));
            mark_statement_with_scope_hashes();

            size_t crucial_class_hash = 0;
            if (is_crucial_class_name(token, &crucial_class_hash))
            {
                ParseTreeNode* scope_node = node_at_path(file_node, context_path);
                const size_t scope_hash =
                    scope_node != nullptr ? scope_node->contextual_hash : file_node.contextual_hash;
                const size_t scoped_usage_hash = hash_combine_token(scope_hash, std::to_string(crucial_class_hash));
                add_unique_hash(scope_usage_hashes.back(), scoped_usage_hash);
                add_unique_hash(statement_usage_hashes, scoped_usage_hash);
            }
        }
    }

    flush_statement();
}

void collect_class_definitions_by_file(
    const ParseTreeNode& node,
    const std::string& current_file,
    std::unordered_map<std::string, std::string>& class_def_file)
{
    if (node.kind == "Block")
    {
        const std::vector<std::string> words = tokenize_text(node.value);
        if (words.size() >= 2)
        {
            const std::string kw = lowercase_ascii(words[0]);
            if (kw == "class" || kw == "struct")
            {
                class_def_file[words[1]] = current_file;
            }
        }
    }

    for (const ParseTreeNode& child : node.children)
    {
        collect_class_definitions_by_file(child, current_file, class_def_file);
    }
}

void collect_symbol_dependencies_for_file(
    const ParseTreeNode& node,
    const std::string& current_file,
    const std::unordered_map<std::string, std::string>& class_def_file,
    std::unordered_set<std::string>& emitted,
    std::vector<ParseTreeNode>& out_dependencies)
{
    const std::string& searchable_value = node.value;
    if (!searchable_value.empty())
    {
        const std::vector<std::string> words = tokenize_text(searchable_value);
        for (const std::string& word : words)
        {
            const auto it = class_def_file.find(word);
            if (it == class_def_file.end() || it->second == current_file)
            {
                continue;
            }

            const std::string key = current_file + "|" + it->second + "|" + word;
            if (emitted.insert(key).second)
            {
                ParseTreeNode dep;
                dep.kind = "SymbolDependency";
                dep.value = word + " -> " + it->second;
                out_dependencies.push_back(std::move(dep));
            }
        }
    }

    for (const ParseTreeNode& child : node.children)
    {
        collect_symbol_dependencies_for_file(child, current_file, class_def_file, emitted, out_dependencies);
    }
}

void resolve_include_dependencies(
    ParseTreeNode& node,
    const std::unordered_map<std::string, std::string>& basename_to_path)
{
    if (node.kind == "IncludeDependency")
    {
        const auto it = basename_to_path.find(node.value);
        if (it != basename_to_path.end())
        {
            node.value = node.value + " -> " + it->second;
        }
    }

    for (ParseTreeNode& child : node.children)
    {
        resolve_include_dependencies(child, basename_to_path);
    }
}

bool append_shadow_subtree_if_relevant(const ParseTreeNode& source, ParseTreeNode& out_shadow_node)
{
    std::vector<ParseTreeNode> kept_children;
    kept_children.reserve(source.children.size());

    for (const ParseTreeNode& child : source.children)
    {
        ParseTreeNode shadow_child;
        if (append_shadow_subtree_if_relevant(child, shadow_child))
        {
            kept_children.push_back(std::move(shadow_child));
        }
    }

    const bool self_relevant = !source.propagated_usage_hashes.empty();
    if (!self_relevant && kept_children.empty())
    {
        return false;
    }

    out_shadow_node.kind = source.kind;
    out_shadow_node.value = source.value;
    out_shadow_node.annotated_value = source.annotated_value;
    out_shadow_node.contextual_hash = source.contextual_hash;
    out_shadow_node.propagated_usage_hashes = source.propagated_usage_hashes;
    out_shadow_node.children = std::move(kept_children);
    return true;
}
} // namespace

void set_parse_tree_build_context(const ParseTreeBuildContext& context)
{
    g_build_context = context;
    reset_structural_analysis_state();
}

const ParseTreeBuildContext& get_parse_tree_build_context()
{
    return g_build_context;
}

const std::vector<LineHashTrace>& get_line_hash_traces()
{
    return g_line_hash_traces;
}

ParseTreeNode build_cpp_parse_tree(const std::string& source)
{
    std::vector<SourceFileUnit> single_file;
    single_file.push_back(SourceFileUnit{"<memory>", source});
    return build_cpp_parse_tree(single_file);
}

ParseTreeNode build_cpp_parse_tree(const std::vector<SourceFileUnit>& files)
{
    ParseTreeBundle bundle = build_cpp_parse_trees(files);
    return bundle.main_tree;
}

ParseTreeBundle build_cpp_parse_trees(const std::vector<SourceFileUnit>& files)
{
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);

    ParseTreeBundle bundle;
    bundle.main_tree.kind = cfg.node_translation_unit;
    bundle.main_tree.value = "Root";
    bundle.main_tree.contextual_hash = std::hash<std::string>{}(cfg.node_translation_unit + "|Root|main");

    bundle.shadow_tree.kind = cfg.node_translation_unit;
    bundle.shadow_tree.value = "Root";
    bundle.shadow_tree.contextual_hash = bundle.main_tree.contextual_hash;

    g_line_hash_traces.clear();
    reset_structural_analysis_state();

    std::unordered_map<size_t, std::vector<std::string>> class_hash_registry;
    std::unordered_map<std::string, std::string> class_def_file;
    std::unordered_map<std::string, std::string> basename_to_path;

    bundle.main_tree.children.reserve(files.size());
    bundle.shadow_tree.children.reserve(files.size());
    for (size_t i = 0; i < files.size(); ++i)
    {
        const SourceFileUnit& file = files[i];

        ParseTreeNode main_file_node;
        main_file_node.kind = "FileUnit";
        main_file_node.value = file.path;
        main_file_node.contextual_hash = derive_child_context_hash(
            bundle.main_tree.contextual_hash,
            main_file_node.kind,
            main_file_node.value,
            bundle.main_tree.children.size());
        bundle.main_tree.children.push_back(std::move(main_file_node));

        ParseTreeNode shadow_file_node;
        shadow_file_node.kind = "FileUnit";
        shadow_file_node.value = file.path;
        shadow_file_node.contextual_hash = main_file_node.contextual_hash;
        bundle.shadow_tree.children.push_back(std::move(shadow_file_node));

        basename_to_path[file_basename(file.path)] = file.path;
    }

    for (size_t i = 0; i < files.size(); ++i)
    {
        parse_file_content_into_node(files[i], bundle.main_tree.children[i], class_hash_registry);
        collect_class_definitions_by_file(bundle.main_tree.children[i], files[i].path, class_def_file);
    }

    for (ParseTreeNode& file_node : bundle.main_tree.children)
    {
        resolve_include_dependencies(file_node, basename_to_path);

        std::unordered_set<std::string> emitted;
        std::vector<ParseTreeNode> symbol_deps;
        collect_symbol_dependencies_for_file(
            file_node,
            file_node.value,
            class_def_file,
            emitted,
            symbol_deps);

        for (ParseTreeNode& dep : symbol_deps)
        {
            append_node_at_path(file_node, {}, std::move(dep));
        }
    }

    for (size_t i = 0; i < bundle.main_tree.children.size() && i < bundle.shadow_tree.children.size(); ++i)
    {
        ParseTreeNode& shadow_file = bundle.shadow_tree.children[i];
        shadow_file.children.clear();

        for (const ParseTreeNode& child : bundle.main_tree.children[i].children)
        {
            ParseTreeNode filtered;
            if (append_shadow_subtree_if_relevant(child, filtered))
            {
                shadow_file.children.push_back(std::move(filtered));
            }
        }
    }

    rebuild_parse_tree_symbol_tables(bundle.main_tree);
    return bundle;
}

std::string parse_tree_to_text(const ParseTreeNode& root)
{
    std::ostringstream out;

    std::function<void(const ParseTreeNode&, int)> walk = [&](const ParseTreeNode& node, int depth) {
        out << std::string(static_cast<size_t>(depth) * 2, ' ') << node.kind;

        const std::string& display_value = node.annotated_value.empty() ? node.value : node.annotated_value;
        if (!display_value.empty())
        {
            out << ": " << display_value;
        }

        out << " | ctx_hash=" << node.contextual_hash;
        if (!node.propagated_usage_hashes.empty())
        {
            out << " | scope_usage_hashes=" << usage_hash_list(node.propagated_usage_hashes);
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

std::string parse_tree_to_html(const ParseTreeNode& root)
{
    return render_tree_html(root, "C++ Parse Tree");
}


// === FILE: .\Project\Modules\Source\SyntacticBrokenAST\parse_tree_code_generator.cpp ===
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


// === FILE: .\Project\Modules\Source\SyntacticBrokenAST\parse_tree_dependency_utils.cpp ===
#include "parse_tree_dependency_utils.hpp"

#include "parse_tree_symbols.hpp"

#include <utility>

std::vector<DependencySymbolNode> collect_dependency_class_nodes(const ParseTreeNode& root)
{
    rebuild_parse_tree_symbol_tables(root);

    std::vector<DependencySymbolNode> out;
    const std::vector<ParseSymbol>& classes = getClassSymbolTable();
    out.reserve(classes.size());

    for (const ParseSymbol& cls : classes)
    {
        DependencySymbolNode node;
        node.name = cls.name;
        node.signature = cls.signature;
        node.hash_value = cls.hash_value;
        out.push_back(std::move(node));
    }

    return out;
}

std::vector<DependencySymbolNode> collect_dependency_function_nodes(const ParseTreeNode& root)
{
    rebuild_parse_tree_symbol_tables(root);

    std::vector<DependencySymbolNode> out;
    const std::vector<ParseSymbol>& functions = getFunctionSymbolTable();
    out.reserve(functions.size());

    for (const ParseSymbol& fn : functions)
    {
        DependencySymbolNode node;
        node.name = fn.name;
        node.signature = fn.signature;
        node.hash_value = fn.hash_value;
        out.push_back(std::move(node));
    }

    return out;
}


// === FILE: .\Project\Modules\Source\SyntacticBrokenAST\parse_tree_symbols.cpp ===
#include "parse_tree_symbols.hpp"
#include "language_tokens.hpp"
#include "lexical_structure_hooks.hpp"

#include <cctype>
#include <functional>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

namespace
{
std::vector<ParseSymbol> g_class_symbols;
std::vector<ParseSymbol> g_function_symbols;
std::vector<ParseSymbolUsage> g_class_usages;
std::unordered_map<std::string, std::vector<size_t>> g_class_name_index;
std::unordered_map<size_t, std::vector<size_t>> g_class_name_hash_index;
std::unordered_map<size_t, size_t> g_class_context_hash_index;
std::unordered_map<std::string, size_t> g_function_index;

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

bool starts_with(const std::string& text, const std::string& prefix)
{
    return text.size() >= prefix.size() && text.compare(0, prefix.size(), prefix) == 0;
}

size_t combine_context_and_token_hash(size_t contextual_hash, const std::string& token)
{
    return std::hash<std::string>{}(std::to_string(contextual_hash) + "|" + token);
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

std::string function_name_from_signature(const std::string& signature)
{
    const std::string trimmed = trim(signature);
    const size_t open = trimmed.find('(');
    if (open == std::string::npos)
    {
        return {};
    }

    const std::string left = trim(trimmed.substr(0, open));
    const std::vector<std::string> words = split_words(left);
    if (words.empty())
    {
        return {};
    }

    return words.back();
}

bool is_main_function_name(const std::string& name)
{
    return lowercase_ascii(name) == "main";
}

bool is_class_block(const ParseTreeNode& node)
{
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    if (node.kind != "Block")
    {
        return false;
    }

    const std::string lowered = lowercase_ascii(trim(node.value));
    for (const std::string& kw : cfg.class_keywords)
    {
        if (starts_with(lowered, kw + " "))
        {
            return true;
        }
    }

    return false;
}

bool is_function_block(const ParseTreeNode& node)
{
    const LanguageTokenConfig& cfg = language_tokens(LanguageId::Cpp);
    if (node.kind != "Block")
    {
        return false;
    }

    const std::string signature = trim(node.value);
    if (signature.empty() || signature.find('(') == std::string::npos || signature.find(')') == std::string::npos)
    {
        return false;
    }

    const std::vector<std::string> words = split_words(signature);
    if (words.empty())
    {
        return false;
    }

    const std::string first_word = lowercase_ascii(words.front());
    if (cfg.function_exclusion_keywords.find(first_word) != cfg.function_exclusion_keywords.end())
    {
        return false;
    }

    const std::string lowered = lowercase_ascii(signature);
    for (const std::string& kw : cfg.function_exclusion_keywords)
    {
        if (starts_with(lowered, kw + " ") || starts_with(lowered, kw + "("))
        {
            return false;
        }
    }

    return true;
}

void add_class_symbol(
    const std::string& signature,
    size_t definition_node_index,
    size_t node_contextual_hash)
{
    const std::string name = class_name_from_signature(signature);
    if (name.empty())
    {
        return;
    }

    if (g_class_context_hash_index.find(node_contextual_hash) != g_class_context_hash_index.end())
    {
        return;
    }

    ParseSymbol s;
    s.name = name;
    s.signature = signature;
    s.name_hash = std::hash<std::string>{}(name);
    s.contextual_hash = node_contextual_hash;
    s.hash_value = combine_context_and_token_hash(node_contextual_hash, name);
    s.definition_node_index = definition_node_index;

    g_class_name_index[name].push_back(g_class_symbols.size());
    g_class_name_hash_index[s.name_hash].push_back(g_class_symbols.size());
    g_class_context_hash_index[s.contextual_hash] = g_class_symbols.size();
    g_class_symbols.push_back(std::move(s));
}

void add_function_symbol(const std::string& signature, size_t node_contextual_hash)
{
    const std::string name = function_name_from_signature(signature);
    if (name.empty() || is_main_function_name(name))
    {
        return;
    }

    if (g_function_index.find(name) != g_function_index.end())
    {
        return;
    }

    ParseSymbol s;
    s.name = name;
    s.signature = signature;
    s.name_hash = std::hash<std::string>{}(name);
    s.contextual_hash = node_contextual_hash;
    s.hash_value = combine_context_and_token_hash(node_contextual_hash, name);
    s.definition_node_index = 0;

    g_function_index[name] = g_function_symbols.size();
    g_function_symbols.push_back(std::move(s));
}

void collect_symbols_dfs(const ParseTreeNode& node, size_t& node_index)
{
    ++node_index;

    if (node.kind == "ClassDecl" || node.kind == "StructDecl" || is_class_block(node))
    {
        add_class_symbol(node.value, node_index, node.contextual_hash);
    }

    if (is_function_block(node))
    {
        add_function_symbol(node.value, node.contextual_hash);
    }

    for (const ParseTreeNode& child : node.children)
    {
        collect_symbols_dfs(child, node_index);
    }
}

bool is_candidate_usage_node(const ParseTreeNode& node)
{
    return !node.value.empty() &&
           node.kind != "IncludeDependency" &&
           node.kind != "SymbolDependency";
}

void collect_class_usages_dfs(const ParseTreeNode& node, size_t& node_index)
{
    ++node_index;

    const bool declaration_node =
        (node.kind == "ClassDecl" || node.kind == "StructDecl" || is_class_block(node));

    if (is_candidate_usage_node(node))
    {
        const std::vector<std::string> words = split_words(node.value);
        for (const std::string& word : words)
        {
            const size_t class_name_hash = std::hash<std::string>{}(word);
            const auto hit = g_class_name_hash_index.find(class_name_hash);
            if (hit != g_class_name_hash_index.end())
            {
                size_t exact_name_matches = 0;
                bool exact_name_match = false;
                for (size_t class_idx : hit->second)
                {
                    if (class_idx < g_class_symbols.size() && g_class_symbols[class_idx].name == word)
                    {
                        ++exact_name_matches;
                        exact_name_match = true;
                    }
                }

                const bool hash_collision = !exact_name_match || hit->second.size() > exact_name_matches;
                if (!(declaration_node && class_name_from_signature(node.value) == word))
                {
                    ParseSymbolUsage usage;
                    usage.name = word;
                    usage.type_string = word;
                    usage.node_kind = node.kind;
                    usage.node_value = node.value;
                    usage.node_index = node_index;
                    usage.node_contextual_hash = node.contextual_hash;
                    usage.class_name_hash = class_name_hash;
                    usage.hash_value = combine_context_and_token_hash(node.contextual_hash, word);
                    usage.refactor_candidate = is_crucial_class_name(word);
                    usage.hash_collision = hash_collision;
                    g_class_usages.push_back(std::move(usage));
                }
            }
        }
    }

    for (const ParseTreeNode& child : node.children)
    {
        collect_class_usages_dfs(child, node_index);
    }
}

std::string extract_return_candidate_name(const std::string& return_expression)
{
    std::string expr = trim(return_expression);
    std::string lowered = lowercase_ascii(expr);

    if (starts_with(lowered, "return"))
    {
        expr = trim(expr.substr(6));
        lowered = lowercase_ascii(expr);
    }

    if (starts_with(lowered, "new "))
    {
        expr = trim(expr.substr(4));
    }

    const std::vector<std::string> words = split_words(expr);
    if (words.empty())
    {
        return {};
    }

    return words.front();
}
} // namespace

void rebuild_parse_tree_symbol_tables(const ParseTreeNode& root)
{
    g_class_symbols.clear();
    g_function_symbols.clear();
    g_class_usages.clear();
    g_class_name_index.clear();
    g_class_name_hash_index.clear();
    g_class_context_hash_index.clear();
    g_function_index.clear();

    size_t definition_node_index = 0;
    collect_symbols_dfs(root, definition_node_index);

    size_t usage_node_index = 0;
    collect_class_usages_dfs(root, usage_node_index);
}

const std::vector<ParseSymbol>& getClassSymbolTable()
{
    return g_class_symbols;
}

const std::vector<ParseSymbol>& getFunctionSymbolTable()
{
    return g_function_symbols;
}

const std::vector<ParseSymbolUsage>& getClassUsageTable()
{
    return g_class_usages;
}

const ParseSymbol* getClassByName(const std::string& name)
{
    const auto it = g_class_name_index.find(name);
    if (it == g_class_name_index.end() || it->second.empty())
    {
        return nullptr;
    }

    return &g_class_symbols[it->second.front()];
}

const ParseSymbol* getClassByHash(size_t hash_value)
{
    const auto context_it = g_class_context_hash_index.find(hash_value);
    if (context_it != g_class_context_hash_index.end())
    {
        return &g_class_symbols[context_it->second];
    }

    const auto name_hash_it = g_class_name_hash_index.find(hash_value);
    if (name_hash_it == g_class_name_hash_index.end() || name_hash_it->second.empty())
    {
        return nullptr;
    }

    return &g_class_symbols[name_hash_it->second.front()];
}

const ParseSymbol* getFunctionByName(const std::string& name)
{
    const auto it = g_function_index.find(name);
    if (it == g_function_index.end())
    {
        return nullptr;
    }

    return &g_function_symbols[it->second];
}

std::vector<ParseSymbolUsage> getClassUsagesByName(const std::string& name)
{
    std::vector<ParseSymbolUsage> out;
    for (const ParseSymbolUsage& usage : g_class_usages)
    {
        if (usage.name == name)
        {
            out.push_back(usage);
        }
    }
    return out;
}

bool returnTargetsKnownClass(const std::string& return_expression)
{
    const std::string candidate = extract_return_candidate_name(return_expression);
    if (candidate.empty())
    {
        return false;
    }

    return getClassByName(candidate) != nullptr;
}


// === FILE: .\Project\Modules\Source\SyntacticBrokenAST\source_reader.cpp ===
#include "source_reader.hpp"

#include <fstream>
#include <iostream>
#include <sstream>

std::vector<SourceFileUnit> read_source_file_units(const std::vector<std::string>& files)
{
    if (files.empty())
    {
        return {};
    }

    std::vector<SourceFileUnit> units;
    units.reserve(files.size());

    for (const std::string& path : files)
    {
        std::ifstream file(path);
        if (!file)
        {
            std::cerr << "Failed to open " << path << '\n';
            return {};
        }

        SourceFileUnit unit;
        unit.path = path;
        std::ostringstream buffer;
        buffer << file.rdbuf();
        unit.content = buffer.str();
        units.push_back(std::move(unit));
    }

    return units;
}

std::string join_source_file_units(const std::vector<SourceFileUnit>& units)
{
    std::ostringstream merged;
    for (size_t i = 0; i < units.size(); ++i)
    {
        merged << "\n// === FILE: " << units[i].path << " ===\n";
        merged << units[i].content;
        if (i + 1 < units.size())
        {
            merged << '\n';
        }
    }
    return merged.str();
}


// === FILE: .\Project\Modules\Source\SyntacticBrokenAST\tree_html_renderer.cpp ===
#include "tree_html_renderer.hpp"

#include <sstream>

namespace
{
std::string escape_html(const std::string& input)
{
    std::string out;
    out.reserve(input.size());

    for (char c : input)
    {
        switch (c)
        {
            case '&': out += "&amp;"; break;
            case '<': out += "&lt;"; break;
            case '>': out += "&gt;"; break;
            case '"': out += "&quot;"; break;
            case '\'': out += "&#39;"; break;
            default: out.push_back(c); break;
        }
    }

    return out;
}

void write_node_html(std::ostringstream& out, const ParseTreeNode& node)
{
    out << "<li><span class=\"kind\">" << escape_html(node.kind) << "</span>";
    const std::string& display_value = node.annotated_value.empty() ? node.value : node.annotated_value;
    if (!display_value.empty())
    {
        out << " <span class=\"value\">" << escape_html(display_value) << "</span>";
    }
    out << " <span class=\"meta\">ctx=" << node.contextual_hash << "</span>";

    if (!node.children.empty())
    {
        out << "<ul>";
        for (const ParseTreeNode& child : node.children)
        {
            write_node_html(out, child);
        }
        out << "</ul>";
    }

    out << "</li>";
}
} // namespace

std::string render_tree_html(
    const ParseTreeNode& root,
    const std::string& title,
    const std::string& empty_message)
{
    std::ostringstream out;

    out << "<!doctype html>\n";
    out << "<html lang=\"en\">\n";
    out << "<head>\n";
    out << "  <meta charset=\"utf-8\">\n";
    out << "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n";
    out << "  <title>" << escape_html(title) << "</title>\n";
    out << "  <style>\n";
    out << "    body { font-family: Segoe UI, sans-serif; margin: 24px; background: #f8fbff; color: #1f2937; }\n";
    out << "    h1 { margin: 0 0 12px; font-size: 1.15rem; }\n";
    out << "    p { margin: 0; color: #475569; }\n";
    out << "    ul { list-style: none; margin: 0; padding-left: 1.1rem; border-left: 1px solid #d1d5db; }\n";
    out << "    li { margin: 0.35rem 0; }\n";
    out << "    .kind { font-weight: 700; color: #0f172a; }\n";
    out << "    .value { color: #334155; }\n";
    out << "    .meta { color: #64748b; font-size: 0.85em; }\n";
    out << "  </style>\n";
    out << "</head>\n";
    out << "<body>\n";
    out << "  <h1>" << escape_html(title) << "</h1>\n";

    if (root.children.empty())
    {
        out << "  <p>" << escape_html(empty_message) << "</p>\n";
    }
    else
    {
        out << "  <ul>";
        write_node_html(out, root);
        out << "</ul>\n";
    }

    out << "</body>\n";
    out << "</html>\n";

    return out.str();
}


// === FILE: .\Project\Test\test_source.cpp ===


// === FILE: .\Project\Test\Input\domain_models_source.cpp ===
// Additional non-pattern context classes.
// These should not be treated as creational pattern targets.

#include <string>

class Driver {
public:
    std::string license_id;
};

class FleetVehicle {
public:
    std::string plate_number;
};

class Trip {
public:
    Driver driver;
    FleetVehicle vehicle;
};


// === FILE: .\Project\Test\Input\factory_to_singleton_source.cpp ===
// Sample input for CLI analysis:
// source_pattern=factory target_pattern=singleton

#include <memory>
#include <string>

class Person {
public:
    explicit Person(std::string n) : name(std::move(n)) {}
    std::string name;
};

class Vehicle {
public:
    explicit Vehicle(std::string b) : brand(std::move(b)) {}
    std::string brand;
};

class Report {
public:
    std::string format;
};

class CsvReport : public Report {
public:
    CsvReport() { format = "csv"; }
};

class JsonReport : public Report {
public:
    JsonReport() { format = "json"; }
};

class ReportFactory {
public:
    std::unique_ptr<Report> create(int kind) {
        if (kind == 0) {
            return std::make_unique<CsvReport>();
        }
        return std::make_unique<JsonReport>();
    }
};

class AppConfig {
public:
    static AppConfig get() {
        static AppConfig instance;
        return instance;
    }

    bool debug = true;
};

int main() {
    ReportFactory factory;
    std::unique_ptr<Report> report = factory.create(1);

    AppConfig cfg = AppConfig::get();
    if (cfg.debug && report) {
        return 0;
    }
    return 1;
}

