#include <memory>

class Logger { public: virtual ~Logger() = default; };
class FileLogger : public Logger {};
class StdoutLogger : public Logger {};

class LoggerFactory {
public:
    Logger* create(int kind) {
        if (kind == 1) return new FileLogger();
        return new StdoutLogger();
    }
};
