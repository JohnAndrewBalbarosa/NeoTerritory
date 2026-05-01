// Decorator — flexible test driver.
// Substitutions: {{HEADER}}, {{CLASS_NAME}}, {{FORWARD_METHOD}}

#include "{{HEADER}}"
#include "introspect.hpp"
#include <cassert>

NT_DECLARE_METHOD_PROBE({{FORWARD_METHOD}})

template <typename T = {{CLASS_NAME}}>
static int run_tests() {
    static_assert(std::is_class_v<T>, "{{CLASS_NAME}} must be a class");
    nt::emit_criterion("structural.decorator", "{{CLASS_NAME}}", "pass",
        "Decorator class compiles against the submission's full source.");

    if constexpr (nt::has_{{FORWARD_METHOD}}<T>::value
                  && nt::is_default_constructible<T>::value) {
        T d;
        nt::touch(d.{{FORWARD_METHOD}}());
        nt::emit_criterion("structural.decorator", "{{CLASS_NAME}}", "pass",
            "Forwarding method '{{FORWARD_METHOD}}' is callable with no arguments.");
    } else {
        nt::emit_criterion("structural.decorator", "{{CLASS_NAME}}", "skip",
            "Decorator is not default-constructible (typically takes an inner Component); runtime forward-call skipped.");
    }
    return 0;
}

int main() { return run_tests<>(); }
