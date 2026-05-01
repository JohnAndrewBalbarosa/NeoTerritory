// Pre-templated unit-test for the Decorator pattern.
// Substitutions: {{HEADER}}, {{CLASS_NAME}}, {{COMPONENT_BASE}}, {{FORWARD_METHOD}}

#include "{{HEADER}}"
#include <cassert>
#include <memory>

// A minimal stand-in for the wrapped component. Counts ctor/dtor invocations
// so we can verify the decorator does not leak the inner object.
struct __MockComponent : {{COMPONENT_BASE}} {
    int* alive;
    explicit __MockComponent(int* a) : alive(a) { ++*alive; }
    ~__MockComponent() override { --*alive; }
    // The user's interface may declare other methods; this stub only needs
    // {{FORWARD_METHOD}} to participate in the dispatch test.
    void {{FORWARD_METHOD}}() override { /* no-op */ }
};

// 1. Allocation parity: wrapper's destructor releases the inner component.
static int test_decorator_dtor_parity() {
    int alive = 0;
    {
        auto inner = std::make_unique<__MockComponent>(&alive);
        {
            {{CLASS_NAME}} wrapper(inner.get());
            assert(alive == 1);
        }
        // The wrapper dtor must NOT delete the inner pointer (it doesn't own it).
        assert(alive == 1);
    }
    assert(alive == 0);
    return 0;
}

// 2. Forwarding behaviour: calling the wrapper's method invokes the inner.
static int test_decorator_forwarding() {
    int alive = 0;
    auto inner = std::make_unique<__MockComponent>(&alive);
    {{CLASS_NAME}} wrapper(inner.get());
    wrapper.{{FORWARD_METHOD}}();
    return 0;
}

int main() {
    test_decorator_dtor_parity();
    test_decorator_forwarding();
    return 0;
}
