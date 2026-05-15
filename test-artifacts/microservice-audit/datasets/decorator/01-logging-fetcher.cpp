#include <memory>
#include <string>

class Fetcher {
public:
    virtual ~Fetcher() = default;
    virtual std::string get(const std::string& url) = 0;
};

class LoggingFetcher : public Fetcher {
    std::unique_ptr<Fetcher> inner_;
public:
    explicit LoggingFetcher(std::unique_ptr<Fetcher> w) : inner_(std::move(w)) {}
    std::string get(const std::string& url) override {
        return inner_->get(url);
    }
};
