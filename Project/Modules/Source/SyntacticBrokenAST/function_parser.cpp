#include "function_parser.hpp"
#include "virtual_node.hpp"
#include "transform.hpp"

struct FunctionCallNode : ASTNode
{
    std::string name;
    std::vector<std::string> arguments;
};

struct FunctionDeclNode : ASTNode
{
    std::string name;
};

namespace {
    bool is_type_keyword(const Token& token) {
        if (token.type != TokenType::Keyword) return false;
        return token.lexeme == "int" || token.lexeme == "void" || 
               token.lexeme == "float" || token.lexeme == "double" ||
               token.lexeme == "char" || token.lexeme == "bool";
    }

    bool match(const std::vector<Token>& tokens, size_t& pos, const std::string& lexeme) {
        if (pos < tokens.size() && tokens[pos].lexeme == lexeme) {
            ++pos;
            return true;
        }
        return false;
    }

    bool parse_argument_list(const std::vector<Token>& tokens, size_t& pos, 
                            std::vector<std::string>& args) {
        if (pos >= tokens.size() || tokens[pos].lexeme == ")") {
            return true;
        }

        while (pos < tokens.size()) {
            if (!is_type_keyword(tokens[pos])) break;
            ++pos;

            if (pos >= tokens.size() || tokens[pos].type != TokenType::Identifier) 
                return false;
            
            args.push_back(tokens[pos].lexeme);
            ++pos;

            if (!match(tokens, pos, ",")) break;
        }
        return true;
    }

    ASTNode* try_parse_function_call(const std::vector<Token>& tokens, size_t i) {
        if (i >= tokens.size() || tokens[i].type != TokenType::Identifier)
            return nullptr;

        const Token& name_token = tokens[i];
        size_t pos = i + 1;

        if (!match(tokens, pos, "(")) return nullptr;

        std::vector<std::string> args;
        if (!parse_argument_list(tokens, pos, args)) return nullptr;

        if (!match(tokens, pos, ")")) return nullptr;

        if (pos < tokens.size() && tokens[pos].lexeme == "{")
            return nullptr;

        FunctionCallNode* call = new FunctionCallNode;
        call->name = name_token.lexeme;
        call->arguments = args;
        call->line = name_token.line;
        call->column = name_token.column;

        VirtualNode* wrapper = wrap_node(call, true);
        wrapper->addChild(call);
        return wrapper;
    }

    ASTNode* try_parse_function_decl(const std::vector<Token>& tokens, size_t i) {
        if (i >= tokens.size() || tokens[i].type != TokenType::Identifier)
            return nullptr;

        const Token& name_token = tokens[i];
        size_t pos = i + 1;

        if (!match(tokens, pos, "(")) return nullptr;

        while (pos < tokens.size() && tokens[pos].lexeme != ")") {
            ++pos;
        }
        if (!match(tokens, pos, ")")) return nullptr;

        if (pos >= tokens.size() || tokens[pos].lexeme != "{")
            return nullptr;

        FunctionDeclNode* decl = new FunctionDeclNode;
        decl->name = name_token.lexeme;
        decl->line = name_token.line;
        decl->column = name_token.column;

        VirtualNode* entry = wrap_node(decl, true);
        VirtualNode* exit = wrap_node(decl, false);
        entry->addChild(decl);
        decl->addChild(exit);
        return entry;
    }
}

ASTNode* parse_function_tokens(const std::vector<Token>& tokens)
{
    for (size_t i = 0; i < tokens.size(); ++i)
    {
        if (ASTNode* call = try_parse_function_call(tokens, i))
            return call;
    }

    for (size_t i = 0; i < tokens.size(); ++i)
    {
        if (ASTNode* decl = try_parse_function_decl(tokens, i))
            return decl;
    }

    ASTNode* placeholder = new ASTNode;
    placeholder->line = 1;
    placeholder->column = 1;
    return placeholder;
}
