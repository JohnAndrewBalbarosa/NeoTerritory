#include <memory>
#include <string>

class Color {};

class ColorBuilder {
    int r_ = 0, g_ = 0, b_ = 0, a_ = 255;
public:
    ColorBuilder& setRed(int v) { r_ = v; return *this; }
    ColorBuilder& setGreen(int v) { g_ = v; return *this; }
    ColorBuilder& setBlue(int v) { b_ = v; return *this; }
    ColorBuilder& setAlpha(int v) { a_ = v; return *this; }
    std::unique_ptr<Color> make() {
        return std::make_unique<Color>();
    }
};
