#include <memory>
class Renderer {
public:
    virtual ~Renderer() = default;
    virtual void renderCircle(float r) = 0;
};
class Shape {
public:
    explicit Shape(std::unique_ptr<Renderer> r) : renderer_(std::move(r)) {}
    void draw() { renderer_->renderCircle(radius_); }
private:
    std::unique_ptr<Renderer> renderer_;
    float radius_ = 1.0f;
};
