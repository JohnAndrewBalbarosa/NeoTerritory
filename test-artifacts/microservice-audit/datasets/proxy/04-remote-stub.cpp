#include <memory>
#include <string>

class RemoteService {
public:
    std::string call() { return "ok"; }
};

class RemoteProxy {
    std::unique_ptr<RemoteService> service_;
    bool connected_ = false;
public:
    std::string call() {
        if (!connected_) {
            service_ = std::make_unique<RemoteService>();
            connected_ = true;
        }
        return service_->call();
    }
};
