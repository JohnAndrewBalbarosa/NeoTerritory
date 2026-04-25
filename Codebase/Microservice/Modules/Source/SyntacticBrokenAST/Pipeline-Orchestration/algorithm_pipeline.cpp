#include "Pipeline-Contracts/algorithm_pipeline.hpp"
#include "parse_tree_symbols.hpp"

#include <algorithm>
#include <cctype>
#include <chrono>
#include <fstream>
#include <functional>
#include <sstream>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

namespace
{
using Clock = std::chrono::steady_clock;

bool file_has_bucket_kind(const ParseTreeNode& file_node, const std::string& bucket_kind)
{
    for (const ParseTreeNode& child : file_node.children)
    {
        if (child.kind == bucket_kind)
        {
            return true;
        }
    }
    return false;
}

bool validate_file_pairing(
    const ParseTreeNode& actual_root,
    const ParseTreeNode& virtual_root,
    std::vector<std::string>& failures)
{
    if (actual_root.children.size() != virtual_root.children.size())
    {
        failures.push_back("actual_virtual_file_count_mismatch");
        return false;
    }

    bool valid = true;
    for (size_t i = 0; i < actual_root.children.size(); ++i)
    {
        const ParseTreeNode& actual_file = actual_root.children[i];
        const ParseTreeNode& virtual_file = virtual_root.children[i];
        if (actual_file.kind != "FileUnit" || virtual_file.kind != "FileUnit")
        {
            failures.push_back("file_unit_kind_missing_at_index_" + std::to_string(i));
            valid = false;
            continue;
        }
        if (actual_file.value != virtual_file.value)
        {
            failures.push_back("file_unit_path_mismatch_at_index_" + std::to_string(i));
            valid = false;
        }
    }

    return valid;
}

bool validate_bucketized_files(const ParseTreeNode& root, std::vector<std::string>& failures)
{
    bool valid = true;
    for (size_t i = 0; i < root.children.size(); ++i)
    {
        const ParseTreeNode& file_node = root.children[i];
        if (file_node.kind != "FileUnit")
        {
            continue;
        }

        bool has_unbucketized_class_decl = false;
        for (const ParseTreeNode& child : file_node.children)
        {
            if (child.kind == "ClassDecl" || child.kind == "StructDecl")
            {
                has_unbucketized_class_decl = true;
                break;
            }
        }

        const bool has_class_bucket = file_has_bucket_kind(file_node, "ClassDeclarations");
        if (has_unbucketized_class_decl && !has_class_bucket)
        {
            failures.push_back("bucketized_structure_missing_for_file_" + std::to_string(i));
            valid = false;
        }
    }
    return valid;
}

size_t estimate_parse_tree_bytes(const ParseTreeNode& node)
{
    size_t total = sizeof(ParseTreeNode) + node.kind.size() + node.value.size();
    total += node.children.capacity() * sizeof(ParseTreeNode);

    for (const ParseTreeNode& child : node.children)
    {
        total += estimate_parse_tree_bytes(child);
    }

    return total;
}

size_t estimate_creational_tree_bytes(const CreationalTreeNode& node)
{
    size_t total = sizeof(CreationalTreeNode) + node.kind.size() + node.label.size();
    total += node.children.capacity() * sizeof(CreationalTreeNode);

    for (const CreationalTreeNode& child : node.children)
    {
        total += estimate_creational_tree_bytes(child);
    }

    return total;
}

size_t estimate_symbol_table_bytes(const ParseTreeSymbolTables& tables)
{
    size_t total = 0;

    const std::vector<ParseSymbol>& classes = class_symbol_table(tables);
    const std::vector<ParseSymbol>& functions = function_symbol_table(tables);

    total += classes.capacity() * sizeof(ParseSymbol);
    total += functions.capacity() * sizeof(ParseSymbol);

    for (const ParseSymbol& s : classes)
    {
        total += s.name.size() + s.signature.size();
    }
    for (const ParseSymbol& s : functions)
    {
        total += s.name.size() + s.signature.size();
    }

    return total;
}

size_t estimate_node_ref_bytes(const NodeRef& ref)
{
    size_t total = sizeof(NodeRef);
    total += ref.tree_side.size();
    total += ref.file_basename.size();
    total += ref.file_path.size();
    total += ref.node_kind.size();
    total += ref.node_value.size();
    total += ref.node_index_path.capacity() * sizeof(size_t);
    total += ref.ancestry.readable_chain.capacity() * sizeof(std::string);
    total += ref.ancestry.hash_chain.capacity() * sizeof(size_t);

    for (const std::string& entry : ref.ancestry.readable_chain)
    {
        total += entry.size();
    }

    return total;
}

size_t estimate_hash_links_bytes(const HashLinkIndex& links)
{
    size_t total = sizeof(HashLinkIndex);
    total += links.paired_file_view.capacity() * sizeof(FilePairedTreeView);
    total += links.class_links.capacity() * sizeof(ClassHashLink);
    total += links.usage_links.capacity() * sizeof(UsageHashLink);

    for (const FilePairedTreeView& view : links.paired_file_view)
    {
        total += view.file_basename.size();
        total += view.file_path.size();
        total += view.actual_root_kind.size();
        total += view.virtual_root_kind.size();
    }

    for (const ClassHashLink& link : links.class_links)
    {
        total += link.class_name.size();
        total += link.file_path.size();
        total += link.actual_link_status.size();
        total += link.virtual_link_status.size();
        total += link.link_status.size();
        total += link.actual_nodes.capacity() * sizeof(NodeRef);
        total += link.virtual_nodes.capacity() * sizeof(NodeRef);
        for (const NodeRef& ref : link.actual_nodes)
        {
            total += estimate_node_ref_bytes(ref);
        }
        for (const NodeRef& ref : link.virtual_nodes)
        {
            total += estimate_node_ref_bytes(ref);
        }
    }

    for (const UsageHashLink& link : links.usage_links)
    {
        total += link.file_path.size();
        total += link.class_name.size();
        total += link.hash_chain.capacity() * sizeof(size_t);
        total += link.class_link_status.size();
        total += link.usage_link_status.size();
        total += link.class_anchor_actual_nodes.capacity() * sizeof(NodeRef);
        total += link.class_anchor_virtual_nodes.capacity() * sizeof(NodeRef);
        total += link.usage_actual_nodes.capacity() * sizeof(NodeRef);
        total += link.usage_virtual_nodes.capacity() * sizeof(NodeRef);
        for (const NodeRef& ref : link.class_anchor_actual_nodes)
        {
            total += estimate_node_ref_bytes(ref);
        }
        for (const NodeRef& ref : link.class_anchor_virtual_nodes)
        {
            total += estimate_node_ref_bytes(ref);
        }
        for (const NodeRef& ref : link.usage_actual_nodes)
        {
            total += estimate_node_ref_bytes(ref);
        }
        for (const NodeRef& ref : link.usage_virtual_nodes)
        {
            total += estimate_node_ref_bytes(ref);
        }
    }

    return total;
}

std::string json_escape(const std::string& input)
{
    std::string out;
    out.reserve(input.size());
    for (char c : input)
    {
        switch (c)
        {
            case '\\': out += "\\\\"; break;
            case '"': out += "\\\""; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default: out.push_back(c); break;
        }
    }
    return out;
}

void append_json_string_array(std::ostringstream& out, const std::vector<std::string>& values)
{
    out << "[";
    for (size_t i = 0; i < values.size(); ++i)
    {
        if (i > 0)
        {
            out << ", ";
        }
        out << "\"" << json_escape(values[i]) << "\"";
    }
    out << "]";
}

void append_json_number_array(std::ostringstream& out, const std::vector<size_t>& values)
{
    out << "[";
    for (size_t i = 0; i < values.size(); ++i)
    {
        if (i > 0)
        {
            out << ", ";
        }
        out << values[i];
    }
    out << "]";
}

void append_json_node_refs(std::ostringstream& out, const std::vector<NodeRef>& refs)
{
    out << "[";
    for (size_t i = 0; i < refs.size(); ++i)
    {
        const NodeRef& ref = refs[i];
        out << "{";
        out << "\"tree_side\":\"" << json_escape(ref.tree_side) << "\",";
        out << "\"file_basename\":\"" << json_escape(ref.file_basename) << "\",";
        out << "\"file_path\":\"" << json_escape(ref.file_path) << "\",";
        out << "\"node_kind\":\"" << json_escape(ref.node_kind) << "\",";
        out << "\"node_value\":\"" << json_escape(ref.node_value) << "\",";
        out << "\"contextual_hash\":" << ref.contextual_hash << ",";
        out << "\"node_index_path\":";
        append_json_number_array(out, ref.node_index_path);
        out << ",";
        out << "\"readable_ancestry\":";
        append_json_string_array(out, ref.ancestry.readable_chain);
        out << ",";
        out << "\"hash_ancestry\":";
        append_json_number_array(out, ref.ancestry.hash_chain);
        out << "}";
        if (i + 1 < refs.size())
        {
            out << ",";
        }
    }
    out << "]";
}

std::string trim_whitespace(const std::string& input)
{
    size_t begin = 0;
    while (begin < input.size() && std::isspace(static_cast<unsigned char>(input[begin])))
    {
        ++begin;
    }
    size_t end = input.size();
    while (end > begin && std::isspace(static_cast<unsigned char>(input[end - 1])))
    {
        --end;
    }
    return input.substr(begin, end - begin);
}

std::string lower_ascii(const std::string& input)
{
    std::string out;
    out.reserve(input.size());
    for (char c : input)
    {
        out.push_back(static_cast<char>(std::tolower(static_cast<unsigned char>(c))));
    }
    return out;
}

bool token_present(const std::string& haystack_lower, const std::string& token)
{
    size_t pos = 0;
    while ((pos = haystack_lower.find(token, pos)) != std::string::npos)
    {
        const bool left_ok = pos == 0 ||
            !(std::isalnum(static_cast<unsigned char>(haystack_lower[pos - 1])) || haystack_lower[pos - 1] == '_');
        const size_t after = pos + token.size();
        const bool right_ok = after >= haystack_lower.size() ||
            !(std::isalnum(static_cast<unsigned char>(haystack_lower[after])) || haystack_lower[after] == '_');
        if (left_ok && right_ok)
        {
            return true;
        }
        pos += token.size();
    }
    return false;
}

bool block_signature_starts_with_word(const std::string& value, const std::string& word_lower)
{
    const std::string lowered = lower_ascii(trim_whitespace(value));
    if (lowered.size() < word_lower.size())
    {
        return false;
    }
    if (lowered.compare(0, word_lower.size(), word_lower) != 0)
    {
        return false;
    }
    if (lowered.size() == word_lower.size())
    {
        return true;
    }
    const char next = lowered[word_lower.size()];
    return !(std::isalnum(static_cast<unsigned char>(next)) || next == '_');
}

bool is_class_block_value(const std::string& value)
{
    if (block_signature_starts_with_word(value, "class") ||
        block_signature_starts_with_word(value, "struct"))
    {
        return true;
    }
    // Files often pack include directives in front of the class signature so
    // the Block value reads as "# include <X> ... class Foo". Detect any
    // trailing "class Foo" or "struct Foo" declaration in such packed values.
    const std::string lowered = lower_ascii(value);
    auto find_trailing = [&](const std::string& kw) -> bool {
        size_t pos = 0;
        size_t last = std::string::npos;
        while ((pos = lowered.find(kw, pos)) != std::string::npos)
        {
            const bool left_ok = pos == 0 ||
                !(std::isalnum(static_cast<unsigned char>(lowered[pos - 1])) || lowered[pos - 1] == '_');
            const size_t after = pos + kw.size();
            const bool right_ok = after < lowered.size() &&
                std::isspace(static_cast<unsigned char>(lowered[after]));
            if (left_ok && right_ok)
            {
                last = pos;
            }
            pos += kw.size();
        }
        if (last == std::string::npos) return false;
        // Must be followed by an identifier (the class name)
        size_t i = last + kw.size();
        while (i < lowered.size() && std::isspace(static_cast<unsigned char>(lowered[i]))) ++i;
        return i < lowered.size() &&
               (std::isalpha(static_cast<unsigned char>(lowered[i])) || lowered[i] == '_');
    };
    return find_trailing("class") || find_trailing("struct");
}

bool is_function_block_value(const std::string& value)
{
    const std::string trimmed = trim_whitespace(value);
    if (trimmed.empty() || is_class_block_value(trimmed))
    {
        return false;
    }
    if (trimmed.find('(') == std::string::npos || trimmed.find(')') == std::string::npos)
    {
        return false;
    }
    static const std::unordered_set<std::string> exclusions{
        "if", "for", "while", "switch", "do", "else", "return", "case", "catch"};
    const std::string lowered = lower_ascii(trimmed);
    for (const std::string& kw : exclusions)
    {
        if (block_signature_starts_with_word(lowered, kw))
        {
            return false;
        }
    }
    return true;
}

std::string classify_branch_kind(const std::string& value)
{
    const std::string lowered = lower_ascii(trim_whitespace(value));
    if (block_signature_starts_with_word(lowered, "else if")) return "else_if";
    if (block_signature_starts_with_word(lowered, "else"))    return "else";
    if (block_signature_starts_with_word(lowered, "if"))      return "if";
    if (block_signature_starts_with_word(lowered, "switch"))  return "switch";
    if (block_signature_starts_with_word(lowered, "case"))    return "case";
    if (block_signature_starts_with_word(lowered, "default")) return "default";
    return {};
}

std::string extract_class_name_from_block(const std::string& value)
{
    // Find the LAST occurrence of "class X" or "struct X" in the value, since
    // packed Block values may prefix include directives before the actual
    // class signature.
    const std::string lowered = lower_ascii(value);
    auto find_last_kw = [&](const std::string& kw) -> size_t {
        size_t pos = 0;
        size_t last = std::string::npos;
        while ((pos = lowered.find(kw, pos)) != std::string::npos)
        {
            const bool left_ok = pos == 0 ||
                !(std::isalnum(static_cast<unsigned char>(lowered[pos - 1])) || lowered[pos - 1] == '_');
            const size_t after = pos + kw.size();
            const bool right_ok = after < lowered.size() &&
                std::isspace(static_cast<unsigned char>(lowered[after]));
            if (left_ok && right_ok)
            {
                last = pos;
            }
            pos += kw.size();
        }
        return last;
    };

    const size_t class_pos = find_last_kw("class");
    const size_t struct_pos = find_last_kw("struct");
    size_t pos = std::string::npos;
    size_t kw_len = 0;
    if (class_pos != std::string::npos &&
        (struct_pos == std::string::npos || class_pos > struct_pos))
    {
        pos = class_pos;
        kw_len = 5;
    }
    else if (struct_pos != std::string::npos)
    {
        pos = struct_pos;
        kw_len = 6;
    }
    else
    {
        return {};
    }

    std::string after = trim_whitespace(value.substr(pos + kw_len));
    std::string name;
    for (char c : after)
    {
        if (std::isalnum(static_cast<unsigned char>(c)) || c == '_')
        {
            name.push_back(c);
        }
        else
        {
            break;
        }
    }
    return name;
}

std::vector<std::string> extract_base_class_names_from_block(const std::string& value)
{
    std::vector<std::string> out;
    const size_t colon = value.find(':');
    if (colon == std::string::npos)
    {
        return out;
    }
    std::string tail = value.substr(colon + 1);
    std::string current;
    auto flush = [&]() {
        std::string token;
        for (char c : current)
        {
            if (std::isalnum(static_cast<unsigned char>(c)) || c == '_')
            {
                token.push_back(c);
            }
            else if (!token.empty())
            {
                token.clear();
            }
        }
        // last identifier wins (skips public/private/virtual specifiers)
        std::string final_token;
        std::string acc;
        for (char c : current)
        {
            if (std::isalnum(static_cast<unsigned char>(c)) || c == '_')
            {
                acc.push_back(c);
            }
            else
            {
                if (!acc.empty()) final_token = acc;
                acc.clear();
            }
        }
        if (!acc.empty()) final_token = acc;
        static const std::unordered_set<std::string> specifiers{
            "public", "private", "protected", "virtual"};
        if (!final_token.empty() && specifiers.find(lower_ascii(final_token)) == specifiers.end())
        {
            out.push_back(final_token);
        }
        current.clear();
    };
    for (char c : tail)
    {
        if (c == ',')
        {
            flush();
        }
        else
        {
            current.push_back(c);
        }
    }
    flush();
    return out;
}

std::string extract_method_name_from_signature(const std::string& signature)
{
    const std::string trimmed = trim_whitespace(signature);
    const size_t open = trimmed.find('(');
    if (open == std::string::npos)
    {
        return {};
    }
    std::string head = trimmed.substr(0, open);
    // Walk backwards from the end of head to capture the trailing identifier,
    // then look just before it for a '~' (destructor marker) so the name is
    // returned as "~ClassName" rather than "ClassName".
    size_t end = head.size();
    while (end > 0 && std::isspace(static_cast<unsigned char>(head[end - 1])))
    {
        --end;
    }
    size_t start = end;
    while (start > 0)
    {
        const char c = head[start - 1];
        if (std::isalnum(static_cast<unsigned char>(c)) || c == '_')
        {
            --start;
        }
        else
        {
            break;
        }
    }
    if (start == end)
    {
        return {};
    }
    std::string name = head.substr(start, end - start);
    size_t before = start;
    while (before > 0 && std::isspace(static_cast<unsigned char>(head[before - 1])))
    {
        --before;
    }
    if (before > 0 && head[before - 1] == '~')
    {
        name = "~" + name;
    }
    return name;
}

std::string classify_contract_kind(const std::string& signature)
{
    const std::string lowered = lower_ascii(signature);
    const bool has_virtual = token_present(lowered, "virtual");
    const bool has_override = token_present(lowered, "override");
    const std::string compact = [&]() {
        std::string out;
        out.reserve(lowered.size());
        for (char c : lowered)
        {
            if (!std::isspace(static_cast<unsigned char>(c)))
            {
                out.push_back(c);
            }
        }
        return out;
    }();
    // Pure-virtual marker comes after the parameter list and any cv-qualifiers
    // (const, noexcept, etc.). In compact form: "...)=0", "...)const=0",
    // "...)noexcept=0", "...=0;". Match any "=0" that follows a ')'.
    bool has_pure_marker = false;
    {
        const size_t close_paren = compact.rfind(')');
        if (close_paren != std::string::npos)
        {
            const std::string tail = compact.substr(close_paren);
            if (tail.find("=0") != std::string::npos)
            {
                has_pure_marker = true;
            }
        }
    }
    if (has_virtual && has_pure_marker)
    {
        return "pure_virtual";
    }
    if (has_override)
    {
        return "override";
    }
    if (has_virtual)
    {
        return "virtual";
    }
    return {};
}

void walk_class_blocks(
    const ParseTreeNode& node,
    std::vector<const ParseTreeNode*>& out)
{
    if (node.kind == "Block" && is_class_block_value(node.value))
    {
        out.push_back(&node);
    }
    for (const ParseTreeNode& child : node.children)
    {
        walk_class_blocks(child, out);
    }
}

bool subtree_returns_known_class(
    const ParseTreeNode& node,
    const ParseTreeSymbolTables& tables,
    std::string& out_class)
{
    std::vector<const ParseTreeNode*> stack{&node};
    while (!stack.empty())
    {
        const ParseTreeNode* current = stack.back();
        stack.pop_back();
        if (current->kind == "ReturnStatement")
        {
            const std::string lowered = lower_ascii(current->value);
            // Look for make_unique<X>, make_shared<X>, new X, or bare ClassName
            const size_t l = lowered.find('<');
            const size_t r = lowered.find('>', l == std::string::npos ? 0 : l + 1);
            if (l != std::string::npos && r != std::string::npos && r > l + 1)
            {
                std::string candidate = trim_whitespace(current->value.substr(l + 1, r - l - 1));
                if (find_class_by_name(tables, candidate) != nullptr)
                {
                    out_class = candidate;
                    return true;
                }
            }
            const size_t new_pos = lowered.find("new ");
            if (new_pos != std::string::npos)
            {
                std::string after = trim_whitespace(current->value.substr(new_pos + 4));
                std::string ident;
                for (char c : after)
                {
                    if (std::isalnum(static_cast<unsigned char>(c)) || c == '_') ident.push_back(c);
                    else break;
                }
                if (!ident.empty() && find_class_by_name(tables, ident) != nullptr)
                {
                    out_class = ident;
                    return true;
                }
            }
        }
        for (const ParseTreeNode& child : current->children)
        {
            stack.push_back(&child);
        }
    }
    return false;
}

size_t hash_string(const std::string& s)
{
    return std::hash<std::string>{}(s);
}

void collect_branch_evidence(
    const ParseTreeNode& base_tree,
    const ParseTreeSymbolTables& tables,
    const std::vector<CrucialClassInfo>& crucial_classes,
    std::vector<BranchEvidence>& out_evidence)
{
    std::unordered_set<std::string> crucial_class_names;
    for (const CrucialClassInfo& c : crucial_classes)
    {
        crucial_class_names.insert(c.name);
    }

    std::vector<const ParseTreeNode*> class_blocks;
    walk_class_blocks(base_tree, class_blocks);

    for (const ParseTreeNode* class_block : class_blocks)
    {
        const std::string class_name = extract_class_name_from_block(class_block->value);
        if (class_name.empty())
        {
            continue;
        }
        if (!crucial_class_names.empty() &&
            crucial_class_names.find(class_name) == crucial_class_names.end())
        {
            continue;
        }

        for (const ParseTreeNode& fn : class_block->children)
        {
            if (fn.kind != "Block" || !is_function_block_value(fn.value))
            {
                continue;
            }
            const std::string fn_name = extract_method_name_from_signature(fn.value);
            if (fn_name.empty())
            {
                continue;
            }

            std::vector<const ParseTreeNode*> branches;
            for (const ParseTreeNode& child : fn.children)
            {
                if (child.kind == "Block" && !classify_branch_kind(child.value).empty())
                {
                    branches.push_back(&child);
                }
            }

            const size_t arity = branches.size();
            for (size_t idx = 0; idx < branches.size(); ++idx)
            {
                const ParseTreeNode* branch = branches[idx];
                BranchEvidence ev;
                ev.file_path = branch->source_file_path.empty() ? fn.source_file_path : branch->source_file_path;
                ev.line_number = branch->source_line_start;
                ev.class_name = class_name;
                ev.function_name = fn_name;
                ev.branch_kind = classify_branch_kind(branch->value);
                ev.condition_text = trim_whitespace(branch->value);
                ev.branch_index = idx;
                ev.branch_arity = arity;
                ev.scope_context_hash = fn.contextual_hash != 0
                    ? fn.contextual_hash
                    : hash_string(class_name + "::" + fn_name);
                std::string returned;
                if (subtree_returns_known_class(*branch, tables, returned))
                {
                    ev.returns_concrete_type = true;
                    ev.returned_concrete_class = returned;
                }
                out_evidence.push_back(std::move(ev));
            }
        }
    }
}

bool signature_has_access_prefix(const std::string& signature)
{
    const std::string lowered = lower_ascii(trim_whitespace(signature));
    return block_signature_starts_with_word(lowered, "public") ||
           block_signature_starts_with_word(lowered, "private") ||
           block_signature_starts_with_word(lowered, "protected");
}

const std::vector<std::string>& read_file_lines_cached(
    const std::string& path,
    std::unordered_map<std::string, std::vector<std::string>>& cache)
{
    auto it = cache.find(path);
    if (it != cache.end())
    {
        return it->second;
    }
    std::vector<std::string> lines;
    std::ifstream file(path);
    if (file)
    {
        std::string line;
        while (std::getline(file, line))
        {
            lines.push_back(line);
        }
    }
    auto inserted = cache.emplace(path, std::move(lines));
    return inserted.first->second;
}

// When the parse tree merges an access specifier (public:/private:/protected:)
// with the following method signature into one node, source_line_start points
// at the access-specifier line instead of the actual method line. Read the
// source file and find the next line within a small window that mentions the
// method name and an open paren.
size_t locate_method_line_in_source(
    const std::vector<std::string>& lines,
    size_t hint_line,
    const std::string& method_name)
{
    if (lines.empty() || method_name.empty() || hint_line == 0)
    {
        return hint_line;
    }
    const std::string needle = method_name.front() == '~' ? method_name.substr(1) : method_name;
    if (needle.empty())
    {
        return hint_line;
    }
    const size_t window = 6;
    const size_t begin = hint_line - 1;
    const size_t end = std::min(begin + window, lines.size());
    for (size_t i = begin; i < end; ++i)
    {
        const std::string& line = lines[i];
        if (line.find('(') == std::string::npos)
        {
            continue;
        }
        if (line.find(needle) == std::string::npos)
        {
            continue;
        }
        const std::string trimmed = trim_whitespace(line);
        const std::string lowered = lower_ascii(trimmed);
        const bool access_only =
            (block_signature_starts_with_word(lowered, "public") ||
             block_signature_starts_with_word(lowered, "private") ||
             block_signature_starts_with_word(lowered, "protected")) &&
            trimmed.find(needle) == std::string::npos;
        if (access_only)
        {
            continue;
        }
        return i + 1;
    }
    return hint_line;
}

bool member_node_carries_method_signature(const ParseTreeNode& node)
{
    // Member methods can land in the parse tree as either Block (function body)
    // or as a declaration-style node such as AssignmentOrVarDecl (e.g.
    // "virtual ~Report() = default;" or "virtual void print() = 0;").
    if (node.kind == "Block")
    {
        return is_function_block_value(node.value);
    }
    if (node.kind == "AssignmentOrVarDecl" || node.kind == "Statement")
    {
        const std::string trimmed = trim_whitespace(node.value);
        if (trimmed.find('(') == std::string::npos || trimmed.find(')') == std::string::npos)
        {
            return false;
        }
        const std::string lowered = lower_ascii(trimmed);
        return token_present(lowered, "virtual") || token_present(lowered, "override");
    }
    return false;
}

void collect_contract_methods(
    const ParseTreeNode& base_tree,
    std::vector<ContractMethodEvidence>& out_evidence)
{
    std::vector<const ParseTreeNode*> class_blocks;
    walk_class_blocks(base_tree, class_blocks);

    // First pass: build a map of class -> {pure-virtual method names}, used to
    // resolve which abstract base each override is implementing.
    std::unordered_map<std::string, std::unordered_set<std::string>> pure_virtuals_by_class;
    std::unordered_map<std::string, std::vector<std::string>> bases_by_class;

    for (const ParseTreeNode* class_block : class_blocks)
    {
        const std::string class_name = extract_class_name_from_block(class_block->value);
        if (class_name.empty())
        {
            continue;
        }
        bases_by_class[class_name] = extract_base_class_names_from_block(class_block->value);

        for (const ParseTreeNode& fn : class_block->children)
        {
            if (!member_node_carries_method_signature(fn))
            {
                continue;
            }
            const std::string kind = classify_contract_kind(fn.value);
            if (kind == "pure_virtual")
            {
                const std::string method_name = extract_method_name_from_signature(fn.value);
                if (!method_name.empty())
                {
                    pure_virtuals_by_class[class_name].insert(method_name);
                }
            }
        }
    }

    auto find_base_for_override = [&](const std::string& class_name,
                                       const std::string& method_name) -> std::string {
        auto bases_it = bases_by_class.find(class_name);
        if (bases_it == bases_by_class.end())
        {
            return {};
        }
        for (const std::string& base : bases_it->second)
        {
            auto pv_it = pure_virtuals_by_class.find(base);
            if (pv_it != pure_virtuals_by_class.end() &&
                pv_it->second.find(method_name) != pv_it->second.end())
            {
                return base;
            }
        }
        if (!bases_it->second.empty())
        {
            return bases_it->second.front();
        }
        return {};
    };

    std::unordered_map<std::string, std::vector<std::string>> file_lines_cache;

    for (const ParseTreeNode* class_block : class_blocks)
    {
        const std::string class_name = extract_class_name_from_block(class_block->value);
        if (class_name.empty())
        {
            continue;
        }
        for (const ParseTreeNode& fn : class_block->children)
        {
            if (!member_node_carries_method_signature(fn))
            {
                continue;
            }
            const std::string kind = classify_contract_kind(fn.value);
            if (kind.empty())
            {
                continue;
            }
            ContractMethodEvidence ev;
            ev.file_path = fn.source_file_path.empty() ? class_block->source_file_path : fn.source_file_path;
            ev.line_number = fn.source_line_start;
            ev.class_name = class_name;
            ev.method_name = extract_method_name_from_signature(fn.value);
            ev.method_signature = trim_whitespace(fn.value);
            ev.contract_kind = kind;
            ev.contract_hash = fn.contextual_hash != 0
                ? fn.contextual_hash
                : hash_string(class_name + "::" + ev.method_signature);
            if (kind == "override")
            {
                ev.base_class_name = find_base_for_override(class_name, ev.method_name);
            }
            if (signature_has_access_prefix(fn.value) && !ev.file_path.empty())
            {
                const std::vector<std::string>& src_lines =
                    read_file_lines_cached(ev.file_path, file_lines_cache);
                ev.line_number = locate_method_line_in_source(
                    src_lines, ev.line_number, ev.method_name);
            }
            out_evidence.push_back(std::move(ev));
        }
    }
}

std::string make_tag_id(
    const std::string& pattern,
    const std::string& tag_type,
    const std::string& symbol_name,
    const std::string& file_path,
    size_t line_number,
    size_t evidence_hash)
{
    return pattern + ":" +
           tag_type + ":" +
           symbol_name + ":" +
           file_path + ":" +
           std::to_string(line_number) + ":" +
           std::to_string(evidence_hash);
}

void add_design_pattern_tag(
    std::vector<DesignPatternTag>& tags,
    std::unordered_set<std::string>& seen_ids,
    DesignPatternTag tag)
{
    if (tag.tag_id.empty())
    {
        tag.tag_id = make_tag_id(
            tag.pattern,
            tag.tag_type,
            tag.symbol_name,
            tag.file_path,
            tag.line_number,
            tag.evidence_hash);
    }

    if (seen_ids.insert(tag.tag_id).second)
    {
        tags.push_back(std::move(tag));
    }
}

std::vector<DesignPatternTag> build_design_pattern_tags(
    const std::string& source_pattern,
    const std::vector<CrucialClassInfo>& crucial_classes,
    const ParseTreeSymbolTables& symbol_tables,
    const std::vector<LineHashTrace>& line_hash_traces,
    const std::vector<FactoryInvocationTrace>& factory_invocation_traces,
    const std::vector<BranchEvidence>& branch_evidence,
    const std::vector<ContractMethodEvidence>& contract_methods)
{
    std::vector<DesignPatternTag> tags;
    std::unordered_set<std::string> seen_ids;
    const std::string pattern = source_pattern.empty() ? "unknown" : source_pattern;

    // Per-class structural counts so role/line tags can carry concrete context
    // instead of generic "structural strategy" text.
    std::unordered_map<std::string, size_t> branch_count_by_class;
    std::unordered_map<std::string, size_t> branch_concrete_returns_by_class;
    std::unordered_set<std::string> concrete_products_seen;
    for (const BranchEvidence& b : branch_evidence)
    {
        branch_count_by_class[b.class_name] += 1;
        if (b.returns_concrete_type)
        {
            branch_concrete_returns_by_class[b.class_name] += 1;
            concrete_products_seen.insert(b.returned_concrete_class);
        }
    }
    std::unordered_map<std::string, size_t> pure_virtual_count_by_class;
    std::unordered_map<std::string, size_t> override_count_by_class;
    std::unordered_map<std::string, std::string> override_base_by_class;
    for (const ContractMethodEvidence& c : contract_methods)
    {
        if (c.contract_kind == "pure_virtual")
        {
            pure_virtual_count_by_class[c.class_name] += 1;
        }
        else if (c.contract_kind == "override")
        {
            override_count_by_class[c.class_name] += 1;
            if (!c.base_class_name.empty() && override_base_by_class[c.class_name].empty())
            {
                override_base_by_class[c.class_name] = c.base_class_name;
            }
        }
    }

    auto join_set = [](const std::unordered_set<std::string>& s) {
        std::vector<std::string> sorted(s.begin(), s.end());
        std::sort(sorted.begin(), sorted.end());
        std::string out;
        for (size_t i = 0; i < sorted.size(); ++i)
        {
            if (i > 0) out += ", ";
            out += sorted[i];
        }
        return out;
    };
    const std::string product_list = join_set(concrete_products_seen);

    for (const CrucialClassInfo& class_info : crucial_classes)
    {
        const ParseSymbol* symbol = find_class_by_name(symbol_tables, class_info.name);
        DesignPatternTag tag;
        tag.pattern = pattern;
        tag.tag_type = "pattern_role_class";
        tag.file_path = symbol == nullptr ? std::string{} : symbol->file_path;
        tag.line_number = 0;
        tag.symbol_name = class_info.name;
        tag.node_kind = "ClassDecl";
        tag.node_value = class_info.name;

        const size_t branches = branch_count_by_class[class_info.name];
        const size_t concrete_returns = branch_concrete_returns_by_class[class_info.name];
        std::ostringstream reason;
        reason << "class '" << class_info.name
               << "' selected by structural strategy '" << class_info.strategy_name << "'";
        if (branches > 0)
        {
            reason << "; structural evidence: owns a method with " << branches
                   << " discrimination branch" << (branches == 1 ? "" : "es")
                   << ", " << concrete_returns << " of which return a known concrete subtype";
        }
        if (!product_list.empty())
        {
            reason << "; concrete product types observed: " << product_list;
        }
        tag.reason = reason.str();
        tag.documentation_hint =
            "Document this class as the structural role-bearer of the pattern; explain which abstract base it produces and which concrete subtypes it can return. A unit test that fails here indicates the role-bearing class no longer participates structurally.";
        tag.evidence_hash = class_info.class_name_hash;
        add_design_pattern_tag(tags, seen_ids, std::move(tag));
    }

    for (const ParseSymbolUsage& usage : class_usage_table(symbol_tables))
    {
        if (!usage.refactor_candidate)
        {
            continue;
        }

        const ParseSymbol* symbol = find_class_by_name(symbol_tables, usage.name);
        DesignPatternTag tag;
        tag.pattern = pattern;
        tag.tag_type = "pattern_candidate_usage";
        tag.file_path = symbol == nullptr ? std::string{} : symbol->file_path;
        tag.line_number = 0;
        tag.symbol_name = usage.name;
        tag.node_kind = usage.node_kind;
        tag.node_value = usage.node_value;
        tag.reason = "usage of '" + usage.name +
                     "' (node_kind=" + usage.node_kind +
                     ") flagged refactor-candidate by the structural analyzer; this usage participates in the detected pattern's role-bearer's call graph";
        tag.documentation_hint =
            "Document this usage as evidence that consumers depend on the pattern role. A unit test asserting this consumer's behavior protects the role-bearer's external contract.";
        tag.evidence_hash = usage.hash_value;
        add_design_pattern_tag(tags, seen_ids, std::move(tag));
    }

    for (const LineHashTrace& trace : line_hash_traces)
    {
        DesignPatternTag tag;
        tag.pattern = pattern;
        tag.tag_type = "pattern_line_trace";
        tag.file_path = trace.file_path;
        tag.line_number = trace.line_number;
        tag.symbol_name = trace.class_name;
        tag.node_kind = "LineHashTrace";
        tag.node_value = trace.class_name;
        std::ostringstream reason;
        reason << "line " << trace.line_number << " ties to class '" << trace.class_name
               << "' (class_name_hash=" << trace.class_name_hash
               << ", scoped_class_usage_hash=" << trace.scoped_class_usage_hash
               << ", dirty_tokens=" << trace.dirty_token_count
               << "); this line carries structural evidence of the pattern role anchored on '"
               << trace.class_name << "'";
        tag.reason = reason.str();
        tag.documentation_hint =
            "Document this line as one source location where the pattern role becomes observable; if a unit test asserting this line's behavior fails, the structural identity of '" +
            trace.class_name + "' has drifted.";
        tag.evidence_hash = trace.scoped_class_usage_hash;
        add_design_pattern_tag(tags, seen_ids, std::move(tag));
    }

    for (const FactoryInvocationTrace& trace : factory_invocation_traces)
    {
        DesignPatternTag tag;
        tag.pattern = pattern;
        tag.tag_type = "factory_invocation";
        tag.file_path = trace.file_path;
        tag.line_number = trace.line_number;
        tag.symbol_name = trace.resolved_factory_class.empty() ? trace.receiver_$1***REDACTED***$2;
        tag.node_kind = "FactoryInvocation";
        tag.node_value = trace.invocation_form;
        std::ostringstream reason;
        reason << "factory construction call: receiver='" << trace.receiver_token
               << "' resolved_class='"
               << (trace.resolved_factory_class.empty() ? "<unresolved>" : trace.resolved_factory_class)
               << "' argument='" << trace.argument_token
               << "' (form=" << trace.invocation_form
               << "); this call site is the externally-observable instantiation entrypoint of the pattern";
        tag.reason = reason.str();
        tag.documentation_hint =
            "Document the receiver, argument, and resolved factory class. A unit test calling this invocation with a representative argument and asserting the returned concrete type protects the pattern's external contract.";
        tag.evidence_hash = trace.scope_context_hash;
        add_design_pattern_tag(tags, seen_ids, std::move(tag));
    }

    for (const BranchEvidence& b : branch_evidence)
    {
        DesignPatternTag tag;
        tag.pattern = pattern;
        tag.tag_type = "pattern_branch_evidence";
        tag.file_path = b.file_path;
        tag.line_number = b.line_number;
        tag.symbol_name = b.class_name + "::" + b.function_name;
        tag.node_kind = "Branch:" + b.branch_kind;
        tag.node_value = b.condition_text;
        std::ostringstream reason;
        reason << "branch " << (b.branch_index + 1) << " of " << b.branch_arity
               << " inside method '" << b.class_name << "::" << b.function_name
               << "' (kind=" << b.branch_kind << ")";
        if (b.returns_concrete_type)
        {
            reason << "; this branch returns concrete type '" << b.returned_concrete_class
                   << "', so it is one of the discrimination cases that picks which product to instantiate";
        }
        else
        {
            reason << "; this branch is part of the discrimination structure of the factory method";
        }
        tag.reason = reason.str();
        tag.documentation_hint =
            "Document the predicate of this branch and which concrete product it selects. Write one unit test per branch: feed an input that satisfies this predicate and assert the returned concrete type. If that test fails, the discrimination logic of the factory is broken.";
        tag.evidence_hash = b.scope_context_hash;
        add_design_pattern_tag(tags, seen_ids, std::move(tag));
    }

    for (const ContractMethodEvidence& c : contract_methods)
    {
        DesignPatternTag tag;
        tag.pattern = pattern;
        tag.tag_type = "pattern_contract_method";
        tag.file_path = c.file_path;
        tag.line_number = c.line_number;
        tag.symbol_name = c.class_name + "::" + c.method_name;
        tag.node_kind = "ContractMethod:" + c.contract_kind;
        tag.node_value = c.method_signature;
        std::ostringstream reason;
        if (c.contract_kind == "pure_virtual")
        {
            reason << "pure-virtual method '" << c.method_name
                   << "' declared on '" << c.class_name
                   << "' is the polymorphic contract every concrete product must implement; "
                   << "this is the abstract interface of the pattern's product hierarchy";
        }
        else if (c.contract_kind == "override")
        {
            reason << "override of '" << c.method_name
                   << "' in concrete class '" << c.class_name << "'";
            if (!c.base_class_name.empty())
            {
                reason << " implements the polymorphic contract from base '" << c.base_class_name << "'";
            }
            reason << "; this is the per-product implementation of the pattern's polymorphic interface";
        }
        else
        {
            reason << "virtual method '" << c.method_name
                   << "' on '" << c.class_name
                   << "' participates in the polymorphic interface of the pattern hierarchy";
        }
        tag.reason = reason.str();
        if (c.contract_kind == "pure_virtual")
        {
            tag.documentation_hint =
                "Document the abstract contract: inputs, outputs, and required postconditions. Write a unit test that exercises every concrete subtype through this base interface; if it fails, a concrete product no longer honors the pattern's contract.";
        }
        else if (c.contract_kind == "override")
        {
            tag.documentation_hint =
                "Document this implementation's specific behavior. Write a unit test asserting the polymorphic dispatch returns the correct value for this concrete type; if it fails, polymorphism through the abstract base is broken for this product.";
        }
        else
        {
            tag.documentation_hint =
                "Document this virtual method's intended overrideable behavior. A unit test that exercises this method through the base pointer protects the polymorphic surface area.";
        }
        tag.evidence_hash = c.contract_hash;
        add_design_pattern_tag(tags, seen_ids, std::move(tag));
    }

    return tags;
}

size_t estimate_design_pattern_tag_bytes(const std::vector<DesignPatternTag>& tags)
{
    size_t total = tags.capacity() * sizeof(DesignPatternTag);
    for (const DesignPatternTag& tag : tags)
    {
        total += tag.tag_id.size() +
                 tag.pattern.size() +
                 tag.tag_type.size() +
                 tag.file_path.size() +
                 tag.symbol_name.size() +
                 tag.node_kind.size() +
                 tag.node_value.size() +
                 tag.reason.size() +
                 tag.documentation_hint.size();
    }
    return total;
}
} // namespace

