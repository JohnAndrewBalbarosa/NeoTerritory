#include "codebase_output_writer.hpp"

#include <filesystem>
#include <fstream>
#include <cctype>
#include <string>

namespace
{
const std::string k_test_results_dir = "TestResults";
const std::string k_generated_code_dir = k_test_results_dir + "/generated_code";
const std::string k_generated_html_dir = k_test_results_dir + "/generated_html";

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

std::string code_to_html(const std::string& title, const std::string& code)
{
    std::string html;
    html += "<!doctype html>\n<html lang=\"en\">\n<head>\n";
    html += "  <meta charset=\"utf-8\">\n";
    html += "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n";
    html += "  <title>" + escape_html(title) + "</title>\n";
    html += "  <style>body{font-family:Consolas,monospace;margin:24px;background:#f8fbff;color:#1f2937;}pre{white-space:pre-wrap;border:1px solid #d1d5db;padding:12px;background:#fff;}</style>\n";
    html += "</head>\n<body>\n";
    html += "  <h1>" + escape_html(title) + "</h1>\n";
    html += "  <pre>" + escape_html(code) + "</pre>\n";
    html += "</body>\n</html>\n";
    return html;
}

std::string sanitize_component(const std::string& text)
{
    std::string out;
    out.reserve(text.size());

    for (char c : text)
    {
        const unsigned char uc = static_cast<unsigned char>(c);
        if (std::isalnum(uc) || c == '_' || c == '-')
        {
            out.push_back(c);
        }
        else if (c == ' ' || c == '/')
        {
            out.push_back('_');
        }
    }

    if (out.empty())
    {
        out = "unknown_target";
    }

    return out;
}
} // namespace

bool write_codebase_outputs(
    const std::string& base_code,
    const std::string& target_code,
    const std::string& target_pattern,
    CodebaseOutputPaths& out_paths)
{
    const std::string safe_target_pattern = sanitize_component(target_pattern);

    std::error_code ec;
    std::filesystem::create_directories(k_generated_code_dir, ec);
    if (ec && !std::filesystem::exists(k_generated_code_dir))
    {
        return false;
    }

    ec.clear();
    std::filesystem::create_directories(k_generated_html_dir, ec);
    if (ec && !std::filesystem::exists(k_generated_html_dir))
    {
        return false;
    }

    out_paths.base_cpp_path = k_generated_code_dir + "/generated_base_code.cpp";
    out_paths.target_cpp_path = k_generated_code_dir + "/generated_target_code_" + safe_target_pattern + ".cpp";
    out_paths.base_html_path = k_generated_html_dir + "/generated_base_code.html";
    out_paths.target_html_path = k_generated_html_dir + "/generated_target_code_" + safe_target_pattern + ".html";

    std::ofstream base_cpp(out_paths.base_cpp_path);
    std::ofstream target_cpp(out_paths.target_cpp_path);
    std::ofstream base_html(out_paths.base_html_path);
    std::ofstream target_html(out_paths.target_html_path);

    if (!base_cpp || !target_cpp || !base_html || !target_html)
    {
        return false;
    }

    base_cpp << base_code;
    target_cpp << target_code;
    base_html << code_to_html("Generated Base Code", base_code);
    target_html << code_to_html("Generated Target Code", target_code);
    return true;
}
