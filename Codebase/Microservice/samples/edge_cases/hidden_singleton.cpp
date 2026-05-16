// Edge case — a real Meyers Singleton hidden inside a free function.
// The analyser's structural matcher looks for the canonical class-
// level shape (private ctor + static instance() member), so this
// idiomatic-but-unusual form slips past undetected.
// Expected analyser tag: NONE for the singleton role (FALSE NEGATIVE
// for Singleton — the tester should record kind='pattern',
// chosenPattern='Singleton' on the registry() free function line).

#include <string>
#include <unordered_map>

class RegistryImpl {
public:
    void put(const std::string& k, const std::string& v) { m_kv[k] = v; }
    std::string get(const std::string& k) const {
        const auto it = m_kv.find(k);
        return it == m_kv.end() ? "" : it->second;
    }
private:
    std::unordered_map<std::string, std::string> m_kv;
};

// True Singleton via a function-local static. There is exactly one
// RegistryImpl for the lifetime of the program, but the analyser does
// not see a class-level shape with `static instance()` so it never
// tags this as Singleton.
RegistryImpl& registry() {
    static RegistryImpl s_instance;
    return s_instance;
}
