# token_stream.hpp

- Source: Microservice/Modules/Header/Analysis/Lexical/token_stream.hpp
- Kind: C++ header

## Purpose

Declares the lexical-token data model used by the JSON-driven pattern matcher. Provides:
- `LexicalTokenKind` enum — broad C++ token categories (Keyword, Identifier, Punctuation, Operator, Literal, String, Number, Comment, Whitespace, EndOfStream, Unknown).
- `LexicalToken` — one token with `kind`, `lexeme`, `line`, `column`.
- `ClassTokenStream` — a contiguous slice of tokens belonging to one class declaration, tagged with `class_hash` and source `file_name`.

## Free Functions

- `tokenize_cpp_source(const std::string&) -> std::vector<LexicalToken>` — full-file C++ tokenizer used by both the trees stage and the symbol-usage pass.
- `extract_class_token_stream(const std::string& class_text, std::size_t class_hash, const std::string& file_name) -> ClassTokenStream` — narrows tokenization to a single class slice.

## Why It Matters

Pattern matching against the JSON catalog (see `Patterns/Catalog/matcher.hpp`) runs over `ClassTokenStream` instances, not over raw source text. The tokenizer here is therefore the canonical lexer for the entire matching pipeline.

## Acceptance Checks

- The header has no transitive dependency on parsing or symbol-table types — it stays purely lexical.
- Multi-character operators (`::`, `->`, `==`, `<<`, etc.) are recognized as a single `Operator` token, not two `Punctuation` tokens.
- Comment tokens are emitted as a kind so callers can choose to skip them; they are not silently dropped during tokenization.
