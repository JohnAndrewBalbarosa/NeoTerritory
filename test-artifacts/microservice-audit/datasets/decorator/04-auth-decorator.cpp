#include <memory>
#include <string>

class Endpoint {
public:
    virtual ~Endpoint() = default;
    virtual std::string handle(const std::string&) = 0;
};

class AuthDecorator : public Endpoint {
    std::unique_ptr<Endpoint> base_;
public:
    explicit AuthDecorator(std::unique_ptr<Endpoint> b) : base_(std::move(b)) {}
    std::string handle(const std::string& token) override {
        if (token.empty()) return "401";
        return base_->handle(token);
    }
};
