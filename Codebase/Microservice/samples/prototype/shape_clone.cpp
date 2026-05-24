#include <memory>
class Shape {
public:
    virtual ~Shape() = default;
    virtual std::unique_ptr<Shape> clone() const = 0;
    virtual void draw() const = 0;
};
class Circle : public Shape {
public:
    std::unique_ptr<Shape> clone() const override { return std::make_unique<Circle>(*this); }
    void draw() const override {}
};
