#include "source_reader.hpp"
#include "parse_tree.hpp"
#include "creational_broken_tree.hpp"
#include "behavioural_broken_tree.hpp"

#include <fstream>
#include <iostream>
#include <string>

int run_syntactic_broken_ast(int argc, char* argv[])
{
    std::string source = read_source(argc, argv);
    if (source.empty())
    {
        std::cout << "No source provided.\n";
        return 1;
    }

    const ParseTreeNode tree = build_cpp_parse_tree(source);

    std::cout << "\n=== C++ Parse Tree ===\n";
    std::cout << parse_tree_to_text(tree);

    std::string parse_tree_output_path = "parse_tree.html";
    if (argc > 2 && argv[2] != nullptr && std::string(argv[2]).size() > 0)
    {
        parse_tree_output_path = argv[2];
    }

    {
        const std::string html = parse_tree_to_html(tree);
        std::ofstream out(parse_tree_output_path);
        if (!out)
        {
            std::cerr << "Failed to write " << parse_tree_output_path << '\n';
            return 1;
        }
        out << html;
    }

    const CreationalTreeNode creational_tree = build_creational_broken_tree(tree);

    std::cout << "\n=== Creational Broken Tree ===\n";
    std::cout << creational_tree_to_text(creational_tree);

    std::string creational_output_path = "creational_parse_tree.html";
    if (argc > 3 && argv[3] != nullptr && std::string(argv[3]).size() > 0)
    {
        creational_output_path = argv[3];
    }

    {
        const std::string creational_html = creational_tree_to_html(creational_tree);
        std::ofstream out(creational_output_path);
        if (!out)
        {
            std::cerr << "Failed to write " << creational_output_path << '\n';
            return 1;
        }
        out << creational_html;
    }

    const ParseTreeNode behavioural_tree = build_behavioural_broken_tree(tree);

    std::cout << "\n=== Behavioural Broken Tree ===\n";
    std::cout << parse_tree_to_text(behavioural_tree);

    std::string behavioural_output_path = "behavioural_broken_ast.html";
    if (argc > 4 && argv[4] != nullptr && std::string(argv[4]).size() > 0)
    {
        behavioural_output_path = argv[4];
    }

    {
        const std::string behavioural_html = behavioural_broken_tree_to_html(behavioural_tree);
        std::ofstream out(behavioural_output_path);
        if (!out)
        {
            std::cerr << "Failed to write " << behavioural_output_path << '\n';
            return 1;
        }
        out << behavioural_html;
    }

    std::cout << "\nHTML parse tree generated: " << parse_tree_output_path << '\n';
    std::cout << "Creational HTML generated: " << creational_output_path << '\n';
    std::cout << "Behavioural HTML generated: " << behavioural_output_path << '\n';

    return 0;
}
