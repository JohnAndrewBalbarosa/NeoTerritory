// Singleton — flexible test driver.
// Substitutions: {{HEADER}}, {{CLASS_NAME}}
//
// Creational family → we verify the class genuinely owns a single instance.
// We accept any of the canonical accessor names (instance / getInstance /
// sharedInstance / getDefault). The address-equality assertion runs against
// whichever accessor is present; copy-deletion is checked unconditionally.

#include "{{HEADER}}"
#include "introspect.hpp"
#include <cassert>

int main() {
    static_assert(std::is_class_v<{{CLASS_NAME}}>, "{{CLASS_NAME}} must be a class");

    // Structural: copy/assign deleted is the universal Singleton invariant.
    static_assert(nt::singleton_copy_deleted<{{CLASS_NAME}}>::value,
                  "{{CLASS_NAME}} should delete its copy constructor");

    // Behavioural: identity check via whichever static accessor exists.
    if constexpr (nt::has_static_instance<{{CLASS_NAME}}>::value) {
        auto& a = {{CLASS_NAME}}::instance();
        auto& b = {{CLASS_NAME}}::instance();
        assert(&a == &b);
    } else if constexpr (nt::has_static_getInstance<{{CLASS_NAME}}>::value) {
        auto& a = {{CLASS_NAME}}::getInstance();
        auto& b = {{CLASS_NAME}}::getInstance();
        assert(&a == &b);
    } else if constexpr (nt::has_static_sharedInstance<{{CLASS_NAME}}>::value) {
        auto& a = {{CLASS_NAME}}::sharedInstance();
        auto& b = {{CLASS_NAME}}::sharedInstance();
        assert(&a == &b);
    } else if constexpr (nt::has_static_getDefault<{{CLASS_NAME}}>::value) {
        auto& a = {{CLASS_NAME}}::getDefault();
        auto& b = {{CLASS_NAME}}::getDefault();
        assert(&a == &b);
    } else if constexpr (nt::has_static_get_instance<{{CLASS_NAME}}>::value) {
        auto& a = {{CLASS_NAME}}::get_instance();
        auto& b = {{CLASS_NAME}}::get_instance();
        assert(&a == &b);
    } else if constexpr (nt::has_static_GetInstance<{{CLASS_NAME}}>::value) {
        auto& a = {{CLASS_NAME}}::GetInstance();
        auto& b = {{CLASS_NAME}}::GetInstance();
        assert(&a == &b);
    }
    // If no accessor matched any canonical name, we leave it to the
    // structural copy-deletion check above to carry the verdict.

    return 0;
}
