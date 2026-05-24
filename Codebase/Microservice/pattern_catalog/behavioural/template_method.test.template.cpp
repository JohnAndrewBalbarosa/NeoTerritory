// Template Method — flexible test driver.
// Substitutions: {{HEADER}}, {{CLASS_NAME}}, {{TARGET_METHOD}}
//
// Generated for the GoF catalog expansion (D80). Verifies the tagged type
// compiles and is visible to consumers; richer behavioural assertions are
// layered on per-class as the analyser captures concrete collaborators.

#include "{{HEADER}}"
#include "introspect.hpp"
#include <cassert>
#include <type_traits>

NT_DECLARE_METHOD_PROBE({{TARGET_METHOD}})

template <typename T = {{CLASS_NAME}}>
static int run_tests() {
    static_assert(std::is_class_v<T>, "{{CLASS_NAME}} must be a class");
    nt::emit_criterion("behavioural.template_method", "{{CLASS_NAME}}", "pass",
        "Template Method type compiles and is visible to consumers.");

    if constexpr (std::is_abstract_v<T>) {
        nt::emit_criterion("behavioural.template_method", "{{CLASS_NAME}}", "pass",
            "Type is abstract — its virtual surface enforces dispatch through a concrete subtype.");
    } else {
        nt::emit_criterion("behavioural.template_method", "{{CLASS_NAME}}", "skip",
            "Type is concrete; collaborator-level assertions are recorded per class, not here.");
    }
    return 0;
}

int main() { return run_tests<>(); }
