// Sample input for CLI analysis:
// source_pattern=singleton target_pattern=builder

#include <string>
#include <vector>

class AuditLogger {
public:
    static AuditLogger instance() {
        static AuditLogger singleton_instance;
        return singleton_instance;
    }

    void set_service_name(std::string name) {
        service_name = name;
    }

    void log(std::string message) {
        logs.push_back(message);
    }

    size_t size() const {
        return logs.size();
    }

private:
    std::string service_name = "core";
    std::vector<std::string> logs;
};

class RequestScope {
public:
    std::string trace_id;
    std::string actor;
};

int main() {
    AuditLogger logger = AuditLogger::instance();
    logger.set_service_name("api-gateway");
    logger.log("request-start");

    RequestScope scope;
    scope.trace_id = "trace-9001";
    scope.actor = "system";

    return logger.size() > 0 ? 0 : 1;
}
