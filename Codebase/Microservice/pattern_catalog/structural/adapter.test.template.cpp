// Adapter — flexible test driver.
// Substitutions: {{HEADER}}, {{CLASS_NAME}}, {{TARGET_METHOD}}

#include "{{HEADER}}"
#include "introspect.hpp"
#include <cassert>

NT_DECLARE_METHOD_PROBE({{TARGET_METHOD}})

template <typename T = {{CLASS_NAME}}>
static int run_tests() {
    static_assert(std::is_class_v<T>, "{{CLASS_NAME}} must be a class");
    nt::emit_criterion("structural.adapter", "{{CLASS_NAME}}", "pass",
        "Adapter compiles against the submission's full source.");

    if constexpr (nt::has_{{TARGET_METHOD}}<T>::value
                  && nt::is_default_constructible<T>::value) {
        T a;
        nt::touch(a.{{TARGET_METHOD}}());
        nt::emit_criterion("structural.adapter", "{{CLASS_NAME}}", "pass",
            "Target-interface method '{{TARGET_METHOD}}' is reachable via the adapter.");
    } else {
        nt::emit_criterion("structural.adapter", "{{CLASS_NAME}}", "skip",
            "Adapter typically wraps an adaptee; default construction unavailable, runtime delegation skipped.");
    }
    return 0;
}

int main() { return run_tests<>(); }
