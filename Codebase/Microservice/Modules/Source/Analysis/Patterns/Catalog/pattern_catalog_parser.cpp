#include "Analysis/Patterns/Catalog/catalog.hpp"

#include <cctype>
#include <filesystem>
#include <fstream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <utility>
#include <variant>
#include <vector>

namespace
{
struct JsonValue;

enum class JsonKind
{
    Null,
    Bool,
    Number,
    String,
    Array,
    Object,
};

struct JsonValue
{
    JsonKind                                                  kind = JsonKind::Null;
    bool                                                      boolean = false;
    double                                                    number  = 0.0;
    std::string                                               string;
    std::vector<JsonValue>                                    array;
    std::vector<std::pair<std::string, JsonValue>>            object;

    const JsonValue* find(const std::string& key) const
    {
        if (kind != JsonKind::Object) return nullptr;
        for (const auto& kv : object)
        {
            if (kv.first == key) return &kv.second;
        }
        return nullptr;
    }
};

struct JsonCursor
{
    const std::string& text;
    std::size_t        pos = 0;

    explicit JsonCursor(const std::string& t) : text(t) {}

    bool eof() const { return pos >= text.size(); }
    char peek() const { return eof() ? '\0' : text[pos]; }
    void advance() { if (!eof()) ++pos; }

    void skip_whitespace()
    {
        while (!eof() && std::isspace(static_cast<unsigned char>(peek()))) advance();
    }

    bool consume(char expected)
    {
        skip_whitespace();
        if (peek() == expected) { advance(); return true; }
        return false;
    }

