#include <fstream>
#include <iostream>
#include <sstream>
#include <string>

// Minimal duplicate of the read_source logic from syntacticBrokenAST.cpp.
std::string read_source(int argc, char* argv[]) {
    if (argc > 1) {
        std::ifstream file(argv[1]);
        if (!file) {
            std::cerr << "Failed to open " << argv[1] << '\n';
            return {};
        }
        std::ostringstream buffer;
        buffer << file.rdbuf();
        return buffer.str();
    }
    std::ostringstream buffer;
    buffer << std::cin.rdbuf();
    return buffer.str();
}

int main(int argc, char* argv[]) {
    std::string source = read_source(argc, argv);
    if (source.empty()) {
        std::cout << "No source provided or file could not be read.\n";
        return 1;
    }

    std::cout << "=== Read Source Content ===\n";
    std::cout << source << "\n";
    std::cout << "=== End ===\n";
    return 0;
}
