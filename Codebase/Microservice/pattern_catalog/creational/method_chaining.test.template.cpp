// Method Chaining — flexible test driver.
// Substitutions: {{HEADER}}, {{CLASS_NAME}}

#include "{{HEADER}}"
#include "introspect.hpp"
#include <cassert>

template <typename T = {{CLASS_NAME}}>
static int run_tests() {
    static_assert(std::is_class_v<T>, "{{CLASS_NAME}} must be a class");
    if constexpr (nt::is_default_constructible<T>::value) {
        T c;
        nt::touch(c);
        nt::emit_criterion("creational.method_chaining", "{{CLASS_NAME}}", "pass",
            "Class is default-constructible — a chain can begin from a fresh instance.");
    } else {
        nt::emit_criterion("creational.method_chaining", "{{CLASS_NAME}}", "skip",
            "Class is not default-constructible; chain entry-point check skipped.");
    }
    return 0;
}

int main() { return run_tests<>(); }
