#include <memory>
#include <string>

class Shape { public: virtual ~Shape() = default; };
class Circle : public Shape {};
class Square : public Shape {};

class ShapeFactory {
public:
    std::unique_ptr<Shape> createShape(int kind) {
        if (kind == 1) return std::make_unique<Circle>();
        if (kind == 2) return std::make_unique<Square>();
        return nullptr;
    }
};
