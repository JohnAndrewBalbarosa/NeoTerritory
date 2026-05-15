#include <string>

class CssRule {
    std::string color_;
    int width_ = 0;
public:
    CssRule& setColor(const std::string& c) { color_ = c; return *this; }
    CssRule& setWidth(int w) { width_ = w; return *this; }
    CssRule& applyHover() { return *this; }
};
