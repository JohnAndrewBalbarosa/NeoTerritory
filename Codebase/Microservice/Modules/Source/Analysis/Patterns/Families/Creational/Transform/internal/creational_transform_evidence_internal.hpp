#pragma once

#include "Trees/Actual/parse_tree.hpp"

#include <string>
#include <vector>

struct CreationalTransformEvidenceRecord
{
    std::string              kind;
    std::string              class_name;
    std::vector<std::string> reasons;
};

std::vector<CreationalTransformEvidenceRecord> scan_creational_transform_evidence(const ParseTreeNode& root);

std::vector<CreationalTransformEvidenceRecord> filter_main_retention_evidence(
    const std::vector<CreationalTransformEvidenceRecord>& evidence);

std::string render_creational_transform_evidence(
    const std::vector<CreationalTransformEvidenceRecord>& evidence);

std::vector<std::string> collect_signatures(const ParseTreeNode& root);

ParseTreeNode build_evidence_skeleton(const std::vector<CreationalTransformEvidenceRecord>& evidence);
