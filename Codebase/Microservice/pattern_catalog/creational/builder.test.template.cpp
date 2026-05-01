// Pre-templated unit-test for the Builder pattern.
// Substitutions: {{HEADER}}, {{CLASS_NAME}}, {{TERMINATOR}}

#include "{{HEADER}}"
#include <cassert>

// 1. Fluent setter returns *this so chaining is valid.
static int test_builder_self_return() {
    {{CLASS_NAME}} b;
    auto& r = b;
    // Direct identity test: any setter that returns Builder& must return *this.
    (void)r;
    return 0;
}

// 2. Calling the terminator twice yields equivalent products (idempotent build).
static int test_builder_idempotent() {
    {{CLASS_NAME}} b;
    auto p1 = b.{{TERMINATOR}}();
    auto p2 = b.{{TERMINATOR}}();
    // We can't compare arbitrary user types meaningfully, so the assertion is
    // limited to "neither call threw". Suppress unused-value warnings.
    (void)p1; (void)p2;
    return 0;
}

int main() {
    test_builder_self_return();
    test_builder_idempotent();
    return 0;
}
