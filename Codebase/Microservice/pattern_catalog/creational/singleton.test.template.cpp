// Singleton — flexible test driver.
// Substitutions: {{HEADER}}, {{CLASS_NAME}}
//
// `if constexpr` only properly *discards* an unselected branch when it lives
// inside a function template — at non-template scope the discarded branch is
// still semantically checked, which is what produced the original
// "instance is not a member of ConfigSingleton" cascade. So we wrap all
// detection logic in run_tests<T>() and dispatch from main().

#include "{{HEADER}}"
#include "introspect.hpp"
#include <cassert>

template <typename T = {{CLASS_NAME}}>
static int run_tests() {
    static_assert(std::is_class_v<T>, "{{CLASS_NAME}} must be a class");

    // Structural: copy/assign deleted is the universal Singleton invariant.
    if constexpr (nt::singleton_copy_deleted<T>::value) {
        nt::emit_criterion("creational.singleton", "{{CLASS_NAME}}",
            "pass", "Copy constructor is deleted (single-ownership invariant holds).");
    } else {
        nt::emit_criterion("creational.singleton", "{{CLASS_NAME}}",
            "fail", "Copy constructor is NOT deleted; a Singleton should disable copying.");
    }

    // Behavioural: identity check via whichever static accessor exists.
    bool any = false;
    if constexpr (nt::has_static_instance<T>::value) {
        auto& a = T::instance();
        auto& b = T::instance();
        assert(&a == &b);
        nt::emit_criterion("creational.singleton", "{{CLASS_NAME}}", "pass",
            "instance() returns the same object on two consecutive calls.");
        any = true;
    } else if constexpr (nt::has_static_getInstance<T>::value) {
        auto& a = T::getInstance();
        auto& b = T::getInstance();
        assert(&a == &b);
        nt::emit_criterion("creational.singleton", "{{CLASS_NAME}}", "pass",
            "getInstance() returns the same object on two consecutive calls.");
        any = true;
    } else if constexpr (nt::has_static_sharedInstance<T>::value) {
        auto& a = T::sharedInstance();
        auto& b = T::sharedInstance();
        assert(&a == &b);
        nt::emit_criterion("creational.singleton", "{{CLASS_NAME}}", "pass",
            "sharedInstance() returns the same object on two consecutive calls.");
        any = true;
    } else if constexpr (nt::has_static_getDefault<T>::value) {
        auto& a = T::getDefault();
        auto& b = T::getDefault();
        assert(&a == &b);
        nt::emit_criterion("creational.singleton", "{{CLASS_NAME}}", "pass",
            "getDefault() returns the same object on two consecutive calls.");
        any = true;
    } else if constexpr (nt::has_static_get_instance<T>::value) {
        auto& a = T::get_instance();
        auto& b = T::get_instance();
        assert(&a == &b);
        nt::emit_criterion("creational.singleton", "{{CLASS_NAME}}", "pass",
            "get_instance() returns the same object on two consecutive calls.");
        any = true;
    } else if constexpr (nt::has_static_GetInstance<T>::value) {
        auto& a = T::GetInstance();
        auto& b = T::GetInstance();
        assert(&a == &b);
        nt::emit_criterion("creational.singleton", "{{CLASS_NAME}}", "pass",
            "GetInstance() returns the same object on two consecutive calls.");
        any = true;
    }
    if (!any) {
        nt::emit_criterion("creational.singleton", "{{CLASS_NAME}}", "skip",
            "No canonical accessor (instance/getInstance/sharedInstance/getDefault/...) found; identity check skipped.");
    }
    return 0;
}

int main() { return run_tests<>(); }