PipelineArtifacts run_normalize_and_rewrite_pipeline(
    const std::vector<SourceFileUnit>& source_files,
    const std::string& source_pattern,
    const std::string& target_pattern,
    size_t input_file_count,
    const std::vector<std::string>& input_files)
{
    PipelineArtifacts artifacts;
    artifacts.report.source_pattern = source_pattern;
    artifacts.report.target_pattern = target_pattern;
    artifacts.report.input_file_count = input_file_count;
    artifacts.report.total_elapsed_ms = 0.0;
    artifacts.report.peak_estimated_bytes = 0;
    artifacts.report.expected_file_pair_count = source_files.size();
    artifacts.report.paired_file_count = 0;
    artifacts.report.invariant_failure_count = 0;
    artifacts.report.dirty_trace_count = 0;
    artifacts.report.design_pattern_tag_count = 0;
    artifacts.report.intentional_collision_total = 0;
    artifacts.report.intentional_collision_validated = 0;
    artifacts.report.virtual_nodes_kept = 0;
    artifacts.report.virtual_nodes_pruned = 0;
    artifacts.report.invariant_failures.clear();
    artifacts.report.graph_consistent = false;

    const Clock::time_point pipeline_begin = Clock::now();

    auto run_stage = [&](const std::string& name, auto&& fn) {
        const Clock::time_point begin = Clock::now();
        const size_t bytes = fn();
        const Clock::time_point end = Clock::now();

        StageMetric m;
        m.name = name;
        m.elapsed_ms = std::chrono::duration<double, std::milli>(end - begin).count();
        m.estimated_bytes = bytes;
        artifacts.report.stages.push_back(std::move(m));
        artifacts.report.peak_estimated_bytes = std::max(artifacts.report.peak_estimated_bytes, bytes);
    };

    // 1) Input parse -> base graph
    run_stage("ParseBaseGraph", [&]() {
        ParseTreeBuildContext context;
        context.source_pattern = source_pattern;
        context.target_pattern = target_pattern;
        context.input_files = input_files;
        const ParseTreeBundle trees = build_cpp_parse_trees(source_files, context);
        artifacts.base_tree = trees.main_tree;
        artifacts.virtual_tree = trees.shadow_tree;
        artifacts.line_hash_traces = trees.line_hash_traces;
        artifacts.factory_invocation_traces = trees.factory_invocation_traces;
        artifacts.crucial_classes = trees.crucial_classes;
        artifacts.report.virtual_nodes_kept = trees.virtual_nodes_kept;
        artifacts.report.virtual_nodes_pruned = trees.virtual_nodes_pruned;
        return estimate_parse_tree_bytes(artifacts.base_tree) +
               estimate_parse_tree_bytes(artifacts.virtual_tree);
    });

    // 2) Detect patterns
    run_stage("DetectPatternInstances", [&]() {
        artifacts.creational_tree = build_creational_broken_tree(artifacts.base_tree);
        artifacts.behavioural_tree = build_behavioural_broken_tree(artifacts.base_tree);
        return estimate_creational_tree_bytes(artifacts.creational_tree) +
               estimate_parse_tree_bytes(artifacts.behavioural_tree);
    });

    // 3) Create virtual subgraph
    run_stage("CreateVirtualSubgraph", [&]() {
        // Shadow AST is built during lexical parsing to preserve scope-local usage context.
        return estimate_parse_tree_bytes(artifacts.virtual_tree);
    });

    // 4) Hash affected nodes (symbol tables)
    run_stage("HashAffectedNodes", [&]() {
        ParseTreeSymbolBuildOptions symbol_options;
        for (const CrucialClassInfo& class_info : artifacts.crucial_classes)
        {
            symbol_options.refactor_candidate_class_names.insert(class_info.name);
        }

        artifacts.symbol_tables = build_parse_tree_symbol_tables(artifacts.base_tree, symbol_options);
        artifacts.hash_links = build_parse_tree_hash_links(
            artifacts.base_tree,
            artifacts.virtual_tree,
            artifacts.symbol_tables,
            artifacts.line_hash_traces);

        artifacts.report.dirty_trace_count = artifacts.line_hash_traces.size();
        artifacts.report.paired_file_count = artifacts.hash_links.paired_file_view.size();
        size_t intentional_total = 0;
        size_t intentional_validated = 0;
        for (const LineHashTrace& trace : artifacts.line_hash_traces)
        {
            ++intentional_total;
            if (trace.intentional_scope_collision)
            {
                ++intentional_validated;
            }
        }
        artifacts.report.intentional_collision_total = intentional_total;
        artifacts.report.intentional_collision_validated = intentional_validated;

        return estimate_symbol_table_bytes(artifacts.symbol_tables) +
               estimate_hash_links_bytes(artifacts.hash_links);
    });

    // 5a) Collect structural evidence that anchors per-line documentation
    //     and per-branch unit-test targets.
    run_stage("CollectStructuralPatternEvidence", [&]() {
        collect_branch_evidence(
            artifacts.base_tree,
            artifacts.symbol_tables,
            artifacts.crucial_classes,
            artifacts.branch_evidence);
        collect_contract_methods(
            artifacts.base_tree,
            artifacts.contract_methods);
        return artifacts.branch_evidence.capacity() * sizeof(BranchEvidence) +
               artifacts.contract_methods.capacity() * sizeof(ContractMethodEvidence);
    });

    // 5b) Mark design-pattern evidence for documentation and test coverage.
    run_stage("TagDesignPatternEvidence", [&]() {
        artifacts.design_pattern_tags = build_design_pattern_tags(
            source_pattern,
            artifacts.crucial_classes,
            artifacts.symbol_tables,
            artifacts.line_hash_traces,
            artifacts.factory_invocation_traces,
            artifacts.branch_evidence,
            artifacts.contract_methods);
        artifacts.report.design_pattern_tag_count = artifacts.design_pattern_tags.size();
        return estimate_design_pattern_tag_bytes(artifacts.design_pattern_tags);
    });

    // 6) Apply target policies (scaffold/no-op)
    run_stage("ApplyTargetPolicies", [&]() {
        return estimate_parse_tree_bytes(artifacts.base_tree);
    });

    // 7) Validate consistency
    run_stage("ValidateGraphConsistency", [&]() {
        std::vector<std::string> failures;
        const bool pairing_valid = validate_file_pairing(
            artifacts.base_tree,
            artifacts.virtual_tree,
            failures);
        const bool base_bucketized = validate_bucketized_files(artifacts.base_tree, failures);
        const bool virtual_bucketized = validate_bucketized_files(artifacts.virtual_tree, failures);

        if (artifacts.report.paired_file_count != artifacts.report.expected_file_pair_count)
        {
            failures.push_back("paired_file_count_does_not_match_input_file_count");
        }
        if (artifacts.report.intentional_collision_total > 0 &&
            artifacts.report.intentional_collision_validated == 0)
        {
            failures.push_back("intentional_scope_collision_validation_failed");
        }

        artifacts.report.invariant_failures = std::move(failures);
        artifacts.report.invariant_failure_count = artifacts.report.invariant_failures.size();

        artifacts.report.graph_consistent =
            !artifacts.base_tree.kind.empty() &&
            !artifacts.virtual_tree.kind.empty() &&
            pairing_valid &&
            base_bucketized &&
            virtual_bucketized &&
            artifacts.report.invariant_failure_count == 0;
        return estimate_parse_tree_bytes(artifacts.base_tree);
    });

    const Clock::time_point pipeline_end = Clock::now();
    artifacts.report.total_elapsed_ms =
        std::chrono::duration<double, std::milli>(pipeline_end - pipeline_begin).count();

    return artifacts;
}

