#include <memory>
#include <string>

class Report
{
public:
    virtual ~Report() = default;
};

class JsonReport : public Report
{
};

class CsvReport : public Report
{
};

class ReportFactory
{
public:
    std::unique_ptr<Report> create(const std::string& type)
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
    ReportFactory factory;
    const std::string type = "json";
    std::unique_ptr<Report> report = factory.create(type);
    return 0;
}
