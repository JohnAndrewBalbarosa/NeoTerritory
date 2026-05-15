#include <memory>

class Service {
public:
    virtual ~Service() = default;
    virtual int call() = 0;
};

class RetryDecorator : public Service {
    std::unique_ptr<Service> wrappee_;
public:
    explicit RetryDecorator(std::unique_ptr<Service> w) : wrappee_(std::move(w)) {}
    int call() override {
        for (int i = 0; i < 3; ++i) {
            int r = wrappee_->call();
            if (r >= 0) return r;
        }
        return -1;
    }
};
