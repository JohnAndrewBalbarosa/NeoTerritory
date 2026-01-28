#include "lexer.hpp"
#include "lexer_utils.hpp"
#include "source_reader.hpp"
#include "function_parser.hpp"
#include "ast_printer.hpp"
#include "cfg_tree_builder.hpp"
#include "cfg_printer.hpp"

#include <iostream>

int run_syntactic_broken_ast(int argc, char* argv[])
{
    std::string source = read_source(argc, argv);
    if (source.empty())
    {
        std::cout << "No source provided.\n";
        return 1;
    }

    std::string cleaned = strip_preprocessor_directives(source);
    Lexer lexer(std::move(cleaned));
    std::vector<Token> tokens = lexer.scan();
    
    ParsedNodes parsed = parse_and_store_nodes(tokens);
    
    // Build CFG-based syntactic tree starting from main
    ASTNode* cfg_tree = build_cfg_tree(tokens, parsed);
    std::cout << "\n=== CFG Syntactic Tree (Main as Root with Function Calls as Children) ===\n";
    print_cfg_tree(cfg_tree);
    
    if (parsed.main_root) {
        std::cout << "\n=== Main Function (Virtual Copy Parse Tree Root) ===\n";
        print_ast_analysis(parsed.main_root);
    }
    
    ASTNode* root = parse_function_tokens(tokens);
    std::cout << "\n=== All Nodes ===\n";
    print_ast_analysis(root);
    
    return 0;
}