    void require(char expected, const char* message)
    {
        if (!consume(expected))
        {
            throw std::runtime_error(std::string("json_parse_error: expected ") + message);
        }
    }
};

JsonValue parse_value(JsonCursor& cursor);

std::string parse_string(JsonCursor& cursor)
{
    cursor.skip_whitespace();
    if (cursor.peek() != '"')
    {
        throw std::runtime_error("json_parse_error: expected string");
    }
    cursor.advance();
    std::string out;
    while (!cursor.eof() && cursor.peek() != '"')
    {
        char c = cursor.peek();
        if (c == '\\')
        {
            cursor.advance();
            char esc = cursor.peek();
            switch (esc)
            {
                case '"':  out.push_back('"');  break;
                case '\\': out.push_back('\\'); break;
                case '/':  out.push_back('/');  break;
                case 'b':  out.push_back('\b'); break;
                case 'f':  out.push_back('\f'); break;
                case 'n':  out.push_back('\n'); break;
                case 'r':  out.push_back('\r'); break;
                case 't':  out.push_back('\t'); break;
                default:   out.push_back(esc);  break;
            }
            cursor.advance();
            continue;
        }
        out.push_back(c);
        cursor.advance();
    }
    if (cursor.eof())
    {
        throw std::runtime_error("json_parse_error: unterminated string");
    }
    cursor.advance();
    return out;
}

JsonValue parse_number(JsonCursor& cursor)
{
    cursor.skip_whitespace();
    std::string buffer;
    if (cursor.peek() == '-') { buffer.push_back('-'); cursor.advance(); }
    while (!cursor.eof())
    {
        char c = cursor.peek();
        if (std::isdigit(static_cast<unsigned char>(c)) || c == '.' || c == 'e' || c == 'E' || c == '+' || c == '-')
        {
            buffer.push_back(c);
            cursor.advance();
        }
        else
        {
            break;
        }
    }
    JsonValue value;
    value.kind   = JsonKind::Number;
    value.number = std::stod(buffer);
    return value;
}

JsonValue parse_array(JsonCursor& cursor)
{
    JsonValue value;
    value.kind = JsonKind::Array;
    cursor.require('[', "[");
    cursor.skip_whitespace();
    if (cursor.consume(']')) return value;
    while (true)
    {
        value.array.push_back(parse_value(cursor));
        cursor.skip_whitespace();
        if (cursor.consume(',')) continue;
        cursor.require(']', "]");
        break;
    }
    return value;
}

JsonValue parse_object(JsonCursor& cursor)
{
    JsonValue value;
    value.kind = JsonKind::Object;
    cursor.require('{', "{");
    cursor.skip_whitespace();
    if (cursor.consume('}')) return value;
    while (true)
    {
        std::string key = parse_string(cursor);
        cursor.require(':', ":");
        JsonValue child = parse_value(cursor);
        value.object.emplace_back(std::move(key), std::move(child));
        cursor.skip_whitespace();
        if (cursor.consume(',')) continue;
        cursor.require('}', "}");
        break;
    }
    return value;
}

JsonValue parse_value(JsonCursor& cursor)
{
    cursor.skip_whitespace();
    char c = cursor.peek();
    if (c == '{') return parse_object(cursor);
    if (c == '[') return parse_array(cursor);
    if (c == '"')
    {
        JsonValue v;
        v.kind   = JsonKind::String;
        v.string = parse_string(cursor);
        return v;
    }
    if (c == 't' || c == 'f')
    {
        std::string word;
        while (!cursor.eof() && std::isalpha(static_cast<unsigned char>(cursor.peek())))
        {
            word.push_back(cursor.peek());
            cursor.advance();
        }
        if (word == "true" || word == "false")
        {
            JsonValue v;
            v.kind    = JsonKind::Bool;
            v.boolean = (word == "true");
            return v;
        }
        throw std::runtime_error("json_parse_error: bad bool literal");
    }
    if (c == 'n')
    {
        std::string word;
        while (!cursor.eof() && std::isalpha(static_cast<unsigned char>(cursor.peek())))
        {
            word.push_back(cursor.peek());
            cursor.advance();
        }
        if (word == "null") return JsonValue{};
        throw std::runtime_error("json_parse_error: bad null literal");
    }
    return parse_number(cursor);
}

JsonValue parse_root(const std::string& text)
{
    JsonCursor cursor(text);
    cursor.skip_whitespace();
    JsonValue value = parse_value(cursor);
    cursor.skip_whitespace();
    return value;
}

LexicalTokenKind parse_token_kind(const std::string& name)
{
    if (name == "Keyword")      return LexicalTokenKind::Keyword;
    if (name == "Identifier")   return LexicalTokenKind::Identifier;
    if (name == "Punctuation")  return LexicalTokenKind::Punctuation;
    if (name == "Operator")     return LexicalTokenKind::Operator;
    if (name == "Literal")      return LexicalTokenKind::Literal;
    if (name == "String")       return LexicalTokenKind::String;
    if (name == "Number")       return LexicalTokenKind::Number;
    if (name == "Comment")      return LexicalTokenKind::Comment;
    if (name == "Whitespace")   return LexicalTokenKind::Whitespace;
    if (name == "EndOfStream")  return LexicalTokenKind::EndOfStream;
    return LexicalTokenKind::Unknown;
}

PatternStepRepeat parse_repeat(const std::string& name)
{
    if (name == "zero_or_one" || name == "?") return PatternStepRepeat::ZeroOrOne;
    if (name == "zero_or_more" || name == "*") return PatternStepRepeat::ZeroOrMore;
    if (name == "one_or_more" || name == "+") return PatternStepRepeat::OneOrMore;
    return PatternStepRepeat::Once;
}

PatternMatcherStep step_from_json(const JsonValue& obj)
{
    PatternMatcherStep step;
    if (const JsonValue* v = obj.find("id"); v && v->kind == JsonKind::String)
    {
        step.id = v->string;
    }
    if (const JsonValue* v = obj.find("expected_kind"); v && v->kind == JsonKind::String)
    {
        step.expected_kind = parse_token_kind(v->string);
    }
    if (const JsonValue* v = obj.find("expected_lexeme_any_of"); v && v->kind == JsonKind::Array)
    {
        for (const JsonValue& entry : v->array)
        {
            if (entry.kind == JsonKind::String)
            {
                step.expected_lexeme_any_of.push_back(entry.string);
            }
        }
    }
    if (const JsonValue* v = obj.find("one_of"); v && v->kind == JsonKind::Array)
    {
        for (const JsonValue& entry : v->array)
        {
            if (entry.kind == JsonKind::Object)
            {
                step.one_of.push_back(step_from_json(entry));
            }
        }
    }
    if (const JsonValue* v = obj.find("optional"); v && v->kind == JsonKind::Bool)
    {
        step.optional = v->boolean;
    }
    if (const JsonValue* v = obj.find("repeat"); v && v->kind == JsonKind::String)
    {
        step.repeat = parse_repeat(v->string);
    }
    if (const JsonValue* v = obj.find("capture_as"); v && v->kind == JsonKind::String)
    {
        step.capture_as = v->string;
    }
    if (const JsonValue* v = obj.find("document_as"); v && v->kind == JsonKind::String)
    {
        step.document_as = v->string;
    }
    return step;
}

PatternTemplate template_from_json(const JsonValue& obj, const std::string& source_file)
{
    PatternTemplate pattern;
    pattern.source_file = source_file;
    if (const JsonValue* v = obj.find("pattern_id"); v && v->kind == JsonKind::String)
    {
        pattern.pattern_id = v->string;
    }
    if (const JsonValue* v = obj.find("pattern_family"); v && v->kind == JsonKind::String)
    {
        pattern.pattern_family = v->string;
    }
    if (const JsonValue* v = obj.find("pattern_name"); v && v->kind == JsonKind::String)
    {
        pattern.pattern_name = v->string;
    }
    if (const JsonValue* v = obj.find("enabled"); v && v->kind == JsonKind::Bool)
    {
        pattern.enabled = v->boolean;
    }
    if (const JsonValue* v = obj.find("ordered_checks"); v && v->kind == JsonKind::Array)
    {
        for (const JsonValue& entry : v->array)
        {
            if (entry.kind == JsonKind::Object)
            {
                pattern.ordered_checks.push_back(step_from_json(entry));
            }
        }
    }
    if (const JsonValue* v = obj.find("lexeme_identifiers"); v && v->kind == JsonKind::Object)
    {
        for (const auto& kv : v->object)
        {
            if (kv.second.kind != JsonKind::Array) continue;
            std::vector<std::string> lexemes;
            for (const JsonValue& entry : kv.second.array)
            {
                if (entry.kind == JsonKind::String)
                {
                    lexemes.push_back(entry.string);
                }
            }
            pattern.lexeme_identifiers.emplace(kv.first, std::move(lexemes));
        }
    }
    if (const JsonValue* v = obj.find("signature_categories"); v && v->kind == JsonKind::Array)
    {
        for (const JsonValue& entry : v->array)
        {
            if (entry.kind == JsonKind::String)
            {
                pattern.signature_categories.push_back(entry.string);
            }
        }
    }
    if (const JsonValue* v = obj.find("subclass_role"); v && v->kind == JsonKind::Object)
    {
        if (const JsonValue* req = v->find("required"); req && req->kind == JsonKind::Bool)
        {
            pattern.subclass_role.required = req->boolean;
        }
        if (const JsonValue* pr = v->find("parent_role"); pr && pr->kind == JsonKind::String)
        {
            pattern.subclass_role.parent_role = pr->string;
        }
        if (const JsonValue* cr = v->find("child_role"); cr && cr->kind == JsonKind::String)
        {
            pattern.subclass_role.child_role = cr->string;
        }
        if (const JsonValue* cid = v->find("child_pattern_id"); cid && cid->kind == JsonKind::String)
        {
            pattern.subclass_role.child_pattern_id = cid->string;
        }
        if (const JsonValue* cc = v->find("child_catalog"); cc && cc->kind == JsonKind::String)
        {
            pattern.subclass_role.child_catalog = cc->string;
        }
    }
    return pattern;
}

std::string read_file_contents(const std::string& path)
{
    std::ifstream stream(path);
    if (!stream.is_open()) return {};
    std::ostringstream buffer;
    buffer << stream.rdbuf();
    return buffer.str();
}

void load_one_file(const std::string& path, PatternCatalog& catalog)
{
    const std::string text = read_file_contents(path);
    if (text.empty())
    {
        catalog.load_diagnostics.push_back("empty_or_missing:" + path);
        return;
    }
    try
    {
        const JsonValue root = parse_root(text);
        if (root.kind == JsonKind::Array)
        {
            for (const JsonValue& entry : root.array)
            {
                if (entry.kind == JsonKind::Object)
                {
                    catalog.patterns.push_back(template_from_json(entry, path));
                }
            }
        }
        else if (root.kind == JsonKind::Object)
        {
            catalog.patterns.push_back(template_from_json(root, path));
        }
        else
        {
            catalog.load_diagnostics.push_back("unexpected_root_kind:" + path);
        }
    }
    catch (const std::exception& ex)
    {
        catalog.load_diagnostics.push_back(std::string(ex.what()) + ":" + path);
    }
}
} // namespace

