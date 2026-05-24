#include <vector>
class Graphic {
public:
    virtual ~Graphic() = default;
    virtual void draw() = 0;
};
class CompositeGraphic : public Graphic {
public:
    void add(Graphic* g) { children_.push_back(g); }
    void draw() override { for (auto* c : children_) c->draw(); }
private:
    std::vector<Graphic*> children_;
};
