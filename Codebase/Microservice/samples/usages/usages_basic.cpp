// SAMPLE — exercises each tagged-usage kind exactly once.
// Expected per Person on the frontend "Tagged usages" section:
//   line 13: declaration  (value_decl)   `Person p1`
//   line 14: member_call  p1.speak       `p1.speak()`
//   line 15: declaration  (ptr_decl)     `Person* p2`
//   line 16: arrow_call   p2->wave       `p2->wave()`
//   line 17: declaration  (ref_decl)     `Person& r1`
//   line 18: member_call  r1.bow         `r1.bow()`
//   line 19: qualified_call create       `Person::create(...)`
//   line 20: new_ctor                    `new Person(...)`
#include <iostream>
#include <memory>

class Person {
public:
    Person() = default;
    explicit Person(int) {}
    static Person create(int x) { return Person(x); }
    void speak() { std::cout << "speak\n"; }
    void wave()  { std::cout << "wave\n"; }
    void bow()   { std::cout << "bow\n"; }
};

int main() {
    Person p1;                  // value_decl
    p1.speak();                 // member_call
    Person* p2 = new Person();  // ptr_decl  + new_ctor
    p2->wave();                 // arrow_call
    Person& r1 = p1;            // ref_decl
    r1.bow();                   // member_call
    Person q = Person::create(42); // qualified_call
    delete p2;
    return 0;
}
