#include "lexer.hpp"
#include "lexer_utils.hpp"
#include "source_reader.hpp"
#include "function_parser.hpp"
#include "ast_printer.hpp"

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
    
    ASTNode* root = parse_function_tokens(tokens);
    print_ast_analysis(root);
    
    return 0;
}
