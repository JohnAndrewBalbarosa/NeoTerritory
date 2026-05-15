// Test: external forward decl + inline method definition. If THIS passes,
// the upstream issue was that PIMPL classes typically only have
// declarations in the header — no inline definitions — and the analyzer
// drops them as "no work".
#include <memory>

class WidgetImpl;

class Widget {
    std::unique_ptr<WidgetImpl> impl_;
public:
    Widget() {}
    ~Widget() {}
    void render() {
        // inline body so the class is a "real" candidate
    }
};
