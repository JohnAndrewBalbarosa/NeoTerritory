// NeoTerritory test-runner introspection middleman.
//
// SFINAE-based compile-time member detection. Templates probe the user's
// class for methods/static accessors that match the pattern's expected
// surface; missing surface becomes a compile-time skip (`if constexpr`),
// not a compile error. This is the parser-as-template-metaprogram the
// runner uses so test drivers stay flexible across arbitrary user code.

#pragma once
#include <type_traits>
#include <utility>
#include <cstdio>

// ---- Method-name probes -----------------------------------------------------
//
// `nt::has_<NAME><T>::value` is true iff `T` has a member function named NAME
// callable with no arguments. We don't care about the return type.
//
// To detect a different signature, write your own probe inline in the driver
// (the pattern is short and unambiguous). For most pattern-relevant checks
// (zero-arg member call) this default is enough.

// NB: this macro is invoked from driver.cpp at file scope (outside any
// namespace), so the trait declarations MUST inject themselves back into
// `namespace nt`. Otherwise drivers that say `nt::has_<NAME>` fail with
// "is not a member of 'nt'", which is exactly the pre-fix bug.
#define NT_DECLARE_METHOD_PROBE(NAME)                                          \
  namespace nt {                                                               \
  template <typename T, typename = void>                                       \
  struct has_##NAME : std::false_type {};                                      \
  template <typename T>                                                        \
  struct has_##NAME<T,                                                         \
    std::void_t<decltype(std::declval<T&>().NAME())>>                          \
    : std::true_type {};                                                       \
  }

NT_DECLARE_METHOD_PROBE(build)
NT_DECLARE_METHOD_PROBE(finalize)
NT_DECLARE_METHOD_PROBE(done)
NT_DECLARE_METHOD_PROBE(complete)
NT_DECLARE_METHOD_PROBE(produce)
NT_DECLARE_METHOD_PROBE(read)
NT_DECLARE_METHOD_PROBE(write)
NT_DECLARE_METHOD_PROBE(request)
NT_DECLARE_METHOD_PROBE(execute)
NT_DECLARE_METHOD_PROBE(run)
NT_DECLARE_METHOD_PROBE(handle)
NT_DECLARE_METHOD_PROBE(process)
NT_DECLARE_METHOD_PROBE(perform)
NT_DECLARE_METHOD_PROBE(operate)
NT_DECLARE_METHOD_PROBE(get)
NT_DECLARE_METHOD_PROBE(load)

// ---- Static-accessor probes -------------------------------------------------
//
// True iff `T::NAME()` exists and (likely) returns a reference/pointer to T.
// We accept any return type — the caller decides whether the address
// equality test is meaningful for their accessor.

#define NT_DECLARE_STATIC_PROBE(NAME)                                          \
  namespace nt {                                                               \
  template <typename T, typename = void>                                       \
  struct has_static_##NAME : std::false_type {};                               \
  template <typename T>                                                        \
  struct has_static_##NAME<T, std::void_t<decltype(T::NAME())>>                \
    : std::true_type {};                                                       \
  }

NT_DECLARE_STATIC_PROBE(instance)
NT_DECLARE_STATIC_PROBE(getInstance)
NT_DECLARE_STATIC_PROBE(get_instance)
NT_DECLARE_STATIC_PROBE(GetInstance)
NT_DECLARE_STATIC_PROBE(sharedInstance)
NT_DECLARE_STATIC_PROBE(getDefault)

// ---- Non-macro helpers (explicitly inside namespace nt) ---------------------
//
// These are kept in their own `namespace nt { ... }` block at the bottom of
// the file. The probe macros above self-inject into `namespace nt` from
// global scope; if we ALSO wrap this file in an outer `namespace nt`, the
// macros end up declaring `nt::nt::has_*`, and the helpers below — written
// as `has_static_instance<T>` — fail to resolve. So we keep this block
// disjoint from the macro invocations and reach the macro-declared traits
// via fully-qualified `nt::has_static_*` names.
namespace nt {

// "Has any singleton-style static accessor" — the union of the canonical names.
template <typename T>
struct has_any_singleton_accessor :
  std::integral_constant<bool,
    nt::has_static_instance<T>::value ||
    nt::has_static_getInstance<T>::value ||
    nt::has_static_get_instance<T>::value ||
    nt::has_static_GetInstance<T>::value ||
    nt::has_static_sharedInstance<T>::value ||
    nt::has_static_getDefault<T>::value> {};

// ---- Type-shape probes ------------------------------------------------------

template <typename T>
struct singleton_copy_deleted :
  std::integral_constant<bool, !std::is_copy_constructible<T>::value> {};

template <typename T>
struct is_default_constructible :
  std::is_default_constructible<T> {};

// ---- Helpers ----------------------------------------------------------------

// Soft-evaluate an arbitrary expression at runtime — a no-op wrapper that
// templates can stick around any expression to silence "unused" warnings
// when an `if constexpr` body is just exercising compilation.
template <typename T>
inline void touch(T&& v) noexcept { (void)v; }

// Print a CRITERIA line in a fixed format the backend can parse out of
// stdout. Each test driver streams one or more of these so the unit-test
// result panel can show plain-English criteria with pass/skip status,
// rather than just a raw "binary exited 0".
//
// Format: `NT_CRITERION pattern_id|class_name|status|description`
//   status ∈ {pass, skip, fail}
inline void emit_criterion(const char* pattern, const char* className,
                           const char* status, const char* description) {
  std::printf("NT_CRITERION %s|%s|%s|%s\n", pattern, className, status, description);
}

}  // namespace nt
