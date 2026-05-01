// Decorator — flexible test driver.
// Substitutions: {{HEADER}}, {{CLASS_NAME}}, {{FORWARD_METHOD}}
//
// Structural family → we verify the class compiles with the user's full
// source (which is what brings the wrapped Component base into scope). The
// forwarding method's runtime behaviour is exercised only if the catalog
// detected its name and that method has a no-arg overload on the class —
// otherwise we silently skip rather than compile-error.

#include "{{HEADER}}"
#include "introspect.hpp"
#include <cassert>

NT_DECLARE_METHOD_PROBE({{FORWARD_METHOD}})

int main() {
    static_assert(std::is_class_v<{{CLASS_NAME}}>, "{{CLASS_NAME}} must be a class");

    // Compile-only structural check: a Decorator must be reachable as a
    // type. Construction may need an inner component arg, so we don't
    // attempt instantiation here without method introspection support.
    if constexpr (nt::has_{{FORWARD_METHOD}}<{{CLASS_NAME}}>::value
                  && nt::is_default_constructible<{{CLASS_NAME}}>::value) {
        {{CLASS_NAME}} d;
        nt::touch(d.{{FORWARD_METHOD}}());
    }
    return 0;
}
