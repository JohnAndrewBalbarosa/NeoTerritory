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

/**
 * @brief Checks if character can start an identifier
 * @param c Character to check
 * @return true if c is a letter or underscore
 */
inline bool is_identifier_start(char c) {
    return std::isalpha(static_cast<unsigned char>(c)) || c == '_';
}

/**
 * @brief Checks if character can continue an identifier
 * @param c Character to check
 * @return true if c is alphanumeric or underscore
 */
inline bool is_identifier_continue(char c) {
    return std::isalnum(static_cast<unsigned char>(c)) || c == '_';
}

#endif // LEXER_UTILS_HPP
