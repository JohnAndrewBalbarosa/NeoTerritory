#include <memory>
#include <mutex>

class Counter {
public:
    void increment() {}
    int value() const { return 0; }
};

class CounterProxy {
    std::unique_ptr<Counter> target_;
    std::mutex mu_;
public:
    void increment() {
        std::lock_guard<std::mutex> lock(mu_);
        if (!target_) target_ = std::make_unique<Counter>();
        target_->increment();
    }
};
