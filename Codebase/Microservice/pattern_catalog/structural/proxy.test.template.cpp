// Pre-templated unit-test for the Proxy pattern.
// Substitutions: {{HEADER}}, {{CLASS_NAME}}, {{REAL_BASE}}, {{REQUEST_METHOD}}

#include "{{HEADER}}"
#include <cassert>
#include <memory>

struct __MockSubject : {{REAL_BASE}} {
    int* alive;
    bool* called;
    explicit __MockSubject(int* a, bool* c) : alive(a), called(c) { ++*alive; }
    ~__MockSubject() override { --*alive; }
    void {{REQUEST_METHOD}}() override { *called = true; }
};

// 1. Lazy-init / guarded forward: calling request on the proxy reaches the real subject.
static int test_proxy_forwards() {
    int alive = 0;
    bool called = false;
    {
        auto real = std::make_unique<__MockSubject>(&alive, &called);
        {{CLASS_NAME}} proxy(real.get());
        proxy.{{REQUEST_METHOD}}();
        assert(called);
    }
    assert(alive == 0);
    return 0;
}

int main() {
    test_proxy_forwards();
    return 0;
}
