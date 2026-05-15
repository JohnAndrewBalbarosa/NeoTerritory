#include <string>

class AppConfig {
    std::string env_;
    int port_ = 8080;
public:
    AppConfig& useEnv(const std::string& e) { env_ = e; return *this; }
    AppConfig& enablePort(int p) { port_ = p; return *this; }
    AppConfig& applyDefaults() { return *this; }
};
