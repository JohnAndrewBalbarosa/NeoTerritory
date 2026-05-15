// Adaptive expansion: confirm shape #1 (private-first member ordering)
// reproduces without the comment text the user shipped.
#include <string>

class CacheStore {
private:
    CacheStore() = default;
    CacheStore(const CacheStore&) = delete;
    CacheStore& operator=(const CacheStore&) = delete;

public:
    static CacheStore& getInstance() {
        static CacheStore inst;
        return inst;
    }
    void put(const std::string&, const std::string&) {}
};
