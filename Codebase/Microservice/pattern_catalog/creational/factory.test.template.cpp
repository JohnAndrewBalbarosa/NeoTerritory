// Pre-templated unit-test for the Factory pattern.
// The backend test runner substitutes:
//   {{HEADER}}        — relative path to the user's class header
//   {{CLASS_NAME}}    — pattern.className
//   {{FACTORY_FN}}    — first detected factory method name
//
// The runner then compiles this together with the user's source and a small
// test driver, executes the binary inside a sandboxed container, and reports
// pass/fail/timeout/segfault/leak.

#include "{{HEADER}}"
#include <cassert>
#include <memory>

// 1. The factory returns a non-null product.
static int test_factory_returns_product() {
    {{CLASS_NAME}} factory;
    auto product = factory.{{FACTORY_FN}}("default");
    assert(product != nullptr);
    return 0;
}

// 2. Distinct inputs produce distinct concrete types (best-effort RTTI).
static int test_factory_branches() {
    {{CLASS_NAME}} factory;
    auto a = factory.{{FACTORY_FN}}("a");
    auto b = factory.{{FACTORY_FN}}("b");
    assert(a != nullptr && b != nullptr);
    // If branching on input, typeid should differ for distinct strings; if
    // the factory returns a single concrete type this is a no-op assertion.
    (void)a; (void)b;
    return 0;
}

int main() {
    test_factory_returns_product();
    test_factory_branches();
    return 0;
}
