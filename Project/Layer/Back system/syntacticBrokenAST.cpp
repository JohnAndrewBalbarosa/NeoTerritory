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
    std::ostringstream buffer;
    buffer << std::cin.rdbuf();
    return buffer.str();
}

bool is_return_type(const std::string& lexeme) {
    static const std::unordered_set<std::string> return_types = {
        "void",
        "int",
        "double",
        "float",
        "char",
        "bool",
    };
    return return_types.count(lexeme) > 0;
}

ASTNode* build_function_graph(const std::vector<Token>& tokens) {
    ASTNode* root = new ASTNode;
    root->line = 1;
    root->column = 1;

    bool found_function = false;
    for (size_t i = 0; i + 2 < tokens.size(); ++i) {
        const Token& keyword = tokens[i];
        const Token& identifier = tokens[i + 1];
        const Token& delimiter = tokens[i + 2];

        if (keyword.type == TokenType::Keyword && is_return_type(keyword.lexeme) &&
            identifier.type == TokenType::Identifier && delimiter.lexeme == "(") {
            FunctionNode* function = new FunctionNode;
            function->name = identifier.lexeme;
            function->line = identifier.line;
            function->column = identifier.column;

            VirtualNode* entry_wrapper = wrap_node(function, true);
            VirtualNode* exit_wrapper = wrap_node(function, false);

            entry_wrapper->addChild(function);
            function->addChild(exit_wrapper);
            root->addChild(entry_wrapper);

            found_function = true;
            i += 2;
        }
    }

    if (!found_function) {
        ASTNode* placeholder = new ASTNode;
        placeholder->line = 1;
        placeholder->column = 1;
        root->addChild(placeholder);
    }

    return root;
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

