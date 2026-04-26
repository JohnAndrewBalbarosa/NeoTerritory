#include "OutputGeneration/Contracts/pipeline_state.hpp"

#include "Analysis/Input/source_reader.hpp"
#include "Analysis/Patterns/Catalog/catalog.hpp"

#include <filesystem>
#include <string>

namespace
{
std::string resolve_catalog_directory(const ParseTreeBuildContext& context)
{
    if (!context.catalog_path.empty()) return context.catalog_path;

    std::error_code ec;
    const std::filesystem::path cwd_default = std::filesystem::path("pattern_catalog");
    if (std::filesystem::is_directory(cwd_default, ec)) return cwd_default.string();

    if (!context.output_path.empty())
    {
        const std::filesystem::path output_sibling =
            std::filesystem::path(context.output_path).parent_path() / "pattern_catalog";
        if (std::filesystem::is_directory(output_sibling, ec)) return output_sibling.string();
    }

    return {};
}
} // namespace

void run_analysis_stage(SourcePipelineState& state)
{
    state.source_files = read_source_file_units(state.build_context.input_paths);

    const std::string catalog_directory = resolve_catalog_directory(state.build_context);
    if (!catalog_directory.empty())
    {
        state.pattern_catalog = load_pattern_catalog(catalog_directory);
        for (const std::string& diag : state.pattern_catalog.load_diagnostics)
        {
            state.report.diagnostics.push_back(diag);
        }
    }
    else
    {
        state.report.diagnostics.push_back("catalog_not_found");
    }
}
