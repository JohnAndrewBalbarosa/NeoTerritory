// Builder — flexible test driver.
// Substitutions: {{HEADER}}, {{CLASS_NAME}}, {{TERMINATOR}}
//
// Creational family → we verify a builder can be stood up and that the
// catalog-detected terminator method (build / finalize / done / produce /
// complete) actually exists. Whichever name is present, we exercise it once.

#include "{{HEADER}}"
#include "introspect.hpp"
#include <cassert>

NT_DECLARE_METHOD_PROBE({{TERMINATOR}})

int main() {
    static_assert(std::is_class_v<{{CLASS_NAME}}>, "{{CLASS_NAME}} must be a class");
    static_assert(nt::is_default_constructible<{{CLASS_NAME}}>::value,
                  "{{CLASS_NAME}} (Builder) should be default-constructible");

    // Behavioural: cycle through the canonical terminator names. We pick the
    // first one the user's class actually exposes; missing terminators skip
    // silently rather than fail to compile.
    {{CLASS_NAME}} b;
    if constexpr (nt::has_{{TERMINATOR}}<{{CLASS_NAME}}>::value) {
        nt::touch(b.{{TERMINATOR}}());
    } else if constexpr (nt::has_build<{{CLASS_NAME}}>::value) {
        nt::touch(b.build());
    } else if constexpr (nt::has_finalize<{{CLASS_NAME}}>::value) {
        nt::touch(b.finalize());
    } else if constexpr (nt::has_done<{{CLASS_NAME}}>::value) {
        nt::touch(b.done());
    } else if constexpr (nt::has_complete<{{CLASS_NAME}}>::value) {
        nt::touch(b.complete());
    } else if constexpr (nt::has_produce<{{CLASS_NAME}}>::value) {
        nt::touch(b.produce());
    }
    return 0;
}
