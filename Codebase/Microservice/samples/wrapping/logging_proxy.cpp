// Reference wrapping sample: a class that forwards calls to a wrapped member.
// Structurally identical to Adapter, Proxy, and Decorator — expected co-emit of all three.
// AI on the backend disambiguates which wrapping role this serves.

#include <string>

class DataService {
public:
    std::string fetch(const std::string& key) {
        return "value_for_" + key;
    }
};

class LoggingDataService {
public:
    LoggingDataService(DataService* inner) : m_inner(inner) {}

    std::string fetch(const std::string& key) {
        return m_inner->fetch(key);
    }

private:
    DataService* m_inner;
};

int main() {
    DataService backing;
    LoggingDataService wrapped(&backing);
    std::string value = wrapped.fetch("user");
    return 0;
}
