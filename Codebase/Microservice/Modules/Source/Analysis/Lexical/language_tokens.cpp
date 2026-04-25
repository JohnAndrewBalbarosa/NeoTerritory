#include "Analysis/Lexical/language_tokens.hpp"

#include <cctype>

std::unordered_set<std::string> language_tokens(const LanguageTokenConfig& config)
{
    std::unordered_set<std::string> tokens = {
        "alignas", "alignof", "and", "and_eq", "asm", "auto",
        "bitand", "bitor", "bool", "break",
        "case", "catch", "char", "char16_t", "char32_t", "class", "compl", "const", "constexpr", "const_cast", "continue",
        "decltype", "default", "delete", "do", "double", "dynamic_cast",
        "else", "enum", "explicit", "export", "extern",
        "false", "float", "for", "friend",
        "goto",
        "if", "inline", "int",
        "long",
        "mutable",
        "namespace", "new", "noexcept", "not", "not_eq", "nullptr",
        "operator", "or", "or_eq",
        "private", "protected", "public",
        "register", "reinterpret_cast", "return",
        "short", "signed", "sizeof", "static", "static_assert", "static_cast", "struct", "switch",
        "template", "this", "thread_local", "throw", "true", "try", "typedef", "typeid", "typename",
        "union", "unsigned", "using",
        "virtual", "void", "volatile",
        "wchar_t", "while",
        "xor", "xor_eq"
    };

    if (!config.case_sensitive)
    {
        std::unordered_set<std::string> lowered;
        lowered.reserve(tokens.size());
        for (const std::string& token : tokens)
        {
            lowered.insert(lowercase_ascii(token));
        }
        return lowered;
    }
    return tokens;
}

std::string lowercase_ascii(const std::string& text)
{
    std::string result = text;
    for (char& character : result)
    {
        if (static_cast<unsigned char>(character) < 128)
        {
            character = static_cast<char>(std::tolower(static_cast<unsigned char>(character)));
        }
    }
    return result;
}
