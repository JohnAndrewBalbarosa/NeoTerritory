// Sample input for CLI analysis:
// source_pattern=singleton target_pattern=factory

#include <string>

class RuntimeConfig {
public:
    static RuntimeConfig instance() {
        static RuntimeConfig singleton_instance;
        return singleton_instance;
    }

    void set_environment(std::string name) {
        environment = name;
    }

    std::string environment_name() const {
        return environment;
    }

private:
    std::string environment = "dev";
};

class SessionContext {
public:
    std::string user_id;
    std::string locale;
};

int main() {
    RuntimeConfig config = RuntimeConfig::instance();
    config.set_environment("prod");

    SessionContext ctx;
    ctx.user_id = "u-101";
    ctx.locale = "en-US";

    return config.environment_name().empty() ? 1 : 0;
}
