// SAMPLE (negative): plain data class. Expect ZERO detected patterns.
// Useful for sanity-checking false positives.
#include <string>

class Person {
public:
    Person(std::string n, int a) : name(std::move(n)), age(a) {}
    std::string name;
    int age;
};

int main() {
    Person p("Drew", 23);
    return 0;
}
