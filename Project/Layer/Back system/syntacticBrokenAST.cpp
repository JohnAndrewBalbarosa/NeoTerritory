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

struct FunctionNode : ASTNode {
    std::string name;
};

namespace {

std::string read_source(int argc, char* argv[]) {
    if (argc > 1) {
        std::ifstream file(argv[1]);
        if (!file) {
            std::cerr << "Failed to open " << argv[1] << '\n';
            return {};
        }
        std::ostringstream buffer;
        buffer << file.rdbuf();
        return buffer.str();
    }
    // Only try to read from stdin if it's available
    if (std::cin.rdbuf()->in_avail() > 0 || !std::cin.eof()) {
        std::ostringstream buffer;
        buffer << std::cin.rdbuf();
        return buffer.str();
    }
    return {};
}

ASTNode* build_function_graph(const std::vector<Token>& tokens) {
    // First pass: look for 'main' function
    for (size_t i = 0; i < tokens.size(); ++i) {
        const Token& token = tokens[i];
        if (token.type == TokenType::Identifier && token.lexeme == "main" && i + 1 < tokens.size()) {
            const Token& next = tokens[i + 1];
            if (next.lexeme == "(") {
                FunctionNode* function = new FunctionNode;
                function->name = "main";
                function->line = token.line;
                function->column = token.column;

                VirtualNode* entry_wrapper = wrap_node(function, true);
                VirtualNode* exit_wrapper = wrap_node(function, false);

                entry_wrapper->addChild(function);
                function->addChild(exit_wrapper);
                return entry_wrapper;
            }
        }
    }

    // Second pass: if no main found, look for any function
    for (size_t i = 0; i < tokens.size(); ++i) {
        const Token& token = tokens[i];
        if (token.type == TokenType::Identifier && i + 1 < tokens.size()) {
            const Token& next = tokens[i + 1];
            if (next.lexeme == "(") {
                FunctionNode* function = new FunctionNode;
                function->name = token.lexeme;
                function->line = token.line;
                function->column = token.column;

                VirtualNode* entry_wrapper = wrap_node(function, true);
                VirtualNode* exit_wrapper = wrap_node(function, false);

                entry_wrapper->addChild(function);
                function->addChild(exit_wrapper);
                return entry_wrapper;
            }
        }
    }

    // No function found
    ASTNode* placeholder = new ASTNode;
    placeholder->line = 1;
    placeholder->column = 1;
    return placeholder;
}

void describe_virtual_nodes(ASTNode* root) {
    traverse(root, [](ASTNode* node) {
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
        }
    });
}

}  // namespace

int main(int argc, char* argv[]) {
    std::string source = read_source(argc, argv);
    if (source.empty()) {
        std::cout << "No source provided, nothing to build.\n";
        return 1;
    }

    Lexer lexer(std::move(source));
    std::vector<Token> tokens = lexer.scan();
    ASTNode* root = build_function_graph(tokens);

    std::cout << "=== Synthetic AST Dump ===\n";
    print_tree(root);
    std::cout << "Semantic height: " << semantic_height(root)
              << " | Physical height: " << physical_height(root) << '\n';
        describe_virtual_nodes(root);

    return 0;
}

