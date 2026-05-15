#include <mutex>

class ThreadSafeRegistry {
public:
    static ThreadSafeRegistry& sharedInstance() {
        std::lock_guard<std::mutex> lock(mu_);
        static ThreadSafeRegistry inst;
        return inst;
    }
    ThreadSafeRegistry(const ThreadSafeRegistry&) = delete;
    ThreadSafeRegistry& operator=(const ThreadSafeRegistry&) = delete;
private:
    ThreadSafeRegistry() = default;
    static std::mutex mu_;
};
