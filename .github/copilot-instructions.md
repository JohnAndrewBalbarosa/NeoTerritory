# NeoTerritory AI Coding Agent Instructions

## Project Overview
NeoTerritory is a C++ research project focused on syntactic analysis and AST (Abstract Syntax Tree) manipulation. The core module, **SyntacticBrokenAST**, provides lexical analysis, token parsing, and AST construction/transformation capabilities.

## Architecture

### Core Module: SyntacticBrokenAST
Located in `Project/Modules/SyntacticBrokenAST/`, this module implements:

- **Lexer** (`lexer.hpp/cpp`): Tokenizes source code into `Token` objects with metadata (line, column, type)
- **Token System** (`token.hpp/cpp`): Defines `TokenType` enum (Preprocessor, Identifier, Keyword, Literals, Operators, etc.)
- **AST Nodes** (`ast.hpp`): Base `ASTNode` struct with parent-child relationship management via `addChild()`
- **Virtual Nodes** (`virtual_node.hpp`): Wrapper nodes that track metadata and dirty state for transformation tracking
- **AST Utilities** (`ast_utils.hpp/cpp`): Tree traversal, height calculation, and debug printing
- **Transform Module** (`transform.hpp/cpp`): Node wrapping logic for entry/exit point instrumentation

### Application Layer
`Project/Layer/Back system/` contains:
- `syntacticBrokenAST.cpp`: Main application that reads source, builds a function graph focusing on `main()`, and applies transformations
- Test files: `syntacticBrokenAST_read_source_test.cpp` for I/O validation

## Key Patterns

### AST Construction
The `build_function_graph()` function scans tokens for the `main` function, wrapping it with `VirtualNode` entry/exit nodes:
```cpp
VirtualNode* entry_wrapper = wrap_node(function, true);
VirtualNode* exit_wrapper = wrap_node(function, false);
entry_wrapper->addChild(function);
function->addChild(exit_wrapper);
```
This pattern is central to control-flow instrumentation.

### Input Handling
Source code is read via:
1. Command-line argument: `program <file_path>`
2. Stdin fallback: reads from standard input if no file provided

See `read_source()` in `syntacticBrokenAST.cpp` for implementation.

### Token Metadata
Every `Token` tracks position (`line`, `column`) and type. The `Lexer` maintains state for accurate source mapping—critical for error reporting and AST decoration.

## Build & Execution

### Build Command
```bash
g++.exe -fdiagnostics-color=always -g -I./Project/Modules/SyntacticBrokenAST \
  <source_file> \
  ./Project/Modules/SyntacticBrokenAST/lexer.cpp \
  ./Project/Modules/SyntacticBrokenAST/token.cpp \
  ./Project/Modules/SyntacticBrokenAST/ast_utils.cpp \
  ./Project/Modules/SyntacticBrokenAST/transform.cpp \
  -o <output.exe>
```

The task `"C/C++: g++.exe build active file"` in VS Code automates this—includes `-I` for module headers and links all `.cpp` implementations.

### Running Tests
- `syntacticBrokenAST_read_source_test.cpp`: Validates source file I/O
- Compile with the same command, then run: `./output.exe <test_file>`

## Development Conventions

### Memory Management
AST nodes are dynamically allocated (`new`). There is no explicit cleanup visible in current code—be aware of potential memory leaks when extending the tree manipulation logic. Consider implementing a cleanup pass or RAII patterns if extending.

### Error Handling
- `Lexer::makeError()` creates error tokens with message metadata
- `read_source()` returns empty string on file read failure; callers must validate
- No exceptions are used; rely on return codes and error tokens

### Namespace & Naming
- Anonymous namespace used for `read_source()` in `syntacticBrokenAST.cpp`
- Derived node types (e.g., `FunctionNode`) add semantic data (e.g., `name` field) to base `ASTNode`

## Contribution Guidelines

Follow [CONTRIBUTING.md](../CONTRIBUTING.md):
- Branch naming: `feature/<name>` or `fix/<name>`
- PR review required before merge to `main`
- Update docs when changing core module interfaces
- Test changes against the provided test files

## References
- **Lexer Output**: `Lexer::scan()` returns `std::vector<Token>` with full source mapping
- **AST Traversal**: Use `traverse()` utility for depth-first visitor pattern
- **Debug**: `print_tree()` outputs AST structure for verification