namespace
{
constexpr const char* kInheritanceMasterlistFilename = "inheritance_driven_patterns.json";
constexpr const char* kLexemeCategoriesFilename     = "lexeme_categories.json";

// Parse pattern_catalog/lexeme_categories.json into the catalog's
// connotation dictionary. Schema: { "categories": { name: [lexemes...] } }.
// Missing or malformed → empty map (ranker degrades to score=0 silently).
void load_lexeme_categories(const std::string& path, PatternCatalog& catalog)
{
    const std::string text = read_file_contents(path);
    if (text.empty())
    {
        catalog.load_diagnostics.push_back("lexeme_categories_missing:" + path);
        return;
    }
    try
    {
        const JsonValue root = parse_root(text);
        if (root.kind != JsonKind::Object) return;
        const JsonValue* cats = root.find("categories");
        if (!cats || cats->kind != JsonKind::Object) return;
        for (const auto& kv : cats->object)
        {
            if (kv.second.kind != JsonKind::Array) continue;
            std::vector<std::vector<std::string>> combos;
            combos.reserve(kv.second.array.size());
            for (const JsonValue& entry : kv.second.array)
            {
                if (entry.kind == JsonKind::String)
                {
                    // Single-token entry — only meaningful for stdlib API
                    // symbols. The connotation rule rejects bare reserved
                    // keywords/operators here at the schema level too:
                    // each entry is its own combo, so a one-keyword
                    // category becomes a one-element combo and the
                    // ranker treats it identically to a multi-token combo
                    // of length 1.
                    combos.push_back({ entry.string });
                }
                else if (entry.kind == JsonKind::Array)
                {
                    std::vector<std::string> combo;
                    combo.reserve(entry.array.size());
                    for (const JsonValue& tok : entry.array)
                    {
                        if (tok.kind == JsonKind::String) combo.push_back(tok.string);
                    }
                    if (!combo.empty()) combos.push_back(std::move(combo));
                }
            }
            catalog.lexeme_categories.emplace(kv.first, std::move(combos));
        }
    }
    catch (const std::exception& ex)
    {
        catalog.load_diagnostics.push_back(std::string(ex.what()) + ":" + path);
    }
}

// Parse the root inheritance_driven_patterns.json into the catalog's
// family-keyed masterlist. Tolerates missing fields silently — the
// masterlist is optional, and absence simply means "no pattern requires
// subclass propagation in this build".
void load_inheritance_masterlist(const std::string& path, PatternCatalog& catalog)
{
    const std::string text = read_file_contents(path);
    if (text.empty())
    {
        catalog.load_diagnostics.push_back("inheritance_masterlist_missing:" + path);
        return;
    }
    try
    {
        const JsonValue root = parse_root(text);
        if (root.kind != JsonKind::Object)
        {
            catalog.load_diagnostics.push_back("inheritance_masterlist_root_not_object:" + path);
            return;
        }
        const JsonValue* fams = root.find("families");
        if (!fams || fams->kind != JsonKind::Object) return;
        for (const auto& kv : fams->object)
        {
            if (kv.second.kind != JsonKind::Array) continue;
            std::vector<std::string> short_names;
            short_names.reserve(kv.second.array.size());
            for (const JsonValue& entry : kv.second.array)
            {
                if (entry.kind == JsonKind::String) short_names.push_back(entry.string);
            }
            catalog.inheritance_driven_patterns.emplace(kv.first, std::move(short_names));
        }
    }
    catch (const std::exception& ex)
    {
        catalog.load_diagnostics.push_back(std::string(ex.what()) + ":" + path);
    }
}
} // namespace

