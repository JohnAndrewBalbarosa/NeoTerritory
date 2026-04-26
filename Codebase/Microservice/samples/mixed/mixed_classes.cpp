// Mixed sample: one Singleton class and one plain class side by side.
// Validates per-class isolation: only the Singleton should match.

#include <string>

class Logger {
public:
    static Logger& getInstance() {
        static Logger instance;
        return instance;
    }
    Logger(const Logger&) = delete;
    Logger& operator=(const Logger&) = delete;
    void log(const std::string& message) {}
private:
    Logger() = default;
};

class Calculator {
public:
    Calculator() : m_total(0) {}
    int add(int x) { m_total += x; return m_total; }
    int total() const { return m_total; }
private:
    int m_total;
};
