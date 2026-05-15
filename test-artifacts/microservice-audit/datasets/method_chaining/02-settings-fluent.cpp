#include <string>

class Settings {
    bool darkMode_ = false;
    int fontSize_ = 14;
public:
    Settings& enable(const std::string&) { darkMode_ = true; return *this; }
    Settings& configure(const std::string&, int v) { fontSize_ = v; return *this; }
    Settings& toggle(const std::string&) { darkMode_ = !darkMode_; return *this; }
};
