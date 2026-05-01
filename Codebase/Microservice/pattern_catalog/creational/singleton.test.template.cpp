// Pre-templated unit-test for the Singleton pattern.
// Substitutions: {{HEADER}}, {{CLASS_NAME}}, {{INSTANCE_ACCESSOR}}

#include "{{HEADER}}"
#include <cassert>
#include <type_traits>

// 1. instance() returns the same address on every call.
static int test_singleton_identity() {
    auto& a = {{CLASS_NAME}}::{{INSTANCE_ACCESSOR}}();
    auto& b = {{CLASS_NAME}}::{{INSTANCE_ACCESSOR}}();
    assert(&a == &b);
    return 0;
}

// 2. Copy/assign deleted (compile-time check). std::is_copy_constructible
// already gives us the SFINAE we need — no need to roll our own helper.
static int test_singleton_copy_deleted() {
    static_assert(!std::is_copy_constructible<{{CLASS_NAME}}>::value,
                  "Singleton should delete its copy constructor");
    return 0;
}

int main() {
    test_singleton_identity();
    test_singleton_copy_deleted();
    return 0;
}
