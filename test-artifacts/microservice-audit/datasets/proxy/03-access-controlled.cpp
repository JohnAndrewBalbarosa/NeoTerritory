#include <memory>
#include <mutex>
#include <string>

class FileResource {
public:
    void read() {}
};

class AccessControlledProxy {
    std::unique_ptr<FileResource> resource_;
    std::mutex mu_;
    std::string user_;
public:
    explicit AccessControlledProxy(const std::string& u) : user_(u) {}
    void read() {
        std::lock_guard<std::mutex> lock(mu_);
        if (user_.empty()) return;
        if (!resource_) resource_ = std::make_unique<FileResource>();
        resource_->read();
    }
};
