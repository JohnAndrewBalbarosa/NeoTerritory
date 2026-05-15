// User-supplied verbatim. Should pass — textbook Meyers' Singleton.
#include <string>

class DatabaseManager {
private:
    DatabaseManager() {
        // Initial setup dito (e.g., pag-connect sa DB)
    }

    DatabaseManager(const DatabaseManager&) = delete;
    DatabaseManager& operator=(const DatabaseManager&) = delete;

public:
    static DatabaseManager& getInstance() {
        static DatabaseManager instance;
        return instance;
    }

    void query(const std::string& sql) {
        // Sample method lang
    }
};
