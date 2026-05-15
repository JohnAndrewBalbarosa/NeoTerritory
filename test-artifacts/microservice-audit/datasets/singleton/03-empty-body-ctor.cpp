#include <string>

class ConfigStore {
public:
    static ConfigStore& get() {
        static ConfigStore c;
        return c;
    }
    ConfigStore(const ConfigStore&) = delete;
    ConfigStore& operator=(const ConfigStore&) = delete;
private:
    ConfigStore() {}
};
