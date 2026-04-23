#include "internal/creational_transform_evidence_internal.hpp"

namespace creational_codegen_internal
{
std::string build_monolithic_evidence_view(
    const std::string& source_code,
    const std::string& target_code,
    bool target_view,
    const std::string& source_pattern,
    const std::string& target_pattern)
{
    const std::string normalized_source_pattern = lower(trim(source_pattern));
    const std::string normalized_target_pattern = lower(trim(target_pattern));
    const bool explicit_patterns = !normalized_source_pattern.empty() || !normalized_target_pattern.empty();
    const bool singleton_to_builder_view =
        !explicit_patterns ||
        (normalized_source_pattern == "singleton" && normalized_target_pattern == "builder");

    if (!singleton_to_builder_view)
    {
        const std::string passthrough_code =
            target_view
                ? (target_code.empty() ? source_code : target_code)
                : source_code;

        // Merged input view can contain multiple sample entry points.
        // Keep one preferred main() so generated passthrough files stay compilable.
        std::string preferred_file_hint;
        if (!normalized_source_pattern.empty() && !normalized_target_pattern.empty())
        {
            preferred_file_hint = normalized_source_pattern + "_to_" + normalized_target_pattern;
        }
        return retain_single_main_function(passthrough_code, preferred_file_hint);
    }

    const EvidenceScanResult source_scan = scan_pattern_evidence(source_code);
    const bool has_target = !target_code.empty();
    EvidenceScanResult target_scan;
    if (has_target)
    {
        target_scan = scan_pattern_evidence(target_code);
    }

    std::vector<MonolithicClassView> class_views =
        build_class_views(source_scan, has_target ? &target_scan : nullptr);
    std::vector<std::string> type_skeleton =
        target_view ? build_target_type_skeleton_lines(class_views)
                    : build_source_type_skeleton_lines(class_views);
    std::vector<std::string> callsite_skeleton =
        target_view ? build_target_callsite_skeleton_lines(class_views)
                    : build_source_callsite_skeleton_lines(class_views);

    if (!validate_monolithic_structure(type_skeleton, callsite_skeleton))
    {
        type_skeleton.clear();
        callsite_skeleton = {"int main() {", "}"};
    }

    std::ostringstream out;
    out << (target_view
                ? "// Monolithic/Target Code View (Builder)\n\n"
                : "// Monolithic/Base Code View (Singleton)\n\n");

    if (target_view)
    {
        append_evidence_section(out, "EVIDENCE_REMOVED:", build_target_evidence_removed_lines(class_views));
        append_evidence_section(out, "EVIDENCE_ADDED:", build_target_evidence_added_lines(class_views));
    }
    else
    {
        append_evidence_section(out, "EVIDENCE_PRESENT:", build_source_evidence_present_lines(class_views));
    }

    append_code_section(out, "TYPE_SKELETON:", type_skeleton);
    out << "\n";
    append_code_section(out, "CALLSITE_SKELETON:", callsite_skeleton);
    return out.str();
}
} // namespace creational_codegen_internal
