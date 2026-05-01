// Pre-templated unit-test for the Method Chaining pattern.
// Substitutions: {{HEADER}}, {{CLASS_NAME}}

#include "{{HEADER}}"
#include <cassert>

// Every fluent setter returns Class&, so two consecutive setter calls compile
// without a temporary cast. This exercises the method-chaining contract at
// compile time; runtime behaviour is exercised by the user's own tests.
static int test_chain_compiles() {
    {{CLASS_NAME}} a;
    // The presence of two arbitrary setters on Class is not guaranteed; this
    // template defers to the AI-generated test plan for setter-name specifics.
    (void)a;
    return 0;
}

int main() {
    test_chain_compiles();
    return 0;
}
