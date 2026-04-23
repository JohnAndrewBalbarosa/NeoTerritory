#include <string>

class Query {
public:
    void set_name(const std::string& value) { name_ = value; }
    void set_limit(int value) { limit_ = value; }

private:
    std::string name_;
    int limit_ = 0;
};

class QueryBuilder {
public:
    QueryBuilder& set_name(const std::string& value)
    {
        name_ = value;
        return *this;
    }

    QueryBuilder& set_limit(int value)
    {
        limit_ = value;
        return *this;
    }

    Query build() const
    {
        Query out;
        out.set_name(name_);
        out.set_limit(limit_);
        return out;
    }

private:
    std::string name_;
    int limit_ = 0;
};

int main()
{
    Query query = QueryBuilder().set_name("users").set_limit(10).build();
    (void)query;
    return 0;
}
