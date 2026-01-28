#include "lexer_utils.hpp"
#include <sstream>

std::string strip_preprocessor_directives(const std::string& source)
{
    std::ostringstream out;
    size_t i = 0;
    const size_t n = source.size();

    while (i < n)
    {
        while (i < n && (source[i] == ' ' || source[i] == '\t')) {
            out << source[i++];
        }

        if (i < n && source[i] == '\n') {
            out << '\n';
            ++i;
            continue;
        }

        if (i < n && source[i] == '#') {
            while (i < n && source[i] != '\n')
                ++i;
            
            if (i < n && source[i] == '\n') {
                out << '\n';
                ++i;
            }
            continue;
        }

        if (i + 14 <= n &&
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

        while (i < n)
        {
            char c = source[i];

            if (i + 1 < n && c == '/' && source[i + 1] == '/') {
                while (i < n && source[i] != '\n')
                    ++i;

                if (i < n && source[i] == '\n') {
                    out << '\n';
                    ++i;
                }
                break;
            }

            if (i + 1 < n && c == '/' && source[i + 1] == '*') {
                i += 2;
                while (i < n) {
                    if (source[i] == '\n')
                        out << '\n';
                    if (i + 1 < n && source[i] == '*' && source[i + 1] == '/') {
                        i += 2;
                        break;
                    }
                    ++i;
                }
                continue;
            }

            out << c;
            ++i;

            if (c == '\n')
                break;
        }
    }

    return out.str();
}
