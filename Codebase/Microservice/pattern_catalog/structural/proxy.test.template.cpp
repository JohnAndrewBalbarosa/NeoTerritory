// Proxy — flexible test driver.
// Substitutions: {{HEADER}}, {{CLASS_NAME}}, {{REQUEST_METHOD}}
//
// Structural family → same shape as Decorator: the user's full source brings
// the real-subject type into scope. The forwarding-call assertion is gated
// on the request method existing as a no-arg member.

#include "{{HEADER}}"
#include "introspect.hpp"
#include <cassert>

NT_DECLARE_METHOD_PROBE({{REQUEST_METHOD}})

int main() {
    static_assert(std::is_class_v<{{CLASS_NAME}}>, "{{CLASS_NAME}} must be a class");

    if constexpr (nt::has_{{REQUEST_METHOD}}<{{CLASS_NAME}}>::value
                  && nt::is_default_constructible<{{CLASS_NAME}}>::value) {
        {{CLASS_NAME}} p;
        nt::touch(p.{{REQUEST_METHOD}}());
    }
    return 0;
}
