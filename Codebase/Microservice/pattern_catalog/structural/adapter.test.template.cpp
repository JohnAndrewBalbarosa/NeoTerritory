// Adapter — flexible test driver.
// Substitutions: {{HEADER}}, {{CLASS_NAME}}, {{TARGET_METHOD}}
//
// Structural family → adapter exposes a target-interface method that
// delegates to its adaptee. We can't safely fake the adaptee here (it's
// user-specific), so we only check that the catalog-detected target method
// exists and is callable with no args.

#include "{{HEADER}}"
#include "introspect.hpp"
#include <cassert>

NT_DECLARE_METHOD_PROBE({{TARGET_METHOD}})

int main() {
    static_assert(std::is_class_v<{{CLASS_NAME}}>, "{{CLASS_NAME}} must be a class");

    if constexpr (nt::has_{{TARGET_METHOD}}<{{CLASS_NAME}}>::value
                  && nt::is_default_constructible<{{CLASS_NAME}}>::value) {
        {{CLASS_NAME}} a;
        nt::touch(a.{{TARGET_METHOD}}());
    }
    return 0;
}
