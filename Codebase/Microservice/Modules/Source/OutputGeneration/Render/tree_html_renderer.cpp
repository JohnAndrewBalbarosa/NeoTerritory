#include "OutputGeneration/Render/tree_html_renderer.hpp"
#include "Trees/Actual/parse_tree.hpp"

#include <cstddef>
#include <string>

namespace
{
std::string escape_html(const std::string& text)
{
    std::string out;
    out.reserve(text.size());
    for (char c : text)
    {
        switch (c)
        {
            case '<':  out += "&lt;";   break;
            case '>':  out += "&gt;";   break;
            case '&':  out += "&amp;";  break;
            case '"':  out += "&quot;"; break;
            case '\'': out += "&#39;";  break;
            default:   out.push_back(c);
        }
    }
    return out;
}

void render_node(const ParseTreeNode& node, std::string& out)
{
    out += "<li class=\"parse-node\">";
    out += "<span class=\"node-kind\">";
    out += escape_html(node.kind);
    out += "</span>";
    if (!node.name.empty())
    {
        out += " <span class=\"node-name\">";
        out += escape_html(node.name);
        out += "</span>";
    }
    if (node.line > 0)
    {
        out += " <span class=\"node-loc\">@";
        out += escape_html(node.file_name);
        out += ":";
        out += std::to_string(node.line);
        out += "</span>";
    }
    if (node.hash != 0)
    {
        out += " <span class=\"node-hash\">#";
        out += std::to_string(node.hash);
        out += "</span>";
    }
    if (!node.children.empty())
    {
        out += "<ul>";
        for (const ParseTreeNode& child : node.children)
        {
            render_node(child, out);
        }
        out += "</ul>";
    }
    out += "</li>";
}
} // namespace

std::string render_tree_html(const ParseTreeNode& root)
{
    std::string out;
    out += "<!DOCTYPE html>"
           "<html><head><meta charset=\"utf-8\"><title>Parse Tree</title>"
           "<style>"
           "body{font-family:monospace;background:#0f1115;color:#e6edf3;padding:1rem;}"
           "ul{list-style:none;padding-left:1.25rem;border-left:1px solid #30363d;}"
           ".node-kind{color:#7ee787;font-weight:bold;}"
           ".node-name{color:#79c0ff;}"
           ".node-loc{color:#8b949e;font-size:0.85em;}"
           ".node-hash{color:#d2a8ff;font-size:0.8em;}"
           "</style>"
           "</head><body><ul>";
    render_node(root, out);
    out += "</ul></body></html>";
    return out;
}
