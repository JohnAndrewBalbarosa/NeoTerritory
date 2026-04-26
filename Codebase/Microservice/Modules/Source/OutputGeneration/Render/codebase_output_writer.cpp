#include "OutputGeneration/Render/codebase_output_writer.hpp"

#include <filesystem>
#include <fstream>
#include <sstream>
#include <string>

namespace
{
std::string escape_json_string(const std::string& text)
{
    std::string out;
    out.reserve(text.size() + 2);
    for (char c : text)
    {
        switch (c)
        {
            case '"':  out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\b': out += "\\b";  break;
            case '\f': out += "\\f";  break;
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

void write_string(std::ostringstream& out, const std::string& text)
{
    out << '"' << escape_json_string(text) << '"';
}

void write_documentation_target(std::ostringstream& out, const DocumentationTarget& target)
{
    out << '{';
    out << "\"label\":";   write_string(out, target.label);
    out << ",\"node_hash\":" << target.node_hash;
    out << ",\"line\":"      << target.line;
    out << ",\"column\":"    << target.column;
    out << ",\"lexeme\":";   write_string(out, target.lexeme);
    out << '}';
}

void write_unit_test_target(std::ostringstream& out, const UnitTestTarget& target)
{
    out << '{';
    out << "\"containing_class_hash\":" << target.containing_class_hash;
    out << ",\"function_hash\":"          << target.function_hash;
    out << ",\"function_name\":";         write_string(out, target.function_name);
    out << ",\"file_name\":";             write_string(out, target.file_name);
    out << ",\"line\":"                   << target.line;
    out << ",\"branch_kind\":";           write_string(out, target.branch_kind);
    out << '}';
}

void write_design_pattern_tag(std::ostringstream& out, const DesignPatternTag& tag)
{
    out << '{';
    out << "\"pattern_family\":";    write_string(out, tag.pattern_family);
    out << ",\"pattern_name\":";     write_string(out, tag.pattern_name);
    out << ",\"pattern_id\":";       write_string(out, tag.pattern_id);
    out << ",\"target_class_hash\":" << tag.target_class_hash;

    out << ",\"documentation_targets\":[";
    for (std::size_t i = 0; i < tag.documentation_targets.size(); ++i)
    {
        if (i > 0) out << ',';
        write_documentation_target(out, tag.documentation_targets[i]);
    }
    out << ']';

    out << ",\"unit_test_targets\":[";
    for (std::size_t i = 0; i < tag.unit_test_targets.size(); ++i)
    {
        if (i > 0) out << ',';
        write_unit_test_target(out, tag.unit_test_targets[i]);
    }
    out << ']';

    out << '}';
}

void write_stage_metric(std::ostringstream& out, const StageMetric& metric)
{
    out << '{';
    out << "\"stage_name\":";       write_string(out, metric.stage_name);
    out << ",\"milliseconds\":"     << metric.milliseconds;
    out << ",\"items_processed\":"  << metric.items_processed;
    out << '}';
}

bool ensure_directory(const std::string& path)
{
    if (path.empty()) return false;
    std::error_code ec;
    if (std::filesystem::is_directory(path, ec)) return true;
    return std::filesystem::create_directories(path, ec);
}

bool write_text_file(const std::string& path, const std::string& contents)
{
    std::ofstream stream(path, std::ios::out | std::ios::trunc);
    if (!stream.is_open()) return false;
    stream << contents;
    return stream.good();
}

std::string render_full_report_json(const PipelineReport& report)
{
    std::ostringstream out;
    out << '{';

    out << "\"stage_metrics\":[";
    for (std::size_t i = 0; i < report.stage_metrics.size(); ++i)
    {
        if (i > 0) out << ',';
        write_stage_metric(out, report.stage_metrics[i]);
    }
    out << ']';

    out << ",\"documentation_target_count\":" << report.documentation_target_count;
    out << ",\"unit_test_target_count\":"     << report.unit_test_target_count;

    out << ",\"diagnostics\":[";
    for (std::size_t i = 0; i < report.diagnostics.size(); ++i)
    {
        if (i > 0) out << ',';
        write_string(out, report.diagnostics[i]);
    }
    out << ']';

    out << ",\"detected_patterns\":[";
    for (std::size_t i = 0; i < report.detected_patterns.size(); ++i)
    {
        if (i > 0) out << ',';
        write_design_pattern_tag(out, report.detected_patterns[i]);
    }
    out << ']';

    out << ",\"artifacts\":{";
    out << "\"output_root\":";    write_string(out, report.artifacts.output_root);
    out << ",\"written_files\":[";
    for (std::size_t i = 0; i < report.artifacts.written_files.size(); ++i)
    {
        if (i > 0) out << ',';
        write_string(out, report.artifacts.written_files[i]);
    }
    out << "]}";

    out << '}';
    return out.str();
}

std::string render_match_evidence_json(const DesignPatternTag& tag)
{
    std::ostringstream out;
    write_design_pattern_tag(out, tag);
    return out.str();
}

std::string sanitize_filename_component(const std::string& text)
{
    std::string out;
    out.reserve(text.size());
    for (char c : text)
    {
        if (std::isalnum(static_cast<unsigned char>(c)) || c == '_' || c == '-' || c == '.')
        {
            out.push_back(c);
        }
        else
        {
            out.push_back('_');
        }
    }
    return out;
}
} // namespace

void write_codebase_outputs(PipelineReport& report, const CodebaseOutputPaths& paths)
{
    if (!paths.root.empty()) ensure_directory(paths.root);
    if (!paths.html_directory.empty()) ensure_directory(paths.html_directory);
    if (!paths.evidence_directory.empty()) ensure_directory(paths.evidence_directory);

    if (!paths.evidence_directory.empty())
    {
        for (const DesignPatternTag& tag : report.detected_patterns)
        {
            const std::string filename =
                sanitize_filename_component(tag.pattern_id.empty() ? tag.pattern_name : tag.pattern_id) +
                "_" + std::to_string(tag.target_class_hash) + ".json";
            const std::string evidence_path = paths.evidence_directory + "/" + filename;
            if (write_text_file(evidence_path, render_match_evidence_json(tag)))
            {
                report.artifacts.written_files.push_back(evidence_path);
            }
        }
    }

    if (!paths.json_report_path.empty())
    {
        const std::string report_json = render_full_report_json(report);
        if (write_text_file(paths.json_report_path, report_json))
        {
            report.artifacts.written_files.push_back(paths.json_report_path);
        }
    }
}
