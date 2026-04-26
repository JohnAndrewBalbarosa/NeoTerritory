#include "OutputGeneration/Contracts/pipeline_state.hpp"
#include "OutputGeneration/Render/codebase_output_writer.hpp"
#include "OutputGeneration/Render/tree_html_renderer.hpp"
#include "Trees/Actual/parse_tree.hpp"

#include <filesystem>
#include <fstream>
#include <sstream>
#include <string>

namespace
{
std::string escape_json(const std::string& text)
{
    std::string out;
    out.reserve(text.size() + 2);
    for (char c : text)
    {
        switch (c)
        {
            case '"':  out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n";  break;
            case '\r': out += "\\r";  break;
            case '\t': out += "\\t";  break;
            default:
                if (static_cast<unsigned char>(c) < 0x20)
                {
                    char buffer[8];
                    std::snprintf(buffer, sizeof(buffer), "\\u%04x", static_cast<unsigned char>(c));
                    out += buffer;
                }
                else
                {
                    out.push_back(c);
                }
        }
    }
    return out;
}
} // namespace

namespace
{
bool write_text_file_safely(const std::string& path, const std::string& contents)
{
    std::error_code ec;
    std::filesystem::create_directories(std::filesystem::path(path).parent_path(), ec);
    std::ofstream stream(path, std::ios::out | std::ios::trunc);
    if (!stream.is_open()) return false;
    stream << contents;
    return stream.good();
}
} // namespace

void run_output_stage(SourcePipelineState& state)
{
    state.report.artifacts.output_root = state.build_context.output_path;

    if (state.build_context.output_path.empty()) return;

    CodebaseOutputPaths paths;
    paths.root               = state.build_context.output_path;
    paths.html_directory     = state.build_context.output_path + "/html";
    paths.json_report_path   = state.build_context.output_path + "/report.json";
    paths.evidence_directory = state.build_context.output_path + "/evidence";

    write_evidence_files_only(state.report, paths);

    const std::string parse_tree_html  = render_tree_html(state.main_tree);
    const std::string parse_tree_path  = paths.html_directory + "/parse_tree.html";
    if (write_text_file_safely(parse_tree_path, parse_tree_html))
    {
        state.report.artifacts.written_files.push_back(parse_tree_path);
    }

    state.report.artifacts.written_files.push_back(paths.json_report_path);
    const std::string report_json = render_pipeline_report_json(state.report);
    write_text_file_safely(paths.json_report_path, report_json);
}

std::string pipeline_report_to_json(const PipelineReport& report)
{
    std::ostringstream out;
    out << '{';
    out << "\"detected_patterns\":" << report.detected_patterns.size();
    out << ",\"documentation_target_count\":" << report.documentation_target_count;
    out << ",\"unit_test_target_count\":"     << report.unit_test_target_count;
    out << ",\"stage_count\":"                << report.stage_metrics.size();
    out << ",\"diagnostic_count\":"           << report.diagnostics.size();

    out << ",\"output_root\":\"" << escape_json(report.artifacts.output_root) << '"';
    out << '}';
    return out.str();
}
