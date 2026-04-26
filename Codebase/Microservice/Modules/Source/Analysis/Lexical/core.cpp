#include "Analysis/Lexical/token_stream.hpp"

#include <cctype>
#include <unordered_set>

namespace
{
const std::unordered_set<std::string>& cpp_keywords()
{
    static const std::unordered_set<std::string> keywords = {
        "alignas", "alignof", "and", "and_eq", "asm", "auto",
        "bitand", "bitor", "bool", "break",
        "case", "catch", "char", "char8_t", "char16_t", "char32_t",
        "class", "compl", "concept", "const", "consteval", "constexpr",
        "constinit", "const_cast", "continue",
        "decltype", "default", "delete", "do", "double", "dynamic_cast",
        "else", "enum", "explicit", "export", "extern",
        "false", "final", "float", "for", "friend",
        "goto",
        "if", "inline", "int",
        "long",
        "mutable",
        "namespace", "new", "noexcept", "not", "not_eq", "nullptr",
        "operator", "or", "or_eq", "override",
        "private", "protected", "public",
        "register", "reinterpret_cast", "requires", "return",
        "short", "signed", "sizeof", "static", "static_assert", "static_cast",
        "struct", "switch",
        "template", "this", "thread_local", "throw", "true", "try",
        "typedef", "typeid", "typename",
        "union", "unsigned", "using",
        "virtual", "void", "volatile",
        "wchar_t", "while",
        "xor", "xor_eq",
    };
    return keywords;
}

bool is_identifier_start(char c)
{
    return std::isalpha(static_cast<unsigned char>(c)) != 0 || c == '_';
}

bool is_identifier_continue(char c)
{
    return std::isalnum(static_cast<unsigned char>(c)) != 0 || c == '_';
}

bool is_operator_char(char c)
{
    switch (c)
    {
        case '+': case '-': case '*': case '/': case '%':
        case '=': case '<': case '>': case '!':
        case '&': case '|': case '^': case '~':
        case '?':
            return true;
        default:
            return false;
    }
}

bool is_punctuation_char(char c)
{
    switch (c)
    {
        case '{': case '}': case '(': case ')':
        case '[': case ']': case ';': case ',':
        case '.': case ':':
            return true;
        default:
            return false;
    }
}

struct Cursor
{
    const std::string& source;
    std::size_t        pos    = 0;
    std::size_t        line   = 1;
    std::size_t        column = 1;

    explicit Cursor(const std::string& src) : source(src) {}

    bool eof() const { return pos >= source.size(); }
    char peek(std::size_t offset = 0) const
    {
        return (pos + offset < source.size()) ? source[pos + offset] : '\0';
    }

