// Factory — flexible test driver.
// Substitutions: {{HEADER}}, {{CLASS_NAME}}, {{FACTORY_FN}}

#include "{{HEADER}}"
#include "introspect.hpp"
#include <cassert>

NT_DECLARE_METHOD_PROBE({{FACTORY_FN}})

template <typename T = {{CLASS_NAME}}>
static int run_tests() {
    static_assert(std::is_class_v<T>, "{{CLASS_NAME}} must be a class");

    if constexpr (nt::is_default_constructible<T>::value) {
        nt::emit_criterion("creational.factory", "{{CLASS_NAME}}", "pass",
            "Factory is default-constructible.");
        T f;
        if constexpr (nt::has_{{FACTORY_FN}}<T>::value) {
            (void)(f.{{FACTORY_FN}}());
            nt::emit_criterion("creational.factory", "{{CLASS_NAME}}", "pass",
                "Factory method '{{FACTORY_FN}}' is callable with no arguments and produced a value.");
        } else {
            nt::emit_criterion("creational.factory", "{{CLASS_NAME}}", "skip",
                "Factory method '{{FACTORY_FN}}' either doesn't exist or requires arguments; runtime exercise skipped.");
        }
    } else {
        nt::emit_criterion("creational.factory", "{{CLASS_NAME}}", "skip",
            "Factory is not default-constructible; cannot exercise factory method.");
    }
    return 0;
}

int main() { return run_tests<>(); }
