// Reference wrapping sample: a class that implements a shared interface and
// forwards calls to a wrapped member of that same interface. Structurally this
// is the common ground of Adapter, Proxy, and Decorator, so the analyser
// co-emits the wrapping roles it can see (Adapter + Decorator here) and the
// backend AI disambiguates which role this serves. Proxy is intentionally NOT
// emitted: a Proxy is distinguished by an access guard / lazy-init / cache
// (access_control_caching), which this pass-through wrapper deliberately omits.

#include <string>

// Shared component interface — the wrapper and the real subject both implement
// it, which is what makes the wrapping roles structurally ambiguous.
class IDataService {
public:
    virtual ~IDataService() = default;
    virtual std::string fetch(const std::string& key) = 0;
};

class DataService : public IDataService {
public:
    std::string fetch(const std::string& key) override {
        return "value_for_" + key;
    }
};

class LoggingDataService : public IDataService {
public:
    explicit LoggingDataService(IDataService* inner) : m_inner(inner) {}

    std::string fetch(const std::string& key) override {
        return m_inner->fetch(key);
    }

private:
    IDataService* m_inner;
};

int main() {
    DataService backing;
    LoggingDataService wrapped(&backing);
    std::string value = wrapped.fetch("user");
    return 0;
}
