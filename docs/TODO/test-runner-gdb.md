# TODO — Pre-templated unit tests + GDB Runner tab

Deferred from the round on `2026-05-XX`. The user asked for a "GDB Runner"
tab that compiles the user's submitted C++ code together with pre-templated
unit tests authored per design pattern, executes the binary under GDB, and
shows expected vs actual output, line-numbered failures, and graceful-exit
diagnostics for ctor/dtor allocation parity and dangling pointers.

## Why deferred

Compiling and running user-supplied C++ is a remote-code-execution surface.
The current backend has no isolation boundary around `child_process.spawn`.
Shipping this without a sandbox risks turning the studio into an attacker's
shell. This needs proper isolation (Docker-in-Docker, `firejail`, or
`bubblewrap`) before it can land.

## Architecture

### Per-pattern test templates

Each catalog entry gets a sibling `*.test.template.cpp` file:

```
Codebase/Microservice/pattern_catalog/
├── structural/
│   ├── decorator.json
│   ├── decorator.test.template.cpp     ← new
│   ├── proxy.json
│   ├── proxy.test.template.cpp         ← new
│   └── ...
├── creational/
│   ├── factory.json
│   ├── factory.test.template.cpp       ← new
│   └── ...
```

Templates use placeholders the backend fills with the user's actual
`className` and `unitTestTargets[*].function_name`:

```cpp
// decorator.test.template.cpp
#include "{{HEADER}}"
#include <cassert>
#include <memory>

// Allocation-parity test: verify ctor/dtor are balanced under wrap.
TEST_CASE("{{CLASS_NAME}} ctor/dtor parity") {
    int alive = 0;
    {
        auto inner = std::make_unique<MockComponent>(&alive);
        auto wrapped = std::make_unique<{{CLASS_NAME}}>(inner.get());
        ASSERT_EQ(alive, 1);  // inner alive, wrapper does not double-allocate
    }
    ASSERT_EQ(alive, 0);  // dtor cascade frees inner
}

TEST_CASE("{{CLASS_NAME}} delegates {{FORWARDED_METHOD}}") {
    MockComponent mock{nullptr};
    {{CLASS_NAME}} wrapper(&mock);
    wrapper.{{FORWARDED_METHOD}}();
    ASSERT_TRUE(mock.was_called());
}
```

The placeholders to support:
- `{{CLASS_NAME}}` — `pattern.className`
- `{{HEADER}}` — `pattern.fileName` (or generated header path)
- `{{FORWARDED_METHOD}}` — first hit from `evidence.callsites` for the
  template's relevant signal id

### Pattern-relevant test categories

| Pattern family | Pre-templated checks |
|---|---|
| Decorator / Adapter / Proxy | ctor/dtor allocation parity, virtual-method polymorphic dispatch, no double-free, forwarding behaviour |
| Factory | branched return types match, no leaked product on exception path |
| Builder / Method Chaining | idempotent build (build twice → equal products), fluent self-return |
| Singleton | same instance on N calls, copy/assign deleted (compile-time test) |
| Observer | subscribers receive emitted events; no UAF after unsubscribe |
| Strategy | swap policy at runtime; algorithm output differs accordingly |

Each template also enforces graceful-exit assertions:
- No segfault under a 5-second wallclock cap.
- No memory leaks reported by `valgrind --leak-check=full` (or ASAN).
- No dangling pointers in destructor traces.

### Backend route

```
POST /api/analysis/:runId/run-tests
  body: {}                 (optional: which pattern subset to run)
  →  { results: TestResult[] }

interface TestResult {
  patternId: string;
  className: string;
  passed: boolean;
  expected: string;
  actual: string;
  gdb?: string;          // backtrace if abort/segfault
  exitCode: number;
  durationMs: number;
  verdict: 'pass' | 'fail' | 'timeout' | 'segfault' | 'leak' | 'compile_error';
  failingLine?: number;  // resolved via addr2line when a binary aborts
  message?: string;      // single-line summary for the row
}
```

### Sandbox

Run inside a one-shot container per analysis run:
- `docker run --rm --network none --cpus 1 --memory 256m --read-only --tmpfs /work:rw -v <run_dir>:/src:ro neoterritory-runner` — readonly source mount, writable tmpfs scratch, no network, hard CPU/memory caps.
- The runner image bundles `g++`, `gdb`, `addr2line`, `valgrind`, and a
  small driver that compiles `<sources>` + the filled template, runs the
  binary under GDB with `-batch`, and emits one `TestResult` per template.

### Frontend

New top-level tab `GDB Runner` between *Annotated Source* and *Review*:

```
Submit | Annotated Source | GDB Runner | Review before submission
```

Layout:
- One row per detected pattern × test case.
- Status pill: pass (green), fail (red), timeout/segfault/leak (amber).
- Expand each row → `expected | actual | gdb output` panes side-by-side.
- "Re-run" button per row + "Run all" at the top.
- Graceful empty state when the runner is offline ("Sandbox not configured;
  see docs/TODO/test-runner-gdb.md").

### Reuse of existing types

- `unitTestTargets[*].function_hash` already keys per-function notes; the
  test runner emits one `TestResult` per `function_hash` so frontend rows
  link straight back to the source line via existing `onLineFlash`.
- `unitTestPlanByTarget` from the AI result already provides a human-
  readable expectation; render it as the "expected" pane when the template
  doesn't supply a static expected string.

## Acceptance

- Submit a Decorator class and trigger Run all. Backend compiles + runs
  inside the sandbox; frontend shows one `pass` row for "ctor/dtor parity"
  and one `pass` row for "delegates read".
- Submit a class with an intentional double-free; runner returns `verdict:
  'segfault'`, the `gdb` pane shows the backtrace, and the failing line is
  highlighted in Annotated Source.
- Submit code that won't compile; runner returns `verdict: 'compile_error'`
  with the compiler stderr in `actual`.

## Files likely to change

| Layer | File |
|---|---|
| Templates | `Codebase/Microservice/pattern_catalog/<family>/<pattern>.test.template.cpp` (new, one per pattern) |
| Sandbox image | `Codebase/Infrastructure/runner/Dockerfile` (new) |
| Driver script | `Codebase/Infrastructure/runner/run-tests.sh` (new) |
| BE route | `Codebase/Backend/src/routes/analysis.ts` (`POST /:runId/run-tests`) |
| BE service | `Codebase/Backend/src/services/testRunnerService.ts` (new) |
| FE tab | `Codebase/Frontend/src/components/tabs/GdbRunnerTab.tsx` (new) |
| FE wiring | `Codebase/Frontend/src/components/layout/MainLayout.tsx` (add tab id) |
| FE types | `Codebase/Frontend/src/types/api.ts` (TestResult interface) |

## Existing utilities to reuse

- `unitTestTargets` already populated by the microservice — no new
  collection step needed.
- `aiDocumentationService.unitTestPlanByTarget` already provides per-target
  expectation text — wire as the default "expected" pane.
- `aiJobs` ephemeral cache pattern in `analysis.ts:131-143` — copy the same
  pattern for `testJobs` so the frontend can poll without holding a long
  HTTP connection during compile+run.
