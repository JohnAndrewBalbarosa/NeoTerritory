// SAMPLE: Pimpl idiom — minimal positive case.
// Expect detection: idiom.pimpl on `Widget`.
#include <memory>
#include <string>

class Widget {
public:
    Widget();
    ~Widget();
    void setLabel(const std::string& label);
    std::string label() const;
private:
    struct Impl;
    std::unique_ptr<Impl> pImpl;
};

struct Widget::Impl {
    std::string label;
};

Widget::Widget() : pImpl(std::make_unique<Impl>()) {}
Widget::~Widget() = default;

void Widget::setLabel(const std::string& label) {
    pImpl->label = label;
}

std::string Widget::label() const {
    return pImpl->label;
}

int main() {
    Widget w;
    w.setLabel("hello");
    return 0;
}
