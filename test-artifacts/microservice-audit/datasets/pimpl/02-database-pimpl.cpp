#include <memory>
#include <string>

class DatabaseImpl;

class Database {
    std::unique_ptr<DatabaseImpl> impl_;
public:
    Database();
    ~Database();
    void connect(const std::string& dsn);
    void disconnect();
};
