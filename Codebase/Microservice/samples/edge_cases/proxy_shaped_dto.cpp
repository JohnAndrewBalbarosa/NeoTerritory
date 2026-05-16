// Edge case — a class that wraps a pointer and forwards a call, which
// looks like a structural Proxy to the analyser. But the wrapper owns
// the inner pointer (intentional encapsulation, not transparent
// indirection) and the forwarding adds real domain behaviour
// (timestamping). It's a DTO with caching, not a Proxy.
// Expected analyser tag: structural.proxy (FALSE POSITIVE — the tester
// should record kind='none').

#include <string>

class CachedConfigRecord {
public:
    explicit CachedConfigRecord(const std::string& key) : m_key(key), m_cached("[unset]") {}
    std::string fetch() {
        m_lastAccess++;
        return m_cached;
    }
    void prime(const std::string& value) { m_cached = value; }
    int accessCount() const { return m_lastAccess; }
private:
    std::string m_key;
    std::string m_cached;
    int m_lastAccess = 0;
};