    void advance()
    {
        if (eof()) return;
        if (source[pos] == '\n')
        {
            ++line;
            column = 1;
        }
        else
        {
            ++column;
        }
        ++pos;
    }
};

void skip_whitespace_and_comments(Cursor& cursor)
{
    while (!cursor.eof())
    {
        const char c = cursor.peek();
        if (std::isspace(static_cast<unsigned char>(c)))
        {
            cursor.advance();
            continue;
        }
        if (c == '/' && cursor.peek(1) == '/')
        {
            while (!cursor.eof() && cursor.peek() != '\n') cursor.advance();
            continue;
        }
        if (c == '/' && cursor.peek(1) == '*')
        {
            cursor.advance();
            cursor.advance();
            while (!cursor.eof() && !(cursor.peek() == '*' && cursor.peek(1) == '/'))
            {
                cursor.advance();
            }
            if (!cursor.eof()) { cursor.advance(); cursor.advance(); }
            continue;
        }
        break;
    }
}

LexicalToken read_string_literal(Cursor& cursor)
{
    LexicalToken token;
    token.kind   = LexicalTokenKind::String;
    token.line   = cursor.line;
    token.column = cursor.column;

    const char quote = cursor.peek();
    token.lexeme.push_back(quote);
    cursor.advance();
    while (!cursor.eof() && cursor.peek() != quote)
    {
        if (cursor.peek() == '\\' && !cursor.eof())
        {
            token.lexeme.push_back(cursor.peek());
            cursor.advance();
            if (!cursor.eof())
            {
                token.lexeme.push_back(cursor.peek());
                cursor.advance();
            }
            continue;
        }
        token.lexeme.push_back(cursor.peek());
        cursor.advance();
    }
    if (!cursor.eof())
    {
        token.lexeme.push_back(cursor.peek());
        cursor.advance();
    }
    return token;
}

LexicalToken read_number_literal(Cursor& cursor)
{
    LexicalToken token;
    token.kind   = LexicalTokenKind::Number;
    token.line   = cursor.line;
    token.column = cursor.column;
    bool seen_dot = false;
    while (!cursor.eof())
    {
        const char c = cursor.peek();
        if (std::isdigit(static_cast<unsigned char>(c)))
        {
            token.lexeme.push_back(c);
            cursor.advance();
        }
        else if (c == '.' && !seen_dot)
        {
            seen_dot = true;
            token.lexeme.push_back(c);
            cursor.advance();
        }
        else
        {
            break;
        }
    }
    return token;
}

LexicalToken read_identifier_or_keyword(Cursor& cursor)
{
    LexicalToken token;
    token.line   = cursor.line;
    token.column = cursor.column;
    while (!cursor.eof() && is_identifier_continue(cursor.peek()))
    {
        token.lexeme.push_back(cursor.peek());
        cursor.advance();
    }
    token.kind = (cpp_keywords().count(token.lexeme) != 0)
                     ? LexicalTokenKind::Keyword
                     : LexicalTokenKind::Identifier;
    return token;
}

LexicalToken read_operator(Cursor& cursor)
{
    LexicalToken token;
    token.kind   = LexicalTokenKind::Operator;
    token.line   = cursor.line;
    token.column = cursor.column;

    const char c0 = cursor.peek();
    const char c1 = cursor.peek(1);
    const char c2 = cursor.peek(2);

    auto consume_n = [&](int n) {
        for (int i = 0; i < n; ++i)
        {
            token.lexeme.push_back(cursor.peek());
            cursor.advance();
        }
    };

    if ((c0 == '<' && c1 == '<' && c2 == '=') ||
        (c0 == '>' && c1 == '>' && c2 == '=') ||
        (c0 == '.' && c1 == '.' && c2 == '.'))
    {
        consume_n(3);
        return token;
    }

    if ((c0 == '=' && c1 == '=') ||
        (c0 == '!' && c1 == '=') ||
        (c0 == '<' && c1 == '=') ||
        (c0 == '>' && c1 == '=') ||
        (c0 == '&' && c1 == '&') ||
        (c0 == '|' && c1 == '|') ||
        (c0 == '<' && c1 == '<') ||
        (c0 == '>' && c1 == '>') ||
        (c0 == '+' && c1 == '+') ||
        (c0 == '-' && c1 == '-') ||
        (c0 == '+' && c1 == '=') ||
        (c0 == '-' && c1 == '=') ||
        (c0 == '*' && c1 == '=') ||
        (c0 == '/' && c1 == '=') ||
        (c0 == '%' && c1 == '=') ||
        (c0 == '&' && c1 == '=') ||
        (c0 == '|' && c1 == '=') ||
        (c0 == '^' && c1 == '=') ||
        (c0 == '-' && c1 == '>'))
    {
        consume_n(2);
        return token;
    }

    consume_n(1);
    return token;
}

LexicalToken read_punctuation(Cursor& cursor)
{
    LexicalToken token;
    token.kind   = LexicalTokenKind::Punctuation;
    token.line   = cursor.line;
    token.column = cursor.column;

    if (cursor.peek() == ':' && cursor.peek(1) == ':')
    {
        token.lexeme.push_back(cursor.peek()); cursor.advance();
        token.lexeme.push_back(cursor.peek()); cursor.advance();
        return token;
    }

    token.lexeme.push_back(cursor.peek());
    cursor.advance();
    return token;
}
} // namespace

std::vector<LexicalToken> tokenize_cpp_source(const std::string& source)
{
    std::vector<LexicalToken> tokens;
    Cursor cursor(source);

    while (true)
    {
        skip_whitespace_and_comments(cursor);
        if (cursor.eof()) break;

        const char c = cursor.peek();
        if (c == '"' || c == '\'')
        {
            tokens.push_back(read_string_literal(cursor));
        }
        else if (std::isdigit(static_cast<unsigned char>(c)))
        {
            tokens.push_back(read_number_literal(cursor));
        }
        else if (is_identifier_start(c))
        {
            tokens.push_back(read_identifier_or_keyword(cursor));
        }
        else if (is_operator_char(c))
        {
            tokens.push_back(read_operator(cursor));
        }
        else if (is_punctuation_char(c))
        {
            tokens.push_back(read_punctuation(cursor));
        }
        else
        {
            cursor.advance();
        }
    }
    return tokens;
}

ClassTokenStream extract_class_token_stream(
    const std::string& class_text,
    std::size_t        class_hash,
    const std::string& file_name)
{
    ClassTokenStream stream;
    stream.class_hash = class_hash;
    stream.file_name  = file_name;
    stream.tokens     = tokenize_cpp_source(class_text);
    return stream;
}
