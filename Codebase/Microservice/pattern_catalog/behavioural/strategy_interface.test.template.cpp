// Strategy (interface) — flexible test driver.
// Substitutions: {{HEADER}}, {{CLASS_NAME}}, {{TARGET_METHOD}}
//
// The "interface" half of Strategy: the abstract base that concrete
// strategies implement. We only verify that the type compiles and that the
// target method (when it's a non-virtual member that takes no args) is
// reachable. Polymorphic dispatch through derived classes is exercised by
// the strategy_concrete driver paired with this one.

#include "{{HEADER}}"
#include "introspect.hpp"
#include <cassert>

NT_DECLARE_METHOD_PROBE({{TARGET_METHOD}})

template <typename T = {{CLASS_NAME}}>
static int run_tests() {
    static_assert(std::is_class_v<T>, "{{CLASS_NAME}} must be a class");
    nt::emit_criterion("behavioural.strategy_interface", "{{CLASS_NAME}}", "pass",
        "Strategy interface type compiles and is visible to consumers.");

    if constexpr (std::is_abstract_v<T>) {
        nt::emit_criterion("behavioural.strategy_interface", "{{CLASS_NAME}}", "pass",
            "Type is abstract — pure-virtual surface enforces that callers go through a concrete strategy.");
    } else {
        nt::emit_criterion("behavioural.strategy_interface", "{{CLASS_NAME}}", "skip",
            "Type is concrete; if you intended it as an interface, mark its strategy method `= 0`.");
    }
    return 0;
}

int main() { return run_tests<>(); }
