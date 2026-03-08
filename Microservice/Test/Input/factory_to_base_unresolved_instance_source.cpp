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

class ReportFactory
{
public:
    std::unique_ptr<Report> create(const std::string& type)
    {
        if (type == "json")
        {
            return std::make_unique<JsonReport>();
        }
        return nullptr;
    }
};

int main()
{
    auto factory = acquire_factory();
    std::unique_ptr<Report> report = factory.create("json");
    return 0;
}
