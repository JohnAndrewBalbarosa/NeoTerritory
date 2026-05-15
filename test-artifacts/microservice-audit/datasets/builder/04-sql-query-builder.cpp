#include <memory>
#include <string>
#include <vector>

class SqlQuery {};

class QueryBuilder {
    std::string table_;
    std::vector<std::string> wheres_;
public:
    QueryBuilder& setTable(const std::string& t) { table_ = t; return *this; }
    QueryBuilder& addCondition(const std::string& c) { wheres_.push_back(c); return *this; }
    std::unique_ptr<SqlQuery> finalize() {
        return std::make_unique<SqlQuery>();
    }
};
