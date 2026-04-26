#include "OutputGeneration/Contracts/pipeline_state.hpp"

#include <chrono>
#include <unordered_set>
#include <utility>

namespace
{
using Clock = std::chrono::steady_clock;

std::size_t elapsed_ms_since(const Clock::time_point& start)
{
    const Clock::time_point now = Clock::now();
    return static_cast<std::size_t>(
        std::chrono::duration_cast<std::chrono::milliseconds>(now - start).count());
}
} // namespace

PipelineReport run_normalize_and_rewrite_pipeline(
    const std::vector<std::string>& input_paths,
    const std::string&              output_path,
    const std::string&              catalog_path)
{
    SourcePipelineState state;
    state.build_context.input_paths  = input_paths;
    state.build_context.output_path  = output_path;
    state.build_context.catalog_path = catalog_path;

    auto run_stage = [&](const char* stage_name, void (*stage_fn)(SourcePipelineState&)) {
        const Clock::time_point begin = Clock::now();
        stage_fn(state);
        StageMetric metric;
        metric.stage_name      = stage_name;
        metric.milliseconds    = elapsed_ms_since(begin);
        metric.items_processed = state.report.detected_patterns.size();
        state.report.stage_metrics.push_back(std::move(metric));
    };

    run_stage("analysis",          &run_analysis_stage);
    run_stage("trees",              &run_trees_stage);
    run_stage("pattern_dispatch",   &run_pattern_dispatch_stage);
    run_stage("hashing",            &run_hashing_stage);

    std::unordered_set<std::size_t> documented_classes;
    std::size_t                     total_unit_test_targets = 0;
    for (const DesignPatternTag& tag : state.report.detected_patterns)
    {
        if (documented_classes.insert(tag.target_class_hash).second)
        {
            total_unit_test_targets += tag.unit_test_targets.size();
        }
    }
    state.report.documentation_target_count = documented_classes.size();
    state.report.unit_test_target_count     = total_unit_test_targets;

    run_stage("output", &run_output_stage);

    return std::move(state.report);
}
