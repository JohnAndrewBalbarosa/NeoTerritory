#include "cfg_tree_builder.hpp"
#include "virtual_node.hpp"
#include <unordered_map>
#include <string>

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
    // Find the range of tokens for a function body (between { and })
    struct FunctionBodyRange {
        size_t start;
        size_t end;
        bool valid;
    };

    FunctionBodyRange find_function_body(const std::vector<Token>& tokens, size_t func_decl_pos) {
        FunctionBodyRange range{0, 0, false};
        
        // Find the opening brace
        size_t pos = func_decl_pos;
        while (pos < tokens.size() && tokens[pos].lexeme != "{") {
            ++pos;
        }
        
        if (pos >= tokens.size()) return range;
        
        range.start = pos + 1; // Start after {
        
        // Find matching closing brace
        int brace_count = 1;
        ++pos;
        while (pos < tokens.size() && brace_count > 0) {
            if (tokens[pos].lexeme == "{") ++brace_count;
            else if (tokens[pos].lexeme == "}") --brace_count;
            ++pos;
        }
        
        if (brace_count == 0) {
            range.end = pos - 1; // End before }
            range.valid = true;
        }
        
        return range;
    }

    // Find all function calls within a token range
    std::vector<ASTNode*> find_calls_in_range(const std::vector<Token>& tokens, 
                                               size_t start, size_t end,
                                               const std::vector<ASTNode*>& all_calls) {
        std::vector<ASTNode*> calls_in_range;
        
        for (ASTNode* call_node : all_calls) {
            if (auto* vnode = dynamic_cast<VirtualNode*>(call_node)) {
                if (auto* call = dynamic_cast<FunctionCallNode*>(vnode->target)) {
                    // Check if this call is within the range
                    size_t call_line = call->line;
                    
                    // Find token position for this call
                    for (size_t i = start; i < end && i < tokens.size(); ++i) {
                        if (tokens[i].type == TokenType::Identifier && 
                            tokens[i].lexeme == call->name &&
                            tokens[i].line == call_line) {
                            calls_in_range.push_back(call_node);
                            break;
                        }
                    }
                }
            }
        }
        
        return calls_in_range;
    }

    // Find token position for a function declaration by name
    size_t find_function_decl_pos(const std::vector<Token>& tokens, const std::string& func_name) {
        for (size_t i = 0; i < tokens.size(); ++i) {
            if (tokens[i].type == TokenType::Identifier && tokens[i].lexeme == func_name) {
                // Check if followed by ( and then ) and then {
                size_t pos = i + 1;
                if (pos < tokens.size() && tokens[pos].lexeme == "(") {
                    // Skip to )
                    while (pos < tokens.size() && tokens[pos].lexeme != ")") ++pos;
                    if (pos < tokens.size() && tokens[pos].lexeme == ")") {
                        ++pos;
                        if (pos < tokens.size() && tokens[pos].lexeme == "{") {
                            return i; // This is a function declaration
                        }
                    }
                }
            }
        }
        return tokens.size(); // Not found
    }
}

ASTNode* build_cfg_tree(const std::vector<Token>& tokens, const ParsedNodes& parsed)
{
    if (!parsed.main_root) {
        // No main function found, return empty tree
        ASTNode* empty = new ASTNode;
        empty->line = 1;
        empty->column = 1;
        return empty;
    }

    // Extract main function declaration without VirtualNode wrapper
    FunctionDeclNode* main_func = nullptr;
    if (auto* vnode = dynamic_cast<VirtualNode*>(parsed.main_root)) {
        if (auto* decl = dynamic_cast<FunctionDeclNode*>(vnode->target)) {
            main_func = decl;
        }
    }
    
    if (!main_func) {
        ASTNode* empty = new ASTNode;
        empty->line = 1;
        empty->column = 1;
        return empty;
    }

    // Find main function body in tokens
    size_t main_pos = find_function_decl_pos(tokens, "main");
    if (main_pos >= tokens.size()) return main_func;
    
    FunctionBodyRange main_body = find_function_body(tokens, main_pos);
    if (!main_body.valid) return main_func;

    // Find all function calls within main body
    std::vector<ASTNode*> calls_in_main = find_calls_in_range(
        tokens, main_body.start, main_body.end, parsed.function_calls);

    // Add function calls as children of main (no VirtualNode wrapper)
    for (ASTNode* call : calls_in_main) {
        main_func->addChild(call);
    }

    return main_func;
}
