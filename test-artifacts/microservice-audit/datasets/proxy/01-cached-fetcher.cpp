#include <memory>
#include <mutex>
#include <string>
#include <unordered_map>

class RealFetcher {
public:
    std::string get(const std::string& u) { return u; }
};

class CachedFetcher {
    std::unique_ptr<RealFetcher> real_;
    std::unordered_map<std::string, std::string> cache_;
    std::mutex mu_;
public:
    std::string get(const std::string& u) {
        std::lock_guard<std::mutex> lock(mu_);
        if (auto it = cache_.find(u); it != cache_.end()) return it->second;
        if (!real_) real_ = std::make_unique<RealFetcher>();
        auto r = real_->get(u);
        cache_[u] = r;
        return r;
    }
};
