#ifndef LEXER_UTILS_HPP
#define LEXER_UTILS_HPP

#include <string>
#include <utility>

std::pair<std::string, size_t> strip_preprocessor_directives(const std::string &source);

#endif // LEXER_UTILS_HPP
