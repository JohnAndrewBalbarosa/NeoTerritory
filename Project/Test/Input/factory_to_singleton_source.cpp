// Sample input for CLI analysis:
// source_pattern=factory target_pattern=singleton

#include <memory>
#include <string>

class Person {
public:
    explicit Person(std::string n) : name(std::move(n)) {}
    std::string name;
};

class Vehicle {
public:
    explicit Vehicle(std::string b) : brand(std::move(b)) {}
    std::string brand;
};

class Report {
public:
    std::string format;
};

class CsvReport : public Report {
public:
    CsvReport() { format = "csv"; }
};

class JsonReport : public Report {
public:
    JsonReport() { format = "json"; }
};

class ReportFactory {
public:
    std::unique_ptr<Report> create(int kind) {
        if (kind == 0) {
            return std::make_unique<CsvReport>();
        }
        return std::make_unique<JsonReport>();
    }
};

class AppConfig {
public:
    static AppConfig get() {
        static AppConfig instance;
        return instance;
    }

    bool debug = true;
};

int main() {
    ReportFactory factory;
    std::unique_ptr<Report> report = factory.create(1);

    AppConfig cfg = AppConfig::get();
    if (cfg.debug && report) {
        return 0;
    }
    return 1;
}
