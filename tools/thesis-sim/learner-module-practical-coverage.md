# Learning Module Practical Coverage

_Generated 2026-05-16T00:37:21.260Z from `Codebase/Frontend/src/data/learningModules.ts` and `Codebase/Frontend/src/components/marketing/patterns/patternData.ts`._

Every module in the linear-unlock chain must declare a `practical` (quiz or pattern code-check). A missing practical silently locks every module after it because `PatternsLearnPage:computeUnlockedCount` requires `completedIds.has(modules[i-1].id)` and that flag is only set when the practical passes.

## Foundations modules

| Module ID | Practical kind | Source |
|---|---|---|
| `foundations-what-is-pattern` | quiz | FOUNDATIONS_QUIZZES |
| `foundations-why-matters` | quiz | FOUNDATIONS_QUIZZES |
| `foundations-categories` | quiz | FOUNDATIONS_QUIZZES |
| `foundations-oop` | quiz | FOUNDATIONS_QUIZZES |
| `foundations-interface-principle` | quiz | FOUNDATIONS_QUIZZES |
| `foundations-code-structure` | quiz | FOUNDATIONS_QUIZZES |
| `foundations-real-software` | quiz | FOUNDATIONS_QUIZZES |
| `foundations-beginner-mistakes` | quiz | FOUNDATIONS_QUIZZES |
| `foundations-ambiguity` | quiz | FOUNDATIONS_QUIZZES |
| `foundations-connotative-definition` | quiz | FOUNDATIONS_QUIZZES |
| `foundations-structural-rules` | quiz | FOUNDATIONS_QUIZZES |
| `foundations-context-variation` | quiz | FOUNDATIONS_QUIZZES |
| `foundations-postrequisite` | quiz | FOUNDATIONS_QUIZZES |

## Pattern modules

| Pattern slug | Module ID | Family | Practical kind | Source |
|---|---|---|---|---|
| singleton | `creational-singleton` | Creational | pattern | DETECTED_PATTERN_SLUGS (slug=singleton) |
| factory-method | `creational-factory-method` | Creational | pattern | DETECTED_PATTERN_SLUGS (slug=factory) |
| builder | `creational-builder` | Creational | pattern | DETECTED_PATTERN_SLUGS (slug=builder) |
| method-chaining | `behavioural-method-chaining` | Behavioural | pattern | DETECTED_PATTERN_SLUGS (slug=method-chaining) |
| adapter | `structural-adapter` | Structural | pattern | DETECTED_PATTERN_SLUGS (slug=adapter) |
| proxy | `structural-proxy` | Structural | pattern | DETECTED_PATTERN_SLUGS (slug=proxy) |
| decorator | `structural-decorator` | Structural | pattern | DETECTED_PATTERN_SLUGS (slug=decorator) |
| strategy | `behavioural-strategy` | Behavioural | pattern | DETECTED_PATTERN_SLUGS (slug=strategyinterface) |
| observer | `behavioural-observer` | Behavioural | quiz | NON_DETECTED_QUIZZES |
| iterator | `behavioural-iterator` | Behavioural | quiz | NON_DETECTED_QUIZZES |
| command | `behavioural-command` | Behavioural | quiz | NON_DETECTED_QUIZZES |
| composite | `structural-composite` | Structural | quiz | NON_DETECTED_QUIZZES |
| template-method | `behavioural-template-method` | Behavioural | quiz | NON_DETECTED_QUIZZES |
| state | `behavioural-state` | Behavioural | quiz | NON_DETECTED_QUIZZES |
| repository | `structural-repository` | Structural | quiz | NON_DETECTED_QUIZZES |
| pimpl | `idioms-pimpl` | Idioms | pattern | DETECTED_PATTERN_SLUGS (slug=pimpl) |

## Coverage summary

- Foundations modules without a practical: **0** of 13
- Pattern modules without a practical: **0** of 16

**Verdict: all pattern modules have a practical configured.** The linear unlock chain is unbroken.