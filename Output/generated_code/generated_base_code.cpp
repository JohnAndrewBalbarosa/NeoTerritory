
// === FILE: C:\Users\Joy\Documents\GitHub\NeoTerritory\Input\builder_to_singleton_source.cpp ===
#include <string>

class Query {
public:
    void set_name(const std::string& value) { name_ = value; }
    void set_limit(int value) { limit_ = value; }

private:
    std::string name_;
    int limit_ = 0;
};

class QueryBuilder {
public:
    QueryBuilder& set_name(const std::string& value)
    {
        name_ = value;
        return *this;
    }

    QueryBuilder& set_limit(int value)
    {
        limit_ = value;
        return *this;
    }

    Query build() const
    {
        Query out;
        out.set_name(name_);
        out.set_limit(limit_);
        return out;
    }

private:
    std::string name_;
    int limit_ = 0;
};



// === FILE: C:\Users\Joy\Documents\GitHub\NeoTerritory\Input\domain_models_source.cpp ===
#include <string>

class Driver {
public:
    void set_name(const std::string& value) { name_ = value; }
    std::string name() const { return name_; }

private:
    std::string name_;
};

class FleetVehicle {
public:
    void set_plate(const std::string& value) { plate_ = value; }
    std::string plate() const { return plate_; }

private:
    std::string plate_;
};

class Trip {
public:
    void assign(const Driver& driver, const FleetVehicle& vehicle)
    {
        driver_name_ = driver.name();
        plate_ = vehicle.plate();
    }

private:
    std::string driver_name_;
    std::string plate_;
};


// === FILE: C:\Users\Joy\Documents\GitHub\NeoTerritory\Input\factory_to_singleton_source.cpp ===
#include <iostream>
#include <memory>
#include <string>

class Report {
public:
    virtual ~Report() = default;
    virtual void print() const = 0;
};

class JsonReport : public Report {
public:
    void print() const override { std::cout << "json report\n"; }
};

class CsvReport : public Report {
public:
    void print() const override { std::cout << "csv report\n"; }
};

class ReportFactory {
public:
    static std::unique_ptr<Report> create(const std::string& type)
    {
        if (type == "json")
        {
            return std::make_unique<JsonReport>();
        }
        if (type == "csv")
        {
            return std::make_unique<CsvReport>();
        }
        return nullptr;
    }
};

int main()
{
    std::unique_ptr<Report> report = ReportFactory::create("json");
    if (report)
    {
        report->print();
    }
    return 0;
}


// === FILE: C:\Users\Joy\Documents\GitHub\NeoTerritory\Input\singleton_to_builder_source.cpp ===
#include <iostream>
#include <string>

class ReportService {
public:
    static ReportService& instance()
    {
        static ReportService inst;
        return inst;
    }

    void set_format(const std::string& value) { format_ = value; }
    void enable_timestamp(bool value) { timestamp_enabled_ = value; }
    void configure_channel(const std::string& value) { channel_ = value; }
    void log(const std::string& message) const
    {
        std::cout << "[" << channel_ << "] " << message << " format=" << format_
                  << " ts=" << timestamp_enabled_ << "\n";
    }

private:
    std::string format_ = "text";
    std::string channel_ = "stdout";
    bool timestamp_enabled_ = false;
};



// === FILE: C:\Users\Joy\Documents\GitHub\NeoTerritory\Input\singleton_to_factory_source.cpp ===
#include <iostream>
#include <string>

class SettingsStore {
public:
    static SettingsStore& instance()
    {
        static SettingsStore inst;
        return inst;
    }

    void set_path(const std::string& value) { path_ = value; }
    void enable_cache(bool value) { cache_enabled_ = value; }
    void log() const { std::cout << "path=" << path_ << " cache=" << cache_enabled_ << "\n"; }

private:
    std::string path_;
    bool cache_enabled_ = false;
};

