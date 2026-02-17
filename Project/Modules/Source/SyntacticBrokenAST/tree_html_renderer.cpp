#include "tree_html_renderer.hpp"

#include <sstream>

namespace
{
std::string escape_html(const std::string& input)
{
    std::string out;
    out.reserve(input.size());

    for (char c : input)
    {
        switch (c)
        {
            case '&': out += "&amp;"; break;
            case '<': out += "&lt;"; break;
            case '>': out += "&gt;"; break;
            case '"': out += "&quot;"; break;
            case '\'': out += "&#39;"; break;
            default: out.push_back(c); break;
        }
    }

    return out;
}

void write_node_html(std::ostringstream& out, const ParseTreeNode& node)
{
    out << "<li><span class=\"kind\">" << escape_html(node.kind) << "</span>";
    if (!node.value.empty())
    {
        out << " <span class=\"value\">" << escape_html(node.value) << "</span>";
    }

    if (!node.children.empty())
    {
        out << "<ul>";
        for (const ParseTreeNode& child : node.children)
        {
            write_node_html(out, child);
        }
        out << "</ul>";
    }

    out << "</li>";
}
} // namespace

std::string render_tree_html(
    const ParseTreeNode& root,
    const std::string& title,
    const std::string& empty_message)
{
    std::ostringstream out;

    out << "<!doctype html>\n";
    out << "<html lang=\"en\">\n";
    out << "<head>\n";
    out << "  <meta charset=\"utf-8\">\n";
    out << "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n";
    out << "  <title>" << escape_html(title) << "</title>\n";
    out << "  <style>\n";
    out << "    body { font-family: Segoe UI, sans-serif; margin: 24px; background: #f8fbff; color: #1f2937; }\n";
    out << "    h1 { margin: 0 0 12px; font-size: 1.15rem; }\n";
    out << "    p { margin: 0; color: #475569; }\n";
    out << "    ul { list-style: none; margin: 0; padding-left: 1.1rem; border-left: 1px solid #d1d5db; }\n";
    out << "    li { margin: 0.35rem 0; }\n";
    out << "    .kind { font-weight: 700; color: #0f172a; }\n";
    out << "    .value { color: #334155; }\n";
    out << "  </style>\n";
    out << "</head>\n";
    out << "<body>\n";
    out << "  <h1>" << escape_html(title) << "</h1>\n";

    if (root.children.empty())
    {
        out << "  <p>" << escape_html(empty_message) << "</p>\n";
    }
    else
    {
        out << "  <ul>";
        write_node_html(out, root);
        out << "</ul>\n";
    }

    out << "</body>\n";
    out << "</html>\n";

    return out.str();
}
