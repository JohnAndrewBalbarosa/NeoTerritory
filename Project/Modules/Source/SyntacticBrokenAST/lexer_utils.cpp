#include "lexer_utils.hpp"
#include <sstream>

std::pair<std::string, size_t> strip_preprocessor_directives(const std::string &source)
{
    std::ostringstream result;
    size_t skipped_lines = 0;

    size_t i = 0;
    while (i < source.size())
    {
        // Check if we're at the start of a line
        size_t line_start = i;

        // Skip leading spaces/tabs
        while (i < source.size())
        {
            char c = source[i];
            if (c != ' ' && c != '\t')
                break;
            ++i;
        }

        // If line is just whitespace followed by newline (blank line), skip it
        if (i < source.size())
        {
            char c = source[i];
            if (c == '\n')
            {
                ++i;
                ++skipped_lines; // Increment only when we skip the \n
                continue;
            }
        }

        // If first non-space character is #, skip entire line (preprocessor directive)
        if (i < source.size())
        {
            char c = source[i];
            if (c == '#')
            {
                // Skip until newline or end
                while (i < source.size())
                {
                    char ch = source[i];
                    if (ch == '\n')
                        break;
                    ++i;
                }
                // Skip the newline too
                if (i < source.size())
                {
                    char ch = source[i];
                    if (ch == '\n')
                    {
                        ++i;
                        ++skipped_lines; // Increment only when we skip the \n
                    }
                }
                continue; // Start checking next line
            }
        }

        // Check for "using namespace" declaration
        if (i < source.size())
        {
            char c = source[i];
            if (c == 'u')
            {
                // Check if this is "using namespace"
                if (i + 15 < source.size() &&
                    source.substr(i, 6) == "using " &&
                    source.substr(i + 6, 9) == "namespace")
                {
                    // Skip until semicolon or newline
                    while (i < source.size())
                    {
                        char ch = source[i];
                        if (ch == ';' || ch == '\n')
                            break;
                        ++i;
                    }
                    // Handle the semicolon or newline
                    if (i < source.size())
                    {
                        char ch = source[i];
                        if (ch == '\n')
                        {
                            ++i;
                            ++skipped_lines; // Increment only when we skip the \n
                        }
                        else if (ch == ';')
                        {
                            ++i; // Move past semicolon but don't add to result
                            // Check if there's a newline after semicolon
                            if (i < source.size())
                            {
                                char next_ch = source[i];
                                if (next_ch == '\n')
                                {
                                    ++i;
                                    ++skipped_lines;
                                }
                            }
                        }
                    }
                    continue;
                }
            }
        }

        // Track if we have actual code content on this line (not just whitespace)
        bool has_code = false;
        
        // Not a preprocessor line or using namespace - add everything from line_start to current position
        for (size_t j = line_start; j < i; ++j)
        {
            char c = source[j];
            result << c;
            // Check if this is actual code (not whitespace)
            if (c != ' ' && c != '\t' && c != '\n')
            {
                has_code = true;
            }
        }

        // Add rest of line, stripping all comments
        while (i < source.size())
        {
            char current_char = source[i];
            
            // Check for single-line comment
            if (i + 1 < source.size())
            {
                char next_char = source[i + 1];
                if (current_char == '/' && next_char == '/')
                {
                    // Skip the comment content until newline
                    while (i < source.size())
                    {
                        char ch = source[i];
                        if (ch == '\n')
                            break;
                        ++i;
                    }
                    // Handle the newline
                    if (i < source.size())
                    {
                        char ch = source[i];
                        if (ch == '\n')
                        {
                            ++i;
                            if (has_code)
                            {
                                result << '\n'; // Preserve newline if there was code
                            }
                            else
                            {
                                ++skipped_lines; // Increment only when we skip the \n
                            }
                        }
                    }
                    break;
                }
            }

            // Check for multi-line comment
            if (i + 1 < source.size())
            {
                char next_char = source[i + 1];
                if (current_char == '/' && next_char == '*')
                {
                    // Skip the comment opening
                    i += 2;
                    // Skip the comment content
                    while (i + 1 < source.size())
                    {
                        char ch = source[i];
                        char next_ch = source[i + 1];
                        if (ch == '*' && next_ch == '/')
                            break;
                        if (ch == '\n')
                        {
                            ++skipped_lines; // Increment for each \n inside comment
                        }
                        ++i;
                    }
                    // Skip the closing */
                    if (i + 1 < source.size())
                    {
                        i += 2;
                    }
                    continue;
                }
            }

            // Before writing regular character, check if it's actual code (not whitespace)
            if (current_char != ' ' && current_char != '\t' && current_char != '\n')
            {
                has_code = true;
            }
            
            // Regular character - add to result
            result << current_char;
            if (current_char == '\n')
            {
                ++i;
                break;
            }
            ++i;
        }
    }

    return {result.str(), skipped_lines};
}
