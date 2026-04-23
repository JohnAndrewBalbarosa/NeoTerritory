#include <memory>
#include <string>

class Report
{
public:
    virtual ~Report() = default;
};

class CsvReport : public Report
{
};

class JsonReport : public Report
{
};

class ReportFactory
{
public:
    std::unique_ptr<Report> create(int kind)
    {
        if (kind == 1)
        {
            return std::make_unique<CsvReport>();
        }
        return std::make_unique<JsonReport>();
    }
};

int main()
{
    ReportFactory factory;
    std::unique_ptr<Report> report = factory.create(1);
    return report ? 0 : 1;
}
