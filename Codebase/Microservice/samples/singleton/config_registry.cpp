// Reference Singleton sample: Meyer's singleton with explicit copy deletion.
// Used to validate the creational.singleton pattern entry.

#include <string>

class ConfigRegistry {
public:
    static ConfigRegistry& getInstance() {
        static ConfigRegistry instance;
        return instance;
    }

    ConfigRegistry(const ConfigRegistry&) = delete;
    ConfigRegistry& operator=(const ConfigRegistry&) = delete;

    void setValue(const std::string& key, const std::string& value) {
        // store key/value
    }

    std::string getValue(const std::string& key) const {
        return std::string();
    }

private:
    ConfigRegistry() = default;
    ~ConfigRegistry() = default;
};

int main() {
    ConfigRegistry& registry = ConfigRegistry::getInstance();
    registry.setValue("hello", "world");
    return 0;
}
