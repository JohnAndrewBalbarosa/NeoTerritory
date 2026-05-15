// Test: same outer class as 01-classic-widget but WITHOUT the
// `class WidgetImpl;` forward decl line. If this passes but 01 fails,
// confirms the forward-decl line is what breaks upstream parsing.
#include <memory>

class Widget {
    std::unique_ptr<int> impl_;
public:
    Widget();
    ~Widget();
    void render();
};
