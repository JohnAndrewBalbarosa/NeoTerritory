#include "Internal/parse_tree_internal.hpp"

#include <utility>
#include <vector>

namespace parse_tree_internal
{
void bucketize_file_node_for_traversal(ParseTreeNode& file_node)
{
    std::vector<ParseTreeNode> classes;
    std::vector<ParseTreeNode> global_functions;
    std::vector<ParseTreeNode> passthrough;
    classes.reserve(file_node.children.size());
    global_functions.reserve(file_node.children.size());
    passthrough.reserve(file_node.children.size());

    for (ParseTreeNode& child : file_node.children)
    {
        if (is_class_declaration_node(child))
        {
            classes.push_back(std::move(child));
        }
        else if (is_global_function_declaration_node(child))
        {
            global_functions.push_back(std::move(child));
        }
        else
        {
            passthrough.push_back(std::move(child));
        }
    }

    file_node.children.clear();
    file_node.children.reserve(
        passthrough.size() +
        (classes.empty() ? 0U : 1U) +
        (global_functions.empty() ? 0U : 1U));

    for (ParseTreeNode& child : passthrough)
    {
        file_node.children.push_back(std::move(child));
    }

    if (!classes.empty())
    {
        ParseTreeNode class_bucket;
        class_bucket.kind = k_file_class_bucket_kind;
        class_bucket.value = "class/struct declarations";
        class_bucket.children = std::move(classes);
        file_node.children.push_back(std::move(class_bucket));
    }

    if (!global_functions.empty())
    {
        ParseTreeNode fn_bucket;
        fn_bucket.kind = k_file_global_function_bucket_kind;
        fn_bucket.value = "global function declarations";
        fn_bucket.children = std::move(global_functions);
        file_node.children.push_back(std::move(fn_bucket));
    }

    for (size_t i = 0; i < file_node.children.size(); ++i)
    {
        rehash_subtree(file_node.children[i], file_node.contextual_hash, i);
    }
}
} // namespace parse_tree_internal
