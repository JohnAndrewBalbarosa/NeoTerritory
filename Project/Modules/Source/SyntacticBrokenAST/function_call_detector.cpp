#include "function_call_detector.hpp"
#include "virtual_node.hpp"

ASTNode* FunctionCallDetector::detect_function_call(
    const std::vector<Token>& tokens, 
    size_t identifier_pos
) {
    if (identifier_pos + 1 >= tokens.size()) return nullptr;

    size_t pos = identifier_pos + 1;
    
    // Skip empty tokens (whitespace placeholders)
    while (pos < tokens.size() && tokens[pos].lexeme.empty()) {
        ++pos;
    }
    if (pos >= tokens.size() || tokens[pos].lexeme != "(") return nullptr;

    size_t open_paren_pos = pos++;
    int paren_depth = 1;
    
    // Match parentheses to find function call end
    while (pos < tokens.size() && paren_depth > 0) {
        if (tokens[pos].lexeme == "(") ++paren_depth;
        else if (tokens[pos].lexeme == ")") --paren_depth;
        ++pos;
    }
    
    if (paren_depth != 0) return nullptr;

    // Skip whitespace after closing paren
    while (pos < tokens.size() && tokens[pos].lexeme.empty()) {
        ++pos;
    }

    // If followed by '{', it's a function definition, not a call
    if (pos < tokens.size() && tokens[pos].lexeme == "{") return nullptr;

    // Create function call node
    const Token& name_token = tokens[identifier_pos];
    FunctionCallNode* call = new FunctionCallNode;
    call->name = name_token.lexeme;
    call->line = name_token.line;
    call->column = name_token.column;

    VirtualNode* wrapper = new VirtualNode(call, false);
    wrapper->addChild(call);
    
    return wrapper;
}
