// Builder — flexible test driver.
// Substitutions: {{HEADER}}, {{CLASS_NAME}}
//
// We deliberately do NOT splice {{TERMINATOR}} into nt::has_* / b.* below.
// The analyzer can hand back any method name (e.g. "assemble"); probing
// nt::has_<that-name> blows up when we never declared it, and declaring it
// via NT_DECLARE_METHOD_PROBE collides with the canonical five probes
// (redefinition of struct has_build / has_finalize / ...). The canonical
// fallback chain below already covers every Builder shape we care about.

#include "{{HEADER}}"
#include "introspect.hpp"
#include <cassert>

NT_DECLARE_METHOD_PROBE(build)
NT_DECLARE_METHOD_PROBE(finalize)
NT_DECLARE_METHOD_PROBE(done)
NT_DECLARE_METHOD_PROBE(complete)
NT_DECLARE_METHOD_PROBE(produce)

template <typename T = {{CLASS_NAME}}>
static int run_tests() {
    static_assert(std::is_class_v<T>, "{{CLASS_NAME}} must be a class");

    if constexpr (nt::is_default_constructible<T>::value) {
        nt::emit_criterion("creational.builder", "{{CLASS_NAME}}", "pass",
            "Builder is default-constructible (a fresh builder can be created).");
        T b;
        bool exercised = false;
        if constexpr (nt::has_build<T>::value) {
            (void)(b.build());
            nt::emit_criterion("creational.builder", "{{CLASS_NAME}}", "pass",
                "Builder exposes build() — the canonical terminator.");
            exercised = true;
        } else if constexpr (nt::has_finalize<T>::value) {
            (void)(b.finalize());
            nt::emit_criterion("creational.builder", "{{CLASS_NAME}}", "pass",
                "Builder exposes finalize() as its terminator.");
            exercised = true;
        } else if constexpr (nt::has_done<T>::value) {
            (void)(b.done());
            nt::emit_criterion("creational.builder", "{{CLASS_NAME}}", "pass",
                "Builder exposes done() as its terminator.");
            exercised = true;
        } else if constexpr (nt::has_complete<T>::value) {
            (void)(b.complete());
            nt::emit_criterion("creational.builder", "{{CLASS_NAME}}", "pass",
                "Builder exposes complete() as its terminator.");
            exercised = true;
        } else if constexpr (nt::has_produce<T>::value) {
            (void)(b.produce());
            nt::emit_criterion("creational.builder", "{{CLASS_NAME}}", "pass",
                "Builder exposes produce() as its terminator.");
            exercised = true;
        }
        if (!exercised) {
            nt::emit_criterion("creational.builder", "{{CLASS_NAME}}", "skip",
                "No zero-arg terminator (build/finalize/done/complete/produce) found.");
        }
    } else {
        nt::emit_criterion("creational.builder", "{{CLASS_NAME}}", "skip",
            "Builder is not default-constructible; cannot exercise terminator methods.");
    }
    return 0;
}

int main() { return run_tests<>(); }
