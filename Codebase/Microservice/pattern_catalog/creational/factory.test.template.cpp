// Factory — flexible test driver.
// Substitutions: {{HEADER}}, {{CLASS_NAME}}, {{FACTORY_FN}}
//
// Creational family → we test that *the class can produce something*. The
// factory method name is best-effort substituted; if it doesn't exist on the
// user's class, we still pass the structural assertions (default-constructible
// factory) and skip the runtime invocation via `if constexpr`.

#include "{{HEADER}}"
#include "introspect.hpp"
#include <cassert>

NT_DECLARE_METHOD_PROBE({{FACTORY_FN}})

int main() {
    static_assert(std::is_class_v<{{CLASS_NAME}}>, "{{CLASS_NAME}} must be a class");

    // Structural: a factory should be default-constructible so callers can
    // stand one up cheaply.
    static_assert(nt::is_default_constructible<{{CLASS_NAME}}>::value,
                  "{{CLASS_NAME}} should be default-constructible");

    // Behavioural: if the catalog-detected factory method exists with no
    // args, just exercise it once. Many factories require arguments — those
    // get exercised by the AI-generated unit-test plan, not this driver.
    if constexpr (nt::has_{{FACTORY_FN}}<{{CLASS_NAME}}>::value) {
        {{CLASS_NAME}} f;
        nt::touch(f.{{FACTORY_FN}}());
    }
    return 0;
}
