#ifndef LEXER_UTILS_HPP
#define LEXER_UTILS_HPP

#include <string>
#include <utility>

/**
 * @brief Removes preprocessor directives and using namespace statements from C++ source code
 * 
 * Preserves newlines to maintain accurate line numbers for error reporting.
 * 
 * @param source The original source code string
 * @return Cleaned source code (without #directives and using namespace, but with newlines preserved)
 */
std::string strip_preprocessor_directives(const std::string& source);

#endif // LEXER_UTILS_HPP
