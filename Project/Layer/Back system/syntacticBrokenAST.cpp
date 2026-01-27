#include "lexer.hpp"
#include "ast.hpp"
#include "virtual_node.hpp"
#include "ast_utils.hpp"
#include "transform.hpp"

#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <unordered_set>
#include <utility>

struct FunctionNode : ASTNode
{
    std::string name;
};

namespace
{

    std::string read_source(int argc, char *argv[])
    {
        if (argc > 1)
        {
            std::ifstream file(argv[1]);
            if (!file)
            {
                std::cerr << "Failed to open " << argv[1] << '\n';
                return {};
            }
            std::ostringstream buffer;
            buffer << file.rdbuf();
            return buffer.str();
        }
        // Only try to read from stdin if it's available
        if (std::cin.rdbuf()->in_avail() > 0 || !std::cin.eof())
        {
            std::ostringstream buffer;
            buffer << std::cin.rdbuf();
            return buffer.str();
        }
        return {};
    }

    ASTNode *build_function_graph(const std::vector<Token> &tokens)
    {
        // First pass: look for 'main' function
        for (size_t i = 0; i < tokens.size(); ++i)
        {
            const Token &token = tokens[i];
            if (token.type == TokenType::Identifier && token.lexeme == "main" && i + 1 < tokens.size())
            {
                const Token &next = tokens[i + 1];
                if (next.lexeme == "(")
                {
                    FunctionNode *function = new FunctionNode;
                    function->name = "main";
                    function->line = token.line;
                    function->column = token.column;

                    VirtualNode *entry_wrapper = wrap_node(function, true);
                    VirtualNode *exit_wrapper = wrap_node(function, false);

                    entry_wrapper->addChild(function);
                    function->addChild(exit_wrapper);
                    return entry_wrapper;
                }
            }
        }

        // Second pass: if no main found, look for any function
        for (size_t i = 0; i < tokens.size(); ++i)
        {
            const Token &token = tokens[i];
            if (token.type == TokenType::Identifier && i + 1 < tokens.size())
            {
                const Token &next = tokens[i + 1];
                if (next.lexeme == "(")
                {
                    FunctionNode *function = new FunctionNode;
                    function->name = token.lexeme;
                    function->line = token.line;
                    function->column = token.column;

                    VirtualNode *entry_wrapper = wrap_node(function, true);
                    VirtualNode *exit_wrapper = wrap_node(function, false);

                    entry_wrapper->addChild(function);
                    function->addChild(exit_wrapper);
                    return entry_wrapper;
                }
            }
        }

        // No function found
        ASTNode *placeholder = new ASTNode;
        placeholder->line = 1;
        placeholder->column = 1;
        return placeholder;
    }

    void describe_virtual_nodes(ASTNode *root)
    {
        traverse(root, [](ASTNode *node)
                 {
        if (auto* wrapper = dynamic_cast<VirtualNode*>(node)) {
            std::cout << "Wrapper @" << wrapper->wrapper_line << ':' << wrapper->wrapper_column
                      << " dirty=" << (wrapper->dirty ? "yes" : "no");
            if (wrapper->target) {
                if (auto* function = dynamic_cast<FunctionNode*>(wrapper->target)) {
                    std::cout << " -> Function '" << function->name << "'";
                } else {
                    std::cout << " -> target@" << wrapper->target;
                }
            }
            std::cout << '\n';
        } });
    }

} // namespace

