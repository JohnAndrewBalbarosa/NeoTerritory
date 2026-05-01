// Proxy — flexible test driver.
// Substitutions: {{HEADER}}, {{CLASS_NAME}}, {{REQUEST_METHOD}}

#include "{{HEADER}}"
#include "introspect.hpp"
#include <cassert>

NT_DECLARE_METHOD_PROBE({{REQUEST_METHOD}})

template <typename T = {{CLASS_NAME}}>
static int run_tests() {
    static_assert(std::is_class_v<T>, "{{CLASS_NAME}} must be a class");
    nt::emit_criterion("structural.proxy", "{{CLASS_NAME}}", "pass",
        "Proxy compiles against the submission's full source.");

    if constexpr (nt::has_{{REQUEST_METHOD}}<T>::value
                  && nt::is_default_constructible<T>::value) {
        T p;
        nt::touch(p.{{REQUEST_METHOD}}());
        nt::emit_criterion("structural.proxy", "{{CLASS_NAME}}", "pass",
            "Request method '{{REQUEST_METHOD}}' is reachable through the proxy with no arguments.");
    } else {
        nt::emit_criterion("structural.proxy", "{{CLASS_NAME}}", "skip",
            "Proxy typically holds a real-subject reference; default construction unavailable, runtime forward-call skipped.");
    }
    return 0;
}

int main() { return run_tests<>(); }
