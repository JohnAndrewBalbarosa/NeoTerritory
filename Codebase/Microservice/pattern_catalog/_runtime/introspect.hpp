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

namespace nt {

// ---- Method-name probes -----------------------------------------------------
//
// `nt::has_<NAME><T>::value` is true iff `T` has a member function named NAME
// callable with no arguments. We don't care about the return type.
//
// To detect a different signature, write your own probe inline in the driver
// (the pattern is short and unambiguous). For most pattern-relevant checks
// (zero-arg member call) this default is enough.

#define NT_DECLARE_METHOD_PROBE(NAME)                                          \
  template <typename T, typename = void>                                       \
  struct has_##NAME : std::false_type {};                                      \
  template <typename T>                                                        \
  struct has_##NAME<T,                                                         \
    std::void_t<decltype(std::declval<T&>().NAME())>>                          \
    : std::true_type {};

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
  template <typename T, typename = void>                                       \
  struct has_static_##NAME : std::false_type {};                               \
  template <typename T>                                                        \
  struct has_static_##NAME<T, std::void_t<decltype(T::NAME())>>                \
    : std::true_type {};

NT_DECLARE_STATIC_PROBE(instance)
NT_DECLARE_STATIC_PROBE(getInstance)
NT_DECLARE_STATIC_PROBE(get_instance)
NT_DECLARE_STATIC_PROBE(GetInstance)
NT_DECLARE_STATIC_PROBE(sharedInstance)
NT_DECLARE_STATIC_PROBE(getDefault)

// "Has any singleton-style static accessor" — the union of the canonical names.
template <typename T>
struct has_any_singleton_accessor :
  std::integral_constant<bool,
    has_static_instance<T>::value ||
    has_static_getInstance<T>::value ||
    has_static_get_instance<T>::value ||
    has_static_GetInstance<T>::value ||
    has_static_sharedInstance<T>::value ||
    has_static_getDefault<T>::value> {};

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

}  // namespace nt
