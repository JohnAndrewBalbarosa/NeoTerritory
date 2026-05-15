#include <string>

class OldPrinter {
public:
    void printText(const char* msg) {}
};

class ModernPrinterAdapter {
    OldPrinter legacy;
public:
    void send(const std::string& doc) {
        legacy.printText(doc.c_str());
    }
};
