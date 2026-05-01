// Method Chaining — flexible test driver.
// Substitutions: {{HEADER}}, {{CLASS_NAME}}
//
// Creational family (the catalog groups it here) → we verify the class can
// be default-constructed and walks naturally as a chain target. The fluent
// "return *this" contract is enforced at compile time wherever the user's
// methods exist.

#include "{{HEADER}}"
#include "introspect.hpp"
#include <cassert>

int main() {
    static_assert(std::is_class_v<{{CLASS_NAME}}>, "{{CLASS_NAME}} must be a class");
    static_assert(nt::is_default_constructible<{{CLASS_NAME}}>::value,
                  "{{CLASS_NAME}} (Method Chaining) should be default-constructible");

    // Behavioural: just compile-instantiate. The chain validity itself is a
    // compile-time check the AI-generated unit-test plan exercises with
    // user-specific setter names (we don't know them statically).
    {{CLASS_NAME}} c;
    nt::touch(c);
    return 0;
}
