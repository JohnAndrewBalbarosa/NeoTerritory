#include <iostream>
#include <memory>
#include <string>

class Report
{
public:
    virtual ~Report() = default;
    virtual void print() const = 0;
};

class JsonReport : public Report
{
public:
    void print() const override { std::cout << "json report\n"; }
};

class CsvReport : public Report
{
public:
    void print() const override { std::cout << "csv report\n"; }
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
    std::unique_ptr<Report> report;
    report = factory.create("json");
    if (report)
    {
        report->print();
    }
    return 0;
}
