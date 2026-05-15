#include <string>

class HttpOptions {
    std::string ua_;
    int timeout_ = 30;
public:
    HttpOptions& withUserAgent(const std::string& u) { ua_ = u; return *this; }
    HttpOptions& withTimeout(int s) { timeout_ = s; return *this; }
    HttpOptions& withRetry(int) { return *this; }
};
