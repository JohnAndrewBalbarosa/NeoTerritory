// Integration test: one class per pattern in a single source file.
// Expected detections (per class):
//   ConfigSingleton    -> creational.singleton
//   ShapeFactory       -> creational.factory
//   QueryBuilder       -> creational.builder + creational.method_chaining
//   FluentLogger       -> creational.method_chaining (no build, so Builder excluded)
//   CachedRepository   -> structural.adapter + structural.proxy + structural.decorator
//   PlainHolder        -> NO matches (negative control)
//   Repository         -> NO matches (negative control)


#include <string>

class ConfigSingleton {
public:
    static ConfigSingleton& getInstance() {
        static ConfigSingleton instance;
        return instance;
    }
    ConfigSingleton(const ConfigSingleton&) = delete;
    ConfigSingleton& operator=(const ConfigSingleton&) = delete;
private:
    ConfigSingleton() = default;
};

class Vehicle {
public:
    virtual ~Vehicle() = default;
    virtual std::string label() const = 0;
};

class Car : public Vehicle {
public:
    std::string label() const override { return "car"; }
};

class Truck : public Vehicle {
public:
    std::string label() const override { return "truck"; }
};

class ShapeFactory {
public:
    Vehicle* make(const std::string& kind) {
        if (kind == "car") {
            return new Car();
        }
        if (kind == "truck") {
            return new Truck();
        }
        return nullptr;
    }
};

class QueryBuilder {
public:
    QueryBuilder& table(const std::string& name) {
        m_table = name;
        return *this;
    }
    QueryBuilder& where(const std::string& clause) {
        m_where = clause;
        return *this;
    }
    std::string build() const {
        return "SELECT * FROM " + m_table + " WHERE " + m_where;
    }
private:
    std::string m_table;
    std::string m_where;
};

class FluentLogger {
public:
    FluentLogger& tag(const std::string& value) {
        m_tag = value;
        return *this;
    }
    FluentLogger& level(const std::string& value) {
        m_level = value;
        return *this;
    }
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