PatternCatalog load_pattern_catalog(const std::string& catalog_directory)
{
    PatternCatalog catalog;
    catalog.catalog_root = catalog_directory;

    std::error_code ec;
    if (!std::filesystem::exists(catalog_directory, ec) ||
        !std::filesystem::is_directory(catalog_directory, ec))
    {
        catalog.load_diagnostics.push_back("catalog_directory_missing:" + catalog_directory);
        return catalog;
    }

    // The recursive walk loads only top-level pattern files at depth
    // {family}/{pattern}.json (depth 1 from the catalog root). Files
    // nested deeper — child catalogs at {family}/{pattern}/subclass.json —
    // are loaded on demand by the matcher's child-propagation pass, not
    // by this scan. The root masterlist is parsed separately.
    const std::filesystem::path root_path(catalog_directory);
    for (const auto& entry : std::filesystem::recursive_directory_iterator(catalog_directory, ec))
    {
        if (ec) break;
        if (!entry.is_regular_file()) continue;
        if (entry.path().extension() != ".json") continue;

        // Distance from the catalog root: 0 = root-level files, 1 =
        // family/file.json, 2+ = nested child catalogs.
        const auto rel = std::filesystem::relative(entry.path(), root_path, ec);
        if (ec) { ec.clear(); continue; }
        const std::size_t depth = std::distance(rel.begin(), rel.end()) - 1;

        if (depth == 0)
        {
            if (entry.path().filename() == kInheritanceMasterlistFilename)
            {
                load_inheritance_masterlist(entry.path().string(), catalog);
            }
            else if (entry.path().filename() == kLexemeCategoriesFilename)
            {
                load_lexeme_categories(entry.path().string(), catalog);
            }
            // Other root-level JSON files are ignored — patterns must live
            // inside a family folder.
            continue;
        }
        if (depth >= 2) continue; // child catalogs handled by the matcher

        // Sidecar documentation templates (e.g. singleton.fallback_doc.json)
        // live alongside detection rules but carry no ordered_checks. They
        // must NOT be loaded as detection patterns — doing so would emit a
        // pattern with an empty check list, which the matcher treats as
        // "always matches" and produces a universal false-positive tag for
        // every class in the file.
        {
            const std::string fname = entry.path().filename().string();
            const std::string suffix = ".fallback_doc.json";
            if (fname.size() >= suffix.size() &&
                fname.compare(fname.size() - suffix.size(), suffix.size(), suffix) == 0)
            {
                continue;
            }
        }

        load_one_file(entry.path().string(), catalog);
    }
    return catalog;
}

PatternCatalog load_pattern_catalog_from_files(const std::vector<std::string>& json_files)
{
    PatternCatalog catalog;
    for (const std::string& path : json_files)
    {
        load_one_file(path, catalog);
    }
    return catalog;
}

bool is_pattern_enabled(const PatternTemplate& pattern)
{
    return pattern.enabled;
}
