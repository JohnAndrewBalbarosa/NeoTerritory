// Pre-templated unit-test for the Adapter pattern.
// Substitutions: {{HEADER}}, {{CLASS_NAME}}, {{TARGET_BASE}}, {{TARGET_METHOD}}

#include "{{HEADER}}"
#include <cassert>
#include <memory>

struct __MockAdaptee {
    int* alive;
    bool called = false;
    explicit __MockAdaptee(int* a) : alive(a) { ++*alive; }
    ~__MockAdaptee() { --*alive; }
    void run() { called = true; }
};

// 1. Adapter overrides the target interface; calling the target method on
//    an Adapter reference reaches the adaptee.
static int test_adapter_translates() {
    int alive = 0;
    auto adaptee = std::make_unique<__MockAdaptee>(&alive);
    {{CLASS_NAME}} adapter(adaptee.get());
    static_cast<{{TARGET_BASE}}&>(adapter).{{TARGET_METHOD}}();
    assert(adaptee->called);
    return 0;
}

int main() {
    test_adapter_translates();
    return 0;
}
