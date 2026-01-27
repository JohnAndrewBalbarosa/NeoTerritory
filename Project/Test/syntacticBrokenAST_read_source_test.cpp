#include "lexer_utils.hpp"
#include <sstream>

std::string strip_preprocessor_directives(const std::string& source)
{
    std::ostringstream out;
    size_t i = 0;
    const size_t n = source.size();

    while (i < n)
    {
        // 1. Copy leading whitespace
        while (i < n && (source[i] == ' ' || source[i] == '\t')) {
            out << source[i++];
        }

        // 2. Blank line → preserve newline
        if (i < n && source[i] == '\n') {
            out << '\n';
            ++i;
            continue;
        }

        // 3. Preprocessor directive (#...)
        if (i < n && source[i] == '#') {
            // Skip until newline but PRESERVE it
            while (i < n && source[i] != '\n')
                ++i;

            if (i < n && source[i] == '\n') {
                out << '\n';
                ++i;
            }
            continue;
        }

        // 4. using namespace ...
        if (i + 14 < n &&
            source.compare(i, 6, "using ") == 0 &&
            source.compare(i + 6, 9, "namespace") == 0)
        {
            while (i < n && source[i] != '\n')
                ++i;

            if (i < n && source[i] == '\n') {
                out << '\n';
                ++i;
            }
            continue;
        }

        // 5. Process rest of the line
        while (i < n)
        {
            char c = source[i];

            // Single-line comment
            if (i + 1 < n && c == '/' && source[i + 1] == '/') {
                // Skip comment but preserve newline
                while (i < n && source[i] != '\n')
                    ++i;

                if (i < n && source[i] == '\n') {
                    out << '\n';
                    ++i;
                }
                break;
            }

            // Multi-line comment
            if (i + 1 < n && c == '/' && source[i + 1] == '*') {
                i += 2;
                while (i + 1 < n) {
                    if (source[i] == '\n')
                        out << '\n';   // 🔥 preserve every newline
                    if (source[i] == '*' && source[i + 1] == '/') {
                        i += 2;
                        break;
                    }
                    ++i;
                }
                continue;
            }

            // Normal character
            out << c;
            ++i;

            if (c == '\n')
                break;
        }
    }

    return out.str();
}
