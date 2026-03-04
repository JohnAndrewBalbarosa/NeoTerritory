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

int main()
{
    ReportService service = ReportService::instance();
    service.set_format("json");
    service.enable_timestamp(true);
    service.configure_channel("file");
    service.log("ready");
    return 0;
}
