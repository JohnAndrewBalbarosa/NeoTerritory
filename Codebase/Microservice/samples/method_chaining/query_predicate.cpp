// Method chaining sample WITHOUT a build() terminator.
// Expected: only creational.method_chaining matches; creational.builder does NOT.

#include <string>

class QueryPredicate {
public:
    QueryPredicate& whereField(const std::string& field) {
        m_field = field;
        return *this;
    }

    QueryPredicate& equals(const std::string& value) {
        m_value = value;
        return *this;
    }

    QueryPredicate& orderAscending() {
        m_ascending = true;
        return *this;
    }

private:
    std::string m_field;
    std::string m_value;
    bool        m_ascending = false;
};

int main() {
    QueryPredicate predicate;
    predicate.whereField("name").equals("alice").orderAscending();
    return 0;
}
