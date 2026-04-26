#include "HashingMechanism/HashLinks/hash_links.hpp"
#include "HashingMechanism/HashLinks/Internal/contracts.hpp"
#include "Analysis/ImplementationUse/Binding/Symbols/symbols.hpp"
#include "Trees/Actual/parse_tree.hpp"

#include <utility>

namespace
{
void index_all_nodes(const ParseTreeNode* node, HashLinkIndex& index)
{
    if (!node) return;
    NodeRef ref;
    ref.hash = node->hash;
    ref.node = node;
    index.all_nodes[node->hash] = ref;
    for (const ParseTreeNode& child : node->children)
    {
        index_all_nodes(&child, index);
    }
}
} // namespace

HashLinkIndex build_parse_tree_hash_links(
    const FilePairedTreeView&    file_view,
    const ParseTreeSymbolTables& symbol_tables)
{
    HashLinkIndex index;

    index_all_nodes(file_view.actual_root, index);
    if (file_view.virtual_root)
    {
        index_all_nodes(file_view.virtual_root, index);
    }

    for (const auto& kv : symbol_tables.classes)
    {
        const std::size_t   class_hash    = kv.first;
        const ParseSymbol&  class_symbol  = kv.second;
        if (!class_symbol.actual_head) continue;

        ClassHashLink link;
        link.class_hash         = class_hash;
        link.declaration.hash   = class_symbol.actual_head->hash;
        link.declaration.node   = class_symbol.actual_head;

        const auto usages_iterator = symbol_tables.class_usages.find(class_hash);
        if (usages_iterator != symbol_tables.class_usages.end())
        {
            for (const ParseSymbolUsage& usage : usages_iterator->second)
            {
                if (!usage.usage_node) continue;
                NodeRef usage_ref;
                usage_ref.hash = usage.usage_node->hash;
                usage_ref.node = usage.usage_node;
                link.usages.push_back(std::move(usage_ref));
            }
        }
        index.classes[class_hash] = std::move(link);
    }

    return index;
}
