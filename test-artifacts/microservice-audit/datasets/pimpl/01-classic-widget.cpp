#include <memory>

class WidgetImpl;

class Widget {
    std::unique_ptr<WidgetImpl> impl_;
public:
    Widget();
    ~Widget();
    void render();
};
