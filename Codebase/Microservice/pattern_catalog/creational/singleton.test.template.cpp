// Pre-templated unit-test for the Singleton pattern.
// Substitutions: {{HEADER}}, {{CLASS_NAME}}, {{INSTANCE_ACCESSOR}}

#include "{{HEADER}}"
#include <cassert>

// 1. instance() returns the same address on every call.
static int test_singleton_identity() {
    auto& a = {{CLASS_NAME}}::{{INSTANCE_ACCESSOR}}();
    auto& b = {{CLASS_NAME}}::{{INSTANCE_ACCESSOR}}();
    assert(&a == &b);
    return 0;
}

// 2. Copy and assignment must be deleted (compile-time check via SFINAE).
template <typename T, typename = void>
struct is_copy_constructible_check : std::false_type {};
template <typename T>
struct is_copy_constructible_check<T, std::void_t<decltype(T(std::declval<const T&>()))>> : std::true_type {};

static int test_singleton_copy_deleted() {
    static_assert(!is_copy_constructible_check<{{CLASS_NAME}}>::value,
                  "Singleton should delete its copy constructor");
    return 0;
}

int main() {
    test_singleton_identity();
    test_singleton_copy_deleted();
    return 0;
}
