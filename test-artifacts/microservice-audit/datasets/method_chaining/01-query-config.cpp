#include <vector>
#include <string>

class QueryConfig {
    std::vector<std::string> filters_;
    int limit_ = 0;
public:
    QueryConfig& where(const std::string& clause) { filters_.push_back(clause); return *this; }
    QueryConfig& orderBy(const std::string& col)  { filters_.push_back("order:" + col); return *this; }
    QueryConfig& limit(int n)                     { limit_ = n; return *this; }
};