std::pair<std::string, size_t> strip_preprocessor_directives(const std::string &source)
{
    std::ostringstream result;
    size_t skipped_lines = 0;

    size_t i = 0;
    while (i < source.size())
    {
        // Check if we're at the start of a line
        size_t line_start = i;

        // Skip leading spaces/tabs
        while (i < source.size() && (source[i] == ' ' || source[i] == '\t'))
        {
            ++i;
        }

        // If first non-space character is #, skip entire line (preprocessor directive)
        if (i < source.size() && source[i] == '#')
        {
            // Skip until newline or end
            while (i < source.size() && source[i] != '\n')
            {
                ++i;
            }
            // Skip the newline too
            if (i < source.size() && source[i] == '\n')
            {
                ++skipped_lines;
                ++i;
            }
            continue; // Start checking next line
        }

        // Check for "using namespace" declaration
        if (i < source.size() && source[i] == 'u')
        {
            // Check if this is "using namespace"
            if (i + 15 < source.size() &&
                source.substr(i, 6) == "using " &&
                source.substr(i + 6, 9) == "namespace")
            {
                // Skip until semicolon or newline
                while (i < source.size() && source[i] != ';' && source[i] != '\n')
                {
                    ++i;
                }
                // Skip the semicolon or newline
                if (i < source.size())
                {
                    if (source[i] == '\n')
                    {
                        ++skipped_lines;
                    }
                    ++i;
                }
                continue;
            }
        }

        // Track if we have actual code content on this line (not just whitespace)
        bool has_code = false;
        size_t content_start = i;
        
        // Not a preprocessor line or using namespace - add everything from line_start to current position
        for (size_t j = line_start; j < i; ++j)
        {
            result << source[j];
        }

        // Add rest of line, but handle comments carefully
        while (i < source.size())
        {
            // Check for single-line comment
            if (i + 1 < source.size() && source[i] == '/' && source[i + 1] == '/')
            {
                // Skip until newline
                while (i < source.size() && source[i] != '\n')
                {
                    ++i;
                }
                if (i < source.size() && source[i] == '\n')
                {
                    // If this was a comment-only line (no code before it), skip the newline
                    if (!has_code)
                    {
                        ++skipped_lines;
                    }
                    else
                    {
                        // Inline comment - preserve the newline
                        result << '\n';
                    }
                    ++i;
                }
                break;
            }

            // Check for multi-line comment
            if (i + 1 < source.size() && source[i] == '/' && source[i + 1] == '*')
            {
                bool comment_had_code_before = has_code;
                // Skip until */
                i += 2;
                while (i + 1 < source.size() && !(source[i] == '*' && source[i + 1] == '/'))
                {
                    if (source[i] == '\n')
                    {
                        ++skipped_lines;
                    }
                    ++i;
                }
                if (i + 1 < source.size())
                {
                    i += 2; // Skip */
                }
                
                // Check if there's more content after the comment on this line
                size_t peek = i;
                bool has_content_after = false;
                while (peek < source.size() && source[peek] != '\n')
                {
                    if (source[peek] != ' ' && source[peek] != '\t')
                    {
                        has_content_after = true;
                        break;
                    }
                    peek++;
                }
                
                // If this was an inline comment or there's content after, mark as having code
                if (comment_had_code_before || has_content_after)
                {
                    has_code = true;
                }
                
                continue;
            }

            // Regular character - mark that we have code if it's not whitespace
            if (source[i] != ' ' && source[i] != '\t' && source[i] != '\n')
            {
                has_code = true;
            }
            
            result << source[i];
            if (source[i] == '\n')
            {
                ++i;
                break;
            }
            ++i;
        }
    }

    return {result.str(), skipped_lines};
}

int main(int argc, char *argv[])
{
    std::string source = read_source(argc, argv);
    if (source.empty())
    {
        std::cout << "No source provided, nothing to build.\n";
        return 1;
    }

    // Clean preprocessor directives
    auto [cleaned_source, skipped_lines] = strip_preprocessor_directives(source);

    Lexer lexer(std::move(cleaned_source), skipped_lines + 1);
    std::vector<Token> tokens = lexer.scan();
    ASTNode *root = build_function_graph(tokens);

    std::cout << "=== Synthetic AST Dump ===\n";
    print_tree(root);
    std::cout << "Semantic height: " << semantic_height(root)
              << " | Physical height: " << physical_height(root) << '\n';
    describe_virtual_nodes(root);

    return 0;
}
