// Reference Factory sample: branching create() returning concrete subtypes.

#include <string>

class Shape {
public:
    virtual ~Shape() = default;
    virtual std::string name() const = 0;
};

class Circle : public Shape {
public:
    std::string name() const override { return "circle"; }
};

class Square : public Shape {
public:
    std::string name() const override { return "square"; }
};

class ShapeFactory {
public:
    Shape* create(const std::string& kind) {
        if (kind == "circle") {
            return new Circle();
        }
        if (kind == "square") {
            return new Square();
        }
        return nullptr;
    }
};

int main() {
    ShapeFactory factory;
    Shape* shape = factory.create("circle");
    delete shape;
    return 0;
}
