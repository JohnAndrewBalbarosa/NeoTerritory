#include <memory>
#include <string>

class Request {};

class RequestBuilder {
    std::string method_;
    std::string body_;
public:
    RequestBuilder& withMethod(const std::string& m) { method_ = m; return *this; }
    RequestBuilder& withBody(const std::string& b)   { body_   = b; return *this; }
    std::unique_ptr<Request> build() {
        return std::make_unique<Request>();
    }
};
