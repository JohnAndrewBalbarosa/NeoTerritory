#include <string>

class Logger {
public:
    static Logger& instance() {
        static Logger inst;
        return inst;
    }
    Logger(const Logger&) = delete;
    Logger& operator=(const Logger&) = delete;
private:
    Logger() = default;
};