std::string pipeline_report_to_json(
    const PipelineReport& report,
    const ParseTreeSymbolTables& symbol_tables,
    const std::vector<LineHashTrace>& line_hash_traces,
    const std::vector<FactoryInvocationTrace>& factory_invocation_traces,
    const HashLinkIndex& hash_links,
    const std::vector<DesignPatternTag>& design_pattern_tags,
    const std::vector<BranchEvidence>& branch_evidence,
    const std::vector<ContractMethodEvidence>& contract_methods)
{
    const std::vector<ParseSymbolUsage>& class_usages = class_usage_table(symbol_tables);
    std::unordered_set<std::string> candidate_class_names;
    for (const ParseSymbolUsage& usage : class_usages)
    {
        if (usage.refactor_candidate)
        {
            candidate_class_names.insert(usage.name);
        }
    }

    std::unordered_set<std::string> documentation_tagged_symbols;
    for (const DesignPatternTag& tag : design_pattern_tags)
    {
        if (!tag.symbol_name.empty())
        {
            documentation_tagged_symbols.insert(tag.symbol_name);
        }
    }

    std::ostringstream out;
    out << "{\n";
    out << "  \"analysis_mode\": \"design_pattern_tagging\",\n";
    out << "  \"code_generation_enabled\": false,\n";
    out << "  \"source_pattern\": \"" << json_escape(report.source_pattern) << "\",\n";
    out << "  \"target_pattern\": \"" << json_escape(report.target_pattern) << "\",\n";
    out << "  \"input_file_count\": " << report.input_file_count << ",\n";
    out << "  \"total_elapsed_ms\": " << report.total_elapsed_ms << ",\n";
    out << "  \"peak_estimated_bytes\": " << report.peak_estimated_bytes << ",\n";
    out << "  \"expected_file_pair_count\": " << report.expected_file_pair_count << ",\n";
    out << "  \"paired_file_count\": " << report.paired_file_count << ",\n";
    out << "  \"invariant_failure_count\": " << report.invariant_failure_count << ",\n";
    out << "  \"dirty_trace_count\": " << report.dirty_trace_count << ",\n";
    out << "  \"design_pattern_tag_count\": " << design_pattern_tags.size() << ",\n";
    out << "  \"intentional_collision_total\": " << report.intentional_collision_total << ",\n";
    out << "  \"intentional_collision_validated\": " << report.intentional_collision_validated << ",\n";
    out << "  \"virtual_nodes_kept\": " << report.virtual_nodes_kept << ",\n";
    out << "  \"virtual_nodes_pruned\": " << report.virtual_nodes_pruned << ",\n";
    out << "  \"graph_consistent\": " << (report.graph_consistent ? "true" : "false") << ",\n";
    out << "  \"invariant_failures\": ";
    append_json_string_array(out, report.invariant_failures);
    out << ",\n";
    out << "  \"paired_file_view\": [\n";
    for (size_t i = 0; i < hash_links.paired_file_view.size(); ++i)
    {
        const FilePairedTreeView& view = hash_links.paired_file_view[i];
        out << "    {\n";
        out << "      \"file_basename\": \"" << json_escape(view.file_basename) << "\",\n";
        out << "      \"file_path\": \"" << json_escape(view.file_path) << "\",\n";
        out << "      \"actual_root_kind\": \"" << json_escape(view.actual_root_kind) << "\",\n";
        out << "      \"virtual_root_kind\": \"" << json_escape(view.virtual_root_kind) << "\"\n";
        out << "    }";
        if (i + 1 < hash_links.paired_file_view.size())
        {
            out << ",";
        }
        out << "\n";
    }
    out << "  ],\n";
    out << "  \"class_registry\": [\n";

    const std::vector<ParseSymbol>& class_symbols = class_symbol_table(symbol_tables);
    for (size_t i = 0; i < class_symbols.size(); ++i)
    {
        const ParseSymbol& s = class_symbols[i];
        const ClassHashLink* class_link = i < hash_links.class_links.size() ? &hash_links.class_links[i] : nullptr;
        const bool documentation_tagged =
            documentation_tagged_symbols.find(s.name) != documentation_tagged_symbols.end();

        out << "    {\n";
        out << "      \"name\": \"" << json_escape(s.name) << "\",\n";
        out << "      \"file_path\": \"" << json_escape(s.file_path) << "\",\n";
        out << "      \"name_hash\": " << s.name_hash << ",\n";
        out << "      \"contextual_hash\": " << s.contextual_hash << ",\n";
        out << "      \"hash\": " << s.hash_value << ",\n";
        out << "      \"refactor_candidate\": "
            << (candidate_class_names.find(s.name) != candidate_class_names.end() ? "true" : "false") << ",\n";
        out << "      \"documentation_tagged\": " << (documentation_tagged ? "true" : "false") << ",\n";
        out << "      \"actual_link_status\": \""
            << json_escape(class_link == nullptr ? "unresolved" : class_link->actual_link_status) << "\",\n";
        out << "      \"virtual_link_status\": \""
            << json_escape(class_link == nullptr ? "unresolved" : class_link->virtual_link_status) << "\",\n";
        out << "      \"link_status\": \""
            << json_escape(class_link == nullptr ? "unresolved" : class_link->link_status) << "\",\n";
        out << "      \"actual_tree_links\": ";
        if (class_link != nullptr)
        {
            append_json_node_refs(out, class_link->actual_nodes);
        }
        else
        {
            out << "[]";
        }
        out << ",\n";
        out << "      \"virtual_tree_links\": ";
        if (class_link != nullptr)
        {
            append_json_node_refs(out, class_link->virtual_nodes);
        }
        else
        {
            out << "[]";
        }
        out << ",\n";
        out << "      \"definition_node_index\": " << s.definition_node_index << "\n";
        out << "    }";
        if (i + 1 < class_symbols.size())
        {
            out << ",";
        }
        out << "\n";
    }

    out << "  ],\n";
    out << "  \"class_usages\": [\n";

    for (size_t i = 0; i < class_usages.size(); ++i)
    {
        const ParseSymbolUsage& u = class_usages[i];
        out << "    {\n";
        out << "      \"name\": \"" << json_escape(u.name) << "\",\n";
        out << "      \"type_string\": \"" << json_escape(u.type_string) << "\",\n";
        out << "      \"node_kind\": \"" << json_escape(u.node_kind) << "\",\n";
        out << "      \"node_value\": \"" << json_escape(u.node_value) << "\",\n";
        out << "      \"node_index\": " << u.node_index << ",\n";
        out << "      \"node_contextual_hash\": " << u.node_contextual_hash << ",\n";
        out << "      \"class_name_hash\": " << u.class_name_hash << ",\n";
        out << "      \"hash_collision\": " << (u.hash_collision ? "true" : "false") << ",\n";
        out << "      \"refactor_candidate\": " << (u.refactor_candidate ? "true" : "false") << ",\n";
        out << "      \"documentation_tagged\": "
            << (documentation_tagged_symbols.find(u.name) != documentation_tagged_symbols.end() ? "true" : "false") << ",\n";
        out << "      \"hash\": " << u.hash_value << "\n";
        out << "    }";
        if (i + 1 < class_usages.size())
        {
            out << ",";
        }
        out << "\n";
    }

    out << "  ],\n";
    out << "  \"line_hash_traces\": [\n";

    for (size_t i = 0; i < line_hash_traces.size(); ++i)
    {
        const LineHashTrace& t = line_hash_traces[i];
        const UsageHashLink* usage_link = i < hash_links.usage_links.size() ? &hash_links.usage_links[i] : nullptr;
        out << "    {\n";
        out << "      \"file_path\": \"" << json_escape(t.file_path) << "\",\n";
        out << "      \"line_number\": " << t.line_number << ",\n";
        out << "      \"class_name\": \"" << json_escape(t.class_name) << "\",\n";
        out << "      \"class_name_hash\": " << t.class_name_hash << ",\n";
        out << "      \"matched_class_contextual_hash\": " << t.matched_class_contextual_hash << ",\n";
        out << "      \"scope_hash\": " << t.scope_hash << ",\n";
        out << "      \"scoped_class_usage_hash\": " << t.scoped_class_usage_hash << ",\n";
        out << "      \"hit_token_index\": " << t.hit_token_index << ",\n";
        out << "      \"outgoing_hash\": " << t.outgoing_hash << ",\n";
        out << "      \"dirty_token_count\": " << t.dirty_token_count << ",\n";
        out << "      \"hash_chain\": ";
        append_json_number_array(out, t.hash_chain);
        out << ",\n";
        out << "      \"refactor_candidate_class\": "
            << (candidate_class_names.find(t.class_name) != candidate_class_names.end() ? "true" : "false") << ",\n";
        out << "      \"hash_collision\": " << (t.hash_collision ? "true" : "false") << ",\n";
        out << "      \"intentional_scope_collision\": "
            << (t.intentional_scope_collision ? "true" : "false") << ",\n";
        out << "      \"class_link_status\": \""
            << json_escape(usage_link == nullptr ? "unresolved" : usage_link->class_link_status) << "\",\n";
        out << "      \"class_anchor_actual_tree_links\": ";
        if (usage_link != nullptr)
        {
            append_json_node_refs(out, usage_link->class_anchor_actual_nodes);
        }
        else
        {
            out << "[]";
        }
        out << ",\n";
        out << "      \"class_anchor_virtual_tree_links\": ";
        if (usage_link != nullptr)
        {
            append_json_node_refs(out, usage_link->class_anchor_virtual_nodes);
        }
        else
        {
            out << "[]";
        }
        out << ",\n";
        out << "      \"usage_link_status\": \""
            << json_escape(usage_link == nullptr ? "unresolved" : usage_link->usage_link_status) << "\",\n";
        out << "      \"usage_actual_tree_links\": ";
        if (usage_link != nullptr)
        {
            append_json_node_refs(out, usage_link->usage_actual_nodes);
        }
        else
        {
            out << "[]";
        }
        out << ",\n";
        out << "      \"usage_virtual_tree_links\": ";
        if (usage_link != nullptr)
        {
            append_json_node_refs(out, usage_link->usage_virtual_nodes);
        }
        else
        {
            out << "[]";
        }
        out << "\n";
        out << "    }";
        if (i + 1 < line_hash_traces.size())
        {
            out << ",";
        }
        out << "\n";
    }

    out << "  ],\n";
    out << "  \"factory_invocation_traces\": [\n";

    for (size_t i = 0; i < factory_invocation_traces.size(); ++i)
    {
        const FactoryInvocationTrace& trace = factory_invocation_traces[i];
        out << "    {\n";
        out << "      \"file_path\": \"" << json_escape(trace.file_path) << "\",\n";
        out << "      \"line_number\": " << trace.line_number << ",\n";
        out << "      \"scope_context_hash\": " << trace.scope_context_hash << ",\n";
        out << "      \"invocation_form\": \"" << json_escape(trace.invocation_form) << "\",\n";
        out << "      \"receiver_token\": \"" << json_escape(trace.receiver_token) << "\",\n";
        out << "      \"resolved_factory_class\": \"" << json_escape(trace.resolved_factory_class) << "\",\n";
        out << "      \"argument_token\": \"" << json_escape(trace.argument_token) << "\",\n";
        out << "      \"argument_hash_id\": \"" << json_escape(trace.argument_hash_id) << "\"\n";
        out << "    }";
        if (i + 1 < factory_invocation_traces.size())
        {
            out << ",";
        }
        out << "\n";
    }

    out << "  ],\n";
    out << "  \"design_pattern_tags\": [\n";

    for (size_t i = 0; i < design_pattern_tags.size(); ++i)
    {
        const DesignPatternTag& tag = design_pattern_tags[i];
        out << "    {\n";
        out << "      \"tag_id\": \"" << json_escape(tag.tag_id) << "\",\n";
        out << "      \"pattern\": \"" << json_escape(tag.pattern) << "\",\n";
        out << "      \"tag_type\": \"" << json_escape(tag.tag_type) << "\",\n";
        out << "      \"file_path\": \"" << json_escape(tag.file_path) << "\",\n";
        out << "      \"line_number\": " << tag.line_number << ",\n";
        out << "      \"symbol_name\": \"" << json_escape(tag.symbol_name) << "\",\n";
        out << "      \"node_kind\": \"" << json_escape(tag.node_kind) << "\",\n";
        out << "      \"node_value\": \"" << json_escape(tag.node_value) << "\",\n";
        out << "      \"reason\": \"" << json_escape(tag.reason) << "\",\n";
        out << "      \"documentation_hint\": \"" << json_escape(tag.documentation_hint) << "\",\n";
        out << "      \"evidence_hash\": " << tag.evidence_hash << "\n";
        out << "    }";
        if (i + 1 < design_pattern_tags.size())
        {
            out << ",";
        }
        out << "\n";
    }

    out << "  ],\n";
    out << "  \"branch_evidence\": [\n";
    for (size_t i = 0; i < branch_evidence.size(); ++i)
    {
        const BranchEvidence& b = branch_evidence[i];
        out << "    {\n";
        out << "      \"file_path\": \"" << json_escape(b.file_path) << "\",\n";
        out << "      \"line_number\": " << b.line_number << ",\n";
        out << "      \"class_name\": \"" << json_escape(b.class_name) << "\",\n";
        out << "      \"function_name\": \"" << json_escape(b.function_name) << "\",\n";
        out << "      \"branch_kind\": \"" << json_escape(b.branch_kind) << "\",\n";
        out << "      \"condition_text\": \"" << json_escape(b.condition_text) << "\",\n";
        out << "      \"branch_index\": " << b.branch_index << ",\n";
        out << "      \"branch_arity\": " << b.branch_arity << ",\n";
        out << "      \"scope_context_hash\": " << b.scope_context_hash << ",\n";
        out << "      \"returns_concrete_type\": " << (b.returns_concrete_type ? "true" : "false") << ",\n";
        out << "      \"returned_concrete_class\": \"" << json_escape(b.returned_concrete_class) << "\"\n";
        out << "    }";
        if (i + 1 < branch_evidence.size())
        {
            out << ",";
        }
        out << "\n";
    }
    out << "  ],\n";
    out << "  \"contract_methods\": [\n";
    for (size_t i = 0; i < contract_methods.size(); ++i)
    {
        const ContractMethodEvidence& c = contract_methods[i];
        out << "    {\n";
        out << "      \"file_path\": \"" << json_escape(c.file_path) << "\",\n";
        out << "      \"line_number\": " << c.line_number << ",\n";
        out << "      \"class_name\": \"" << json_escape(c.class_name) << "\",\n";
        out << "      \"method_name\": \"" << json_escape(c.method_name) << "\",\n";
        out << "      \"method_signature\": \"" << json_escape(c.method_signature) << "\",\n";
        out << "      \"contract_kind\": \"" << json_escape(c.contract_kind) << "\",\n";
        out << "      \"base_class_name\": \"" << json_escape(c.base_class_name) << "\",\n";
        out << "      \"contract_hash\": " << c.contract_hash << "\n";
        out << "    }";
        if (i + 1 < contract_methods.size())
        {
            out << ",";
        }
        out << "\n";
    }
    out << "  ],\n";
    out << "  \"stages\": [\n";

    for (size_t i = 0; i < report.stages.size(); ++i)
    {
        const StageMetric& s = report.stages[i];
        out << "    {\n";
        out << "      \"name\": \"" << json_escape(s.name) << "\",\n";
        out << "      \"elapsed_ms\": " << s.elapsed_ms << ",\n";
        out << "      \"estimated_bytes\": " << s.estimated_bytes << "\n";
        out << "    }";
        if (i + 1 < report.stages.size())
        {
            out << ",";
        }
        out << "\n";
    }

    out << "  ]\n";
    out << "}\n"; 
    return out.str();
}
