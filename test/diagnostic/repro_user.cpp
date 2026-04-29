#include <string>
#include <iostream>

class ConfigSingleton {
public:
    static ConfigSingleton& getInstance() {
        static ConfigSingleton inst;
        return inst;
    }
    ConfigSingleton(const ConfigSingleton&) = delete;
    ConfigSingleton& operator=(const ConfigSingleton&) = delete;
private:
    ConfigSingleton() {}
};

class Vehicle {
public:
    virtual ~Vehicle() = default;
    virtual std::string name() const = 0;
};

class Car : public Vehicle {
public:
    std::string name() const override { return "car"; }
};

class Bike : public Vehicle {
public:
    std::string name() const override { return "bike"; }
};

class ShapeFactory {
public:
    Vehicle* make(const std::string& kind) {
        if (kind == "car") return new Car();
        if (kind == "bike") return new Bike();
        return nullptr;
    }
};

class QueryBuilder {
public:
    QueryBuilder& table(const std::string& t) { m_table = t; return *this; }
    QueryBuilder& where(const std::string& w) { m_where = w; return *this; }
    std::string build() { return "SELECT * FROM " + m_table + " WHERE " + m_where; }
private:
    std::string m_table;
    std::string m_where;
};

class FluentLogger {
public:
    FluentLogger& tag(const std::string& t)   { m_tag = t; return *this; }
    FluentLogger& level(const std::string& l) { m_level = l; return *this; }
private:
    std::string m_tag;
    std::string m_level;
};

class Repository {
public:
    std::string read(const std::string& key) {
        return "value_" + key;
    }
};

class CachedRepository {
public:
    CachedRepository(Repository* inner) : m_inner(inner) {}
    std::string read(const std::string& key) {
        return m_inner->read(key);
    }
private:
    Repository* m_inner;
};

class PlainHolder {
public:
    PlainHolder(int value) : m_value(value) {}
    int value() const { return m_value; }
private:
    int m_value;
};

int main() {
    ConfigSingleton::getInstance();
    ShapeFactory factory;
    Vehicle* v = factory.make("car");
    delete v;

    QueryBuilder qb;
    std::string sql = qb.table("users").where("id=1").build();

    FluentLogger logger;
    logger.tag("auth").level("info");

    Repository repo;
    CachedRepository cached(&repo);
    cached.read("token");

    PlainHolder holder(42);
    return 0;
}
