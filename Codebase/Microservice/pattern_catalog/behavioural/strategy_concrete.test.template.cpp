// Strategy (concrete) — flexible test driver.
// Substitutions: {{HEADER}}, {{CLASS_NAME}}, {{TARGET_METHOD}}
//
// A concrete strategy implements the abstract base. We check it compiles,
// is NOT abstract, and (when the target method is a zero-arg member)
// exercise it once.

#include "{{HEADER}}"
#include "introspect.hpp"
#include <cassert>

NT_DECLARE_METHOD_PROBE({{TARGET_METHOD}})

template <typename T = {{CLASS_NAME}}>
static int run_tests() {
    static_assert(std::is_class_v<T>, "{{CLASS_NAME}} must be a class");

    if constexpr (std::is_abstract_v<T>) {
        nt::emit_criterion("behavioural.strategy_concrete", "{{CLASS_NAME}}", "fail",
            "Concrete strategy is still abstract — at least one inherited pure-virtual is unimplemented.");
    } else {
        nt::emit_criterion("behavioural.strategy_concrete", "{{CLASS_NAME}}", "pass",
            "Concrete strategy implements every required virtual; instantiation is allowed.");
    }

    if constexpr (nt::is_default_constructible<T>::value
                  && nt::has_{{TARGET_METHOD}}<T>::value
                  && !std::is_abstract_v<T>) {
        T s;
        (void)(s.{{TARGET_METHOD}}());
        nt::emit_criterion("behavioural.strategy_concrete", "{{CLASS_NAME}}", "pass",
            "Target method '{{TARGET_METHOD}}' is callable on a default-constructed concrete strategy.");
    } else {
        nt::emit_criterion("behavioural.strategy_concrete", "{{CLASS_NAME}}", "skip",
            "Target method '{{TARGET_METHOD}}' could not be exercised (missing, requires args, or class not default-constructible).");
    }
    return 0;
}

int main() { return run_tests<>(); }
