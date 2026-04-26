#include "OutputGeneration/Contracts/pipeline_state.hpp"

#include "HashingMechanism/HashLinks/hash_links.hpp"

void run_hashing_stage(SourcePipelineState& state)
{
    if (state.per_file_roots.empty())
    {
        return;
    }

    FilePairedTreeView file_view;
    file_view.actual_root = &state.main_tree;

    state.hash_links = build_parse_tree_hash_links(file_view, state.symbol_tables);
}
